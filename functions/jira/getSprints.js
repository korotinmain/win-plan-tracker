const functions = require("firebase-functions");
const { ensureAuthenticated } = require("../shared/auth");
const { getJiraConfig } = require("../shared/jiraConfig");

function mapIssue(issue) {
  return {
    id: issue.key,
    title: issue.fields?.summary ?? "(no title)",
    status: issue.fields?.status?.name ?? "Unknown",
    statusCategory:
      issue.fields?.status?.statusCategory?.colorName ?? "default",
    priority: issue.fields?.priority?.name ?? "Medium",
    type: issue.fields?.issuetype?.name ?? "Task",
    assignee: issue.fields?.assignee?.displayName ?? null,
  };
}

async function fetchSprintIssues(sprintId, baseUrl, basicAuth) {
  const url = `${baseUrl}/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=100&fields=summary,status,priority,issuetype,assignee`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data.issues) ? data.issues : []).map(mapIssue);
}

exports.getJiraSprints = functions.https.onCall(async (data, context) => {
  ensureAuthenticated(context);

  const { domain, token, email } = getJiraConfig();
  if (!domain || !token || !email) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Jira integration is not configured. Set JIRA_DOMAIN, JIRA_EMAIL and JIRA_TOKEN in functions env.",
    );
  }

  const boardId = data.boardId;
  if (!boardId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "boardId is required.",
    );
  }

  const basicAuth = Buffer.from(`${email}:${token}`).toString("base64");
  const baseUrl = `https://${domain}`;

  // Fetch active sprints
  const activeRes = await fetch(
    `${baseUrl}/rest/agile/1.0/board/${boardId}/sprint?state=active`,
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
    },
  );
  if (!activeRes.ok) {
    const text = await activeRes.text();
    throw new functions.https.HttpsError(
      "unknown",
      `Jira API request failed (${activeRes.status} ${activeRes.statusText}): ${text}`,
    );
  }
  const activeData = await activeRes.json();
  const activeSprints = Array.isArray(activeData.values)
    ? activeData.values
    : [];

  // Build active sprint sections with issues
  const sprintSections = await Promise.all(
    activeSprints.map(async (sprint) => {
      const issues = await fetchSprintIssues(sprint.id, baseUrl, basicAuth);
      const total = issues.length;
      const done = issues.filter(
        (i) => i.statusCategory === "done" || i.status.toLowerCase() === "done",
      ).length;
      return {
        id: sprint.id,
        name: sprint.name,
        state: sprint.state,
        startDate: sprint.startDate ?? null,
        endDate: sprint.endDate ?? null,
        goal: sprint.goal ?? null,
        issues,
        stats: { total, done },
      };
    }),
  );

  // Fetch next future sprint (Sprint planning)
  const futureRes = await fetch(
    `${baseUrl}/rest/agile/1.0/board/${boardId}/sprint?state=future`,
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
    },
  );
  let nextSprintSection = null;
  if (futureRes.ok) {
    const futureData = await futureRes.json();
    const futureSprints = Array.isArray(futureData.values)
      ? futureData.values
      : [];
    const nextSprint = futureSprints[0];
    if (nextSprint) {
      const issues = await fetchSprintIssues(nextSprint.id, baseUrl, basicAuth);
      nextSprintSection = {
        id: nextSprint.id,
        name: "Sprint planning",
        state: "future",
        startDate: nextSprint.startDate ?? null,
        endDate: nextSprint.endDate ?? null,
        goal: nextSprint.goal ?? null,
        issues,
        stats: {
          total: issues.length,
          done: issues.filter((i) => i.statusCategory === "done").length,
        },
      };
    }
  }

  const sprints = [...sprintSections];
  if (nextSprintSection) sprints.push(nextSprintSection);

  return { sprints };
});

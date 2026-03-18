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

exports.getJiraBacklog = functions.https.onCall(async (data, context) => {
  ensureAuthenticated(context);

  const { domain, token, email } = getJiraConfig();
  if (!domain || !token || !email) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Jira integration is not configured.",
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

  // Fetch board backlog — issues not assigned to any sprint
  let issues = [];
  let startAt = 0;
  const maxResults = 50;

  while (true) {
    const url =
      `${baseUrl}/rest/agile/1.0/board/${boardId}/backlog` +
      `?startAt=${startAt}&maxResults=${maxResults}` +
      `&fields=summary,status,priority,issuetype,assignee`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) break;
    const json = await res.json();
    const batch = Array.isArray(json.issues) ? json.issues : [];
    issues = issues.concat(batch.map(mapIssue));

    if (batch.length < maxResults) break;
    startAt += maxResults;
    if (startAt >= 500) break; // safety cap
  }

  return { issues };
});

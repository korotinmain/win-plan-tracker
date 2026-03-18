const functions = require("firebase-functions");
const { ensureAuthenticated } = require("../shared/auth");
const { getJiraConfig } = require("../shared/jiraConfig");

exports.getJiraTasks = functions.https.onCall(async (data, context) => {
  ensureAuthenticated(context);

  const { domain, token, email } = getJiraConfig();
  if (!domain || !token || !email) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Jira integration is not configured. Set JIRA_DOMAIN, JIRA_EMAIL and JIRA_TOKEN in functions env.",
    );
  }

  const basicAuth = Buffer.from(`${email}:${token}`).toString("base64");
  const url = `https://${domain}/rest/api/3/search/jql`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql: "project = ENG AND sprint in openSprints() AND sprint not in futureSprints() ORDER BY updated DESC",
      maxResults: 50,
      fields: [
        "summary",
        "status",
        "priority",
        "issuetype",
        "project",
        "assignee",
        "updated",
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new functions.https.HttpsError(
      "unknown",
      `Jira API request failed (${res.status} ${res.statusText}): ${text}`,
    );
  }

  const dataJson = await res.json();
  const issues = Array.isArray(dataJson.issues) ? dataJson.issues : [];

  const tasks = issues.map((issue) => ({
    id: issue.key,
    title: issue.fields?.summary ?? "(no title)",
    status: issue.fields?.status?.name ?? "Unknown",
    statusCategory:
      issue.fields?.status?.statusCategory?.colorName ?? "default",
    priority: issue.fields?.priority?.name ?? "Medium",
    type: issue.fields?.issuetype?.name ?? "Task",
    project: issue.fields?.project?.name ?? "",
    updated: issue.fields?.updated ?? null,
  }));

  return { tasks };
});

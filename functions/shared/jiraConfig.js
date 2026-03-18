function getJiraConfig() {
  return {
    domain: (process.env.JIRA_DOMAIN || "").toString().trim(),
    email: (process.env.JIRA_EMAIL || "").toString().trim(),
    token: (process.env.JIRA_TOKEN || "").toString().trim(),
  };
}

module.exports = { getJiraConfig };

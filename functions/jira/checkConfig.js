const functions = require("firebase-functions");
const { ensureAuthenticated } = require("../shared/auth");
const { getJiraConfig } = require("../shared/jiraConfig");

exports.checkJiraConfig = functions.https.onCall(async (data, context) => {
  ensureAuthenticated(context);
  const { domain, token, email } = getJiraConfig();

  return {
    configured: Boolean(domain && token && email),
    domain: domain || null,
  };
});

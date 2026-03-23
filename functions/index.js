const admin = require("firebase-admin");

// Load environment variables from .env file (local dev / emulators)
require("dotenv").config();

admin.initializeApp();

// ── Jira ──────────────────────────────────────────────────────────────────────
const { checkJiraConfig } = require("./jira/checkConfig");
const { getJiraTasks } = require("./jira/getTasks");
const { getJiraSprints } = require("./jira/getSprints");
const {
  createUpdateTeamMembershipCallable,
} = require("./team/updateMembership");
const {
  createGetTeamMembershipCandidatesCallable,
} = require("./team/getMembershipCandidates");

exports.checkJiraConfig = checkJiraConfig;
exports.getJiraTasks = getJiraTasks;
exports.getJiraSprints = getJiraSprints;
exports.updateTeamMembership = createUpdateTeamMembershipCallable();
exports.getTeamMembershipCandidates =
  createGetTeamMembershipCandidatesCallable();

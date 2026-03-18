const functions = require("firebase-functions");

function ensureAuthenticated(context) {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }
  return context.auth;
}

module.exports = { ensureAuthenticated };

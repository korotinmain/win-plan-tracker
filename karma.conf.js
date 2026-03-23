// Minimal karma config — used by Angular CLI's test builder.
// Defines ChromeHeadlessCI with flags required for running in CI environments
// (no sandbox, no GPU, shared memory workaround).
module.exports = function (config) {
  config.set({
    customLaunchers: {
      ChromeHeadlessCI: {
        base: "ChromeHeadless",
        flags: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      },
    },
  });
};

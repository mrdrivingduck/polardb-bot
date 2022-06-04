const issues_opened = require("./src/issues_opened");
const pull_request_opened = require("./src/pull_request_opened");
const check_suite_completed = require("./src/check_suite_completed");

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.on("issues.opened", issues_opened);
  app.on("pull_request.opened", pull_request_opened);
  app.on("check_suite.completed", check_suite_completed);

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};

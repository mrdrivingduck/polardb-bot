/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.on("issues.opened", async (context) => {
    const issueUser = context.payload.issue.user.login;
    const issueReply =
      "Hi @" +
      issueUser +
      " ~ Thanks for opening this issue! 🎉" +
      "\n\n" +
      "Please make sure you have provided **enough information** for subsequent discussion. " +
      "\n\n" +
      "We will get back to you as soon as possible. ❤️";
    return context.octokit.issues.createComment(
      context.issue({ body: issueReply })
    );
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};

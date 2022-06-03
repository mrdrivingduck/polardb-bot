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

  app.on("pull_request.opened", async (context) => {
    const user = context.payload.pull_request.user.login;
    const response = await context.octokit.issues.listForRepo(
      context.repo({
        state: "all",
        creator: user,
      })
    );
    const countPR = response.data.filter((data) => data.pull_request);

    let reply = "Hi @" + user + " ~ ";
    if (countPR.length === 1) {
      reply += "Congratulations to your first PR to PolarDB. 🎉";
      reply += "\n\n";
    } else {
      reply += "Thanks for your contribution in this PR. ❤️";
      reply += "\n\n";
    }

    reply +=
      "Please make sure that your PR conforms the standard, and has passed all the checks.";
    reply += "\n\n";
    reply += "We will review your PR as soon as possible.";

    return context.octokit.issues.createComment(context.issue({ body: reply }));
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};

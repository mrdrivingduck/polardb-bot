module.exports = async (context) => {
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
};

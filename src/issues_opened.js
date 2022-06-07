module.exports = async (context) => {
  const issue_user = context.payload.issue.user.login;
  const issue_reply =
    "Hi @" +
    issue_user +
    " ~ Thanks for opening this issue! 🎉" +
    "\n\n" +
    "Please make sure you have provided **enough information** for subsequent discussion. " +
    "\n\n" +
    "We will get back to you as soon as possible. ❤️";
  return context.octokit.issues.createComment(
    context.issue({ body: issue_reply })
  );
};

module.exports = async (context) => {
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
};

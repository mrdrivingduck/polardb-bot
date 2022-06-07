module.exports = async (context) => {
  const contributor = context.payload.pull_request.user.login;
  const _user_repos = await context.octokit.issues.listForRepo(
    context.repo({
      state: "all",
      creator: contributor,
    })
  );
  const user_repos = _user_repos.data;

  /**
   * Count how many repositories has this contributor contributed to.
   */
  const count_pr = user_repos.filter((data) => data.pull_request);

  let body = "Hi @" + contributor + " ~ ";
  if (count_pr.length === 1) {
    body += "Congratulations to your first PR to PolarDB. 🎉";
    body += "\n\n";
  } else {
    body += "Thanks for your contribution in this PR. ❤️";
    body += "\n\n";
  }

  body +=
    "Please make sure that your PR conforms the standard, and has passed all the checks.";
  body += "\n\n";
  body += "We will review your PR as soon as possible.";

  return context.octokit.issues.createComment(context.issue({ body }));
};

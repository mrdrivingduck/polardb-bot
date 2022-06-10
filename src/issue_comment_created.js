module.exports = async (context) => {
  const { issue, comment, repository } = context.payload;
  const { user: issue_opener, state: issue_state, pull_request } = issue;
  const {
    user: comment_creator,
    body: comment_body,
    author_association: comment_author_association,
  } = comment;

  switch (comment_body) {
    /**
     * INSTRUCTION: /close
     *
     * Close an issue or pull request.
     *
     * The issue or PR must be an opened one.
     * The caller must be the creator of the issue or PR, or should
     * be the writer of the repository.
     */
    case "/close":
      if (issue_state !== "open") {
        break;
      }
      if (
        comment_author_association === "MEMBER" ||
        comment_author_association === "OWNER" ||
        comment_author_association === "COLLABORATOR" ||
        comment_creator.login === issue_opener.login
      ) {
        await context.octokit.issues.update(
          context.issue({
            state: "closed",
          })
        );
      } else {
        const body =
          "Sorry, you don't have enough permission to call the instruction `" +
          comment_body +
          "`. 😥 @" +
          comment_creator.login;
        await context.octokit.issues.createComment(context.issue({ body }));
      }
      break;

    /**
     * INSTRUCTION:
     *     - /rebase-and-merge
     *     - /squash-and-merge
     *     - /merge
     *
     * Merge a PR in different ways.
     * Only the writter of the repository can call this instruction.
     * Check if the PR is mergable before merging.
     */
    case "/rebase-and-merge":
    case "/squash-and-merge":
    case "/merge":
      if (
        !(
          comment_author_association === "MEMBER" ||
          comment_author_association === "OWNER" ||
          comment_author_association === "COLLABORATOR"
        )
      ) {
        const body =
          "@" +
          comment_creator.login +
          " Sorry, you don't have enough permission to call the instruction `" +
          comment_body +
          "`. 😥 ";
        return await context.octokit.issues.createComment(
          context.issue({ body })
        );
      }
      if (pull_request == null) {
        const body =
          "@" +
          comment_creator.login +
          " Sorry, the instruction `" +
          comment_body +
          "` can only be called in a pull request. 😥";
        return await context.octokit.issues.createComment(
          context.issue({ body })
        );
      }

      const _pr = await context.octokit.pulls.get({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: issue.number,
      });
      const pr = _pr.data;

      if (!pr.mergeable) {
        const body =
          "@" +
          comment_creator.login +
          " Sorry, this PR is not mergable currently, please resolve the merge conflict first. 😥\n\n" +
          "Also, rebase your branch to the head branch is strongly recommanded.";
        return await context.octokit.issues.createComment(
          context.issue({ body })
        );
      }

      const _check_suites = await context.octokit.checks.listSuitesForRef({
        owner: repository.owner.login,
        repo: repository.name,
        ref: pr.head.sha,
      });
      const { data: check_suites } = _check_suites;

      if (check_suites.total_count > 0) {
        for (const check_suite of check_suites.check_suites) {
          const { status, conclusion } = check_suite;
          if (status !== "completed") {
            const body =
              "@" +
              comment_creator.login +
              " Sorry, some checks of this PR has not completed yet. So I can't merge for you. ⛔️";
            return await context.octokit.issues.createComment(
              context.issue({ body })
            );
          }
          if (conclusion !== "success" && conclusion !== "skipped") {
            const body =
              "@" +
              comment_creator.login +
              " Sorry, this PR failed to pass some checks. So I can't merge for you. ⛔️";
            return await context.octokit.issues.createComment(
              context.issue({ body })
            );
          }
        }
      }

      let merge_method = "merge";
      if (comment_body === "/rebase-and-merge") {
        merge_method = "rebase";
      } else if (comment_body === "/squash-and-merge") {
        merge_method = "squash";
      }

      await context.octokit.pulls.merge({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: issue.number,
        merge_method,
        commit_title:
          "Merge pull request #" + issue.number + " from " + pr.head.label,
        commit_message: "",
      });

      const body =
        "@" +
        comment_creator.login +
        " PR has been merged. 🍗\n\n" +
        "Thanks again for the contributors involved in this thread: ❤️\n\n" +
        "- @" +
        issue_opener.login;
      await context.octokit.issues.createComment(context.issue({ body }));

      break;

    default:
      break;
  }
};

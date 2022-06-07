module.exports = async (context) => {
  const { issue, comment } = context.payload;
  const issue_opener = issue.user;
  const comment_creator = comment.user;
  const comment_body = comment.body;
  const comment_author_association = comment.author_association;

  switch (comment_body) {
    /**
     * INSTRUCTION: /close
     *
     * Close an issue or pull request. The caller must be the creator
     * of the issue or PR, or should be the writer of the repository.
     */
    case "/close":
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
          "Sorry, you don't have enough permission to call instruction `/close`. 😥 @" +
          comment_creator.login;
        await context.octokit.issues.createComment(context.issue({ body }));
      }
      break;
    default:
      break;
  }
};

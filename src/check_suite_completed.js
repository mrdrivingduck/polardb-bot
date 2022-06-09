/**
 * Replace the CI label of the pull request.
 *
 * @param {BaseWebhookEvent} context
 * @param {Array} labels
 * @param {String} conclusion
 * @param {String} owner
 * @param {String} repo
 * @param {Number} issue_number
 */
async function replace_ci_label(
  context,
  labels,
  conclusion,
  owner,
  repo,
  issue_number
) {
  for (const label of labels) {
    const label_name = label.name;

    if (label_name.startsWith("ci/")) {
      await context.octokit.issues.removeLabel({
        owner,
        repo,
        issue_number,
        name: label_name,
      });
    }
  }

  await context.octokit.issues.addLabels({
    owner,
    repo,
    issue_number,
    labels: [
      conclusion === "success" || conclusion === "skipped"
        ? "ci/success"
        : "ci/failure",
    ],
  });
}

module.exports = async (context) => {
  const { check_suite } = context.payload;
  const check_suite_id = check_suite.id;
  const user = check_suite.head_commit.author.name;
  const { conclusion, head_sha } = check_suite;

  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;

  /* get the detail of check runs */
  const _check_runs = await context.octokit.checks.listForSuite({
    owner,
    repo,
    check_suite_id,
  });
  const { check_runs } = _check_runs.data;

  /* get the related pull request */
  const _linked_prs = await context.octokit.search.issuesAndPullRequests({
    q: head_sha + " SHA",
  });
  const linked_prs = _linked_prs.data.items;

  for (const linked_pr of linked_prs) {
    const { state, html_url, labels } = linked_pr;

    /* PR is not open, skip it */
    if (state !== "open") {
      continue;
    }

    /* Not current repository, skip it */
    const url_tokens = html_url.split("/");
    const url_token_len = url_tokens.length;
    if (
      url_token_len < 4 ||
      url_tokens[url_token_len - 2] !== "pull" ||
      url_tokens[url_token_len - 3] !== repo ||
      url_tokens[url_token_len - 4] !== owner
    ) {
      continue;
    }

    const pull_request_number = parseInt(url_tokens[url_token_len - 1]);

    let body = "Hey @" + user + " :\n\n";
    if (conclusion === "success") {
      body +=
        "Congratulations~ 🎉 Your commit has passed all the checks. Please wait for further manual review.";
      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: pull_request_number,
        body,
      });
      return replace_ci_label(
        context,
        labels,
        conclusion,
        owner,
        repo,
        pull_request_number
      );
    } else if (conclusion === "cancelled") {
      body +=
        "Your checks have been cancelled. Please re-run the checks if you want to merge this PR.";
      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: pull_request_number,
        body,
      });
      return replace_ci_label(
        context,
        labels,
        conclusion,
        owner,
        repo,
        pull_request_number
      );
    } else {
      body +=
        "Something wrong occuried during the checks of your commit, please check the detail: 🤓\n\n";
    }

    /* Detail information of unsuccessful check runs */
    check_runs.forEach((check_run) => {
      if (
        check_run.conclusion !== "success" &&
        check_run.conclusion !== "skipped"
      ) {
        const check_run_name = check_run.name;
        const check_run_url = check_run.details_url;
        const check_run_text = check_run.output.text;

        body += "<details>\n";
        body +=
          "<summary> ⚠️ " +
          check_run_name +
          " <a href='" +
          check_run_url +
          "'>View more details</a>" +
          "</summary>\n\n";
        body += check_run_text;
        body += "\n\n";
        body += "</details>\n\n";
      }
    });

    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull_request_number,
      body,
    });

    return await replace_ci_label(
      context,
      labels,
      conclusion,
      owner,
      repo,
      pull_request_number
    );
  }
};

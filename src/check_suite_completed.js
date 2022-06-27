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
  /* remove existing `ci/` labels first */
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

  /* add new `ci/` label according to the CI conclusion */
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
  const { check_suite: input_check_suite, repository } = context.payload;
  const { head_sha } = input_check_suite;

  const owner = repository.owner.login;
  const repo = repository.name;

  /* get all check suites belong to this commit */
  const _check_suites = await context.octokit.checks.listSuitesForRef({
    owner,
    repo,
    ref: head_sha,
  });
  const { check_suites } = _check_suites.data;

  /* gather all check runs from these check suites, and gather the conclusion */
  const all_check_runs = [];
  const all_suite_conclusions = [];

  for (const check_suite of check_suites) {
    /* only focus on Cirrus-CI and GitHub Actions */
    if (
      !(
        check_suite.app.slug === "cirrus-ci" ||
        check_suite.app.slug === "github-actions"
      )
    ) {
      continue;
    }

    /* make sure all of the check suites have completed */
    if (check_suite.status !== "completed") {
      return;
    }

    /* get the detail check runs of a check suite */
    const _check_runs = await context.octokit.checks.listForSuite({
      owner,
      repo,
      check_suite_id: check_suite.id,
    });
    const { check_runs } = _check_runs.data;

    /* all check runs should have been completed */
    let check_run_running = false;
    for (const _check_run of check_runs) {
      if (_check_run.status !== "completed") {
        return;
      }
    }

    all_check_runs.push(...check_runs);
    all_suite_conclusions.push(check_suite.conclusion);
  }

  /* get the related pull request of this commit */
  const _linked_prs = await context.octokit.search.issuesAndPullRequests({
    q: head_sha + " SHA",
  });
  const { items: linked_prs } = _linked_prs.data;

  for (const linked_pr of linked_prs) {
    const { state, html_url, labels, user } = linked_pr;

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

    /* get the pull request number */
    const pull_request_number = parseInt(url_tokens[url_token_len - 1]);

    let body = "Hey @" + user.login + " :\n\n";

    /* at least a check run has failed */
    if (all_suite_conclusions.indexOf("failure") !== -1) {
      body +=
        "Something wrong occuried during the checks of your commit 😟, please check the detail:\n\n";

      /* Detail information of unsuccessful check runs */
      all_check_runs.forEach((check_run) => {
        if (check_run.conclusion === "failure") {
          const check_run_name = check_run.name;
          const check_run_url = check_run.details_url;
          const check_run_text =
            check_run.output.text === null
              ? check_run.output.summary
              : check_run.output.text;

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
        "failure",
        owner,
        repo,
        pull_request_number
      );
    } else if (all_suite_conclusions.indexOf("cancelled") !== -1) {
      body +=
        "Your checks have been cancelled ⛔️. Please re-run the checks if you want to merge this PR.";

      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: pull_request_number,
        body,
      });
      return replace_ci_label(
        context,
        labels,
        "cancelled",
        owner,
        repo,
        pull_request_number
      );
    } else {
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
        "success",
        owner,
        repo,
        pull_request_number
      );
    }
  }
};

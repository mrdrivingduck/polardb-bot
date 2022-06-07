const axios = require("axios").default;

/**
 * Get the PR number through Cirrus CI API.
 *
 * @see https://cirrus-ci.org/api/
 * @param {String} external_id
 * @returns The PR number on Cirrus CI, or -1 if not triggered by a PR.
 */
async function get_pull_request_number_cirrus(external_id) {
  const cirrus = await axios.post("https://api.cirrus-ci.com/graphql", {
    query: "query{task(id: " + external_id + "){build{pullRequest}}}",
  });

  const result = cirrus.data.data.task.build.pullRequest;

  if (result != null) {
    return result;
  }
  return -1;
}

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
  const conclusion = check_suite.conclusion;

  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;

  const _check_runs = await context.octokit.checks.listForSuite({
    owner,
    repo,
    check_suite_id,
  });
  const { check_runs } = _check_runs.data;

  let pull_request_number = -1;
  for (const check_run of check_runs) {
    const { external_id } = check_run;
    const provider = check_run.app.slug;

    if (external_id != null) {
      if (provider === "cirrus-ci") {
        pull_request_number = await get_pull_request_number_cirrus(external_id);
      } else {
        continue;
      }

      if (pull_request_number != -1) {
        break;
      }
    }
  }

  if (pull_request_number === -1) {
    return;
  }

  const _labels = await context.octokit.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: pull_request_number,
  });
  const labels = _labels.data;

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

  return replace_ci_label(
    context,
    labels,
    conclusion,
    owner,
    repo,
    pull_request_number
  );
};

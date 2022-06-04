const axios = require("axios").default;

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

module.exports = async (context) => {
  const check_suite = context.payload.check_suite;
  const user = check_suite.head_commit.author.name;
  const conclusion = check_suite.conclusion;
  const repo = context.payload.repository;

  const response = await context.octokit.checks.listForSuite({
    owner: repo.owner.login,
    repo: repo.name,
    check_suite_id: check_suite.id,
  });

  let pull_request_number = -1;
  for (const check_run of response.data.check_runs) {
    const external_id = check_run.external_id;
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

  let body = "Hey @" + user + " :\n\n";
  if (conclusion === "success") {
    body +=
      "Congratulations~ 🎉 Your commit has passed all the checks. Please wait for further manual review.";
    return context.octokit.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: pull_request_number,
      body: body,
    });
  } else if (conclusion === "cancelled") {
    body +=
      "Your checks have been cancelled. Please re-run the checks if you want to merge this PR.";
    return context.octokit.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: pull_request_number,
      body: body,
    });
  } else {
    body +=
      "Something wrong occuried during checks, please check the detail. 🤓\n\n";
  }

  response.data.check_runs.forEach((check_run) => {
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

  return context.octokit.issues.createComment({
    owner: repo.owner.login,
    repo: repo.name,
    issue_number: pull_request_number,
    body: body,
  });
};

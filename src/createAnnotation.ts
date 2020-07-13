import * as core from "@actions/core";
import * as github from "@actions/github";
// import { ChecksCreateParamsOutputAnnotations } from "@octokit/rest";
import * as fs from "fs";
import { LineReplaced } from "./support";

export async function createAnnotations({
  githubToken,
  newVersion,
  linesReplaced = [] as LineReplaced[],
}) {
  try {
    const octokit = github.getOctokit(githubToken);
    const { data: refData } = await octokit.git.getRef({
      ...github.context.repo,
      ref: `heads/master`,
    });
    const commitSha = refData.object.sha;
    const { data: commitData } = await octokit.git.getCommit({
      ...github.context.repo,
      commit_sha: commitSha,
    });

    const { data } = await octokit.checks.create({
      ...github.context.repo,
      name: "bump-version",
      // head_sha: getSha(github.context),
      head_sha: commitData.sha,
      conclusion: "success",
      output: {
        title: `Bumped version to ${newVersion}`,
        summary: `Bumped version to ${newVersion}`,
        annotations: [
          {
            annotation_level: "notice",
            title: `Bumped version to ${linesReplaced[0].newValue}`,
            message: `Bumped version to ${linesReplaced[0].newValue}`,
            path: linesReplaced[0].path.replace("./", ""),
            start_line: linesReplaced[0].line,
            end_line: linesReplaced[0].line,
          },
        ],
      },
      status: "completed",
    });
  } catch (error) {
    console.log("Error in createAnnotation", error);
    core.setFailed(error.message);
    return;
  }
}

const getSha = (context) => {
  console.log("getting sha ", context, context.sha, context.payload);
  if (context.eventName === "pull_request") {
    return context.payload.pull_request.head.sha;
  } else {
    return context.sha;
  }
};

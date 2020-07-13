import { exec } from "@actions/exec";
import * as core from "@actions/core";
import { ExecOptions } from "@actions/exec/lib/interfaces";
import { retry } from "./support";
import * as github from "@actions/github";

export default async ({
  USER_NAME,
  USER_EMAIL,
  MESSAGE,
  GITHUB_TOKEN,
  tagName,
  tagMsg,
  branch,
}) => {
  try {
    if (!GITHUB_TOKEN) {
      console.log("aaaaa missing required env vars, skipping commit creation");
      core.setFailed("missing required env vars");
      return;
    }
    console.log(`committing changes with message "${MESSAGE}"`);
    const REMOTE_REPO = `https://${process.env.GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git`;

    // const git = github.getOctokit(GITHUB_TOKEN);
    // const owner = process.env.GITHUB_REPOSITORY_OWNER as string;
    // const repo = process.env.GITHUB_REPOSITORY?.split("/").pop() as string;

    // const commitResult = await git.git.createCommit({
    //   owner,
    //   repo,
    //   message: MESSAGE,
    //   committer: {
    //     name: USER_NAME,
    //     email: USER_EMAIL,
    //   },
    //   tree: github.context.payload.head_commit.tree_id,
    //   parents: [github.context.payload.head_commit.id],
    // });
    // console.log("commit result ", commitResult);

    const options = {
      cwd: process.env.GITHUB_WORKSPACE,
      listeners: {
        stdline: core.debug,
        stderr: core.debug,
        debug: core.debug,
      },
    } as any;

    await exec("git", ["config", "user.name", `"${USER_NAME}"`], options);
    await exec("git", ["config", "user.email", `"${USER_EMAIL}"`], options);

    await exec("git", ["remote", "add", "publisher", REMOTE_REPO], options);
    // await exec('git', ['show-ref'], options)
    // await exec('git', ['branch', '--verbose'], options)

    await exec("git", ["add", "-A"], options);

    try {
      await exec("git", ["commit", "-v", "-m", `${MESSAGE}`], options);
    } catch (err) {
      core.debug("nothing to commit");
      return;
    }
    await exec("git", ["branch", "bump_tmp_"], options);
    await exec("git", ["checkout", branch], options);
    await exec("git", ["merge", "bump_tmp_"], options);
    await push({ branch, options });
  } catch (err) {
    core.setFailed(err.message);
    console.log("Commit failed", err);
    process.exit(1);
  }
};

async function push({ branch, options }) {
  async function fn(bail) {
    await exec(
      "git",
      [
        "pull",
        "--no-edit",
        "--commit",
        "--strategy-option",
        "theirs",
        "publisher",
        branch,
      ],
      options
    );
    await exec("git", ["push", "publisher", branch], options);
  }
  await retry(fn, {
    randomize: true,
    onRetry: (e, i) => {
      console.error(`retrying pushing the ${i} time after error: ${e}`);
    },
    retries: 3,
  });
}

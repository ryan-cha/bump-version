import * as core from "@actions/core";
import * as fs from "fs";
import globby from "globby";
import commit from "./commit";
import { createTag } from "./createTag";
import {
  capitalize,
  replacePattern,
  LineReplaced,
  versionRegex,
} from "./support";
import { inc } from "semver";
import { exec } from "@actions/exec";

import { createAnnotations } from "./createAnnotation";

async function run() {
  const options = {
    cwd: process.env.GITHUB_WORKSPACE,
    listeners: {
      stdline: core.debug,
      stderr: core.debug,
      debug: core.debug,
    },
  } as any;

  const versionResult = await exec("npm", ["version", "patch"], options);
  console.log("version result = ", versionResult);

  const githubToken = core.getInput("github_token") || process.env.GITHUB_TOKEN;
  const ignore =
    core
      .getInput("ignore")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean) || [];
  const GITHUB_REF = process.env.GITHUB_REF || "";
  const branch =
    core.getInput("branch") ||
    process.env.BRANCH ||
    GITHUB_REF.split("/").reverse()[0] ||
    "master";
  const versionPath = core.getInput("version_file") || "package.json";
  const prefix = (core.getInput("prefix") || "").trim();
  const packageJsonFile = fs
    .readFileSync(versionPath, "utf8")
    .toString()
    .trim();
  const packageJsonArray = JSON.stringify(
    JSON.parse(packageJsonFile),
    null,
    1
  ).split("\n");
  let lineIndex = 0;
  packageJsonArray.find((value, idx) => {
    const match = value.startsWith(' "version"');
    if (match) {
      lineIndex = idx;
    }
    return match;
  });
  const packageJson = JSON.parse(packageJsonFile);
  const version = packageJson.version;

  const preReleaseTag = core.getInput("prerelease_tag") || "";
  const newVersion = inc(
    version,
    preReleaseTag ? "prerelease" : "patch",
    preReleaseTag ?? undefined
  );
  if (!newVersion) {
    throw new Error("could not bump version " + version);
  }
  packageJson.version = newVersion;
  console.log(`Rewriting version file: ${version} => ${newVersion}`);
  fs.writeFileSync(versionPath, JSON.stringify(packageJson, null, 2), "utf8");
  const tagName = prefix ? prefix + "_" + newVersion : newVersion;
  const tagMsg = `Version auto-bumped: ${newVersion}`;
  const files = await globby("package.json");

  try {
    console.log("\n\n  ======= COMMIT ========");
    await commit({
      USER_EMAIL: "auto-bumper@no-reply.bumper.com",
      USER_NAME: "auto-bumper",
      GITHUB_TOKEN: githubToken,
      MESSAGE: tagMsg,
      tagName,
      tagMsg,
      branch,
    });
    console.log("\n\n  ======= TAG ========");
    await createTag({
      GITHUB_TOKEN: githubToken,
      tagName,
      tagMsg,
    });

    console.log("\n\n  ======= ANNOTATION ========");
    await createAnnotations({
      githubToken,
      newVersion: tagMsg,
      linesReplaced: [
        {
          line: lineIndex,
          path: files[0],
          newValue: newVersion,
        },
      ],
    });
    core.setOutput("version", newVersion);
    core.info(`New version ${tagMsg}`);
  } catch (error) {
    console.log("Main failed", error);
    core.setFailed(error.message);
    process.exit(1);
  }
}

try {
  run();
} catch (e) {
  console.error(e);
}

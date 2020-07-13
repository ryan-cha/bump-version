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

import { createAnnotations } from "./createAnnotation";

async function run() {
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
  const packageJsonArray = JSON.stringify(packageJsonFile, null, 1).split("\n");
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
  console.log("writing new version file");
  fs.writeFileSync(versionPath, JSON.stringify(packageJson), "utf8");
  //   let linesReplaced: LineReplaced[] = [];
  //   if (prefix) {
  //     console.log(`replacing version patterns below [bump if ${prefix}]`);
  //     const pattern = new RegExp("\\[bump if " + prefix + "\\]");
  //     const res = await replacePattern({
  //       pattern,
  //       replacer: versionRegex,
  //       value: newVersion,
  //       ignore,
  //     });
  //     linesReplaced = res.linesReplaced;
  //   } else {
  //     console.log(`replacing version patterns below [bump]`);
  //     const res = await replacePattern({
  //       pattern: /\[bump\]/,
  //       replacer: versionRegex,
  //       value: newVersion,
  //       ignore,
  //     });
  //     linesReplaced = res.linesReplaced;
  //   }
  const tagName = prefix ? prefix + "_" + newVersion : newVersion;
  const tagMsg = `${
    capitalize(prefix) + " "
  } Auto Version Bumped! ${newVersion}`;

  const files = await globby("package.json");

  try {
    await Promise.all([
      commit({
        USER_EMAIL: "auto-bumper@no-reply.bumper.com",
        USER_NAME: "auto-bumper",
        GITHUB_TOKEN: githubToken,
        MESSAGE: tagMsg,
        tagName,
        tagMsg,
        branch,
      }),
      createTag({
        GITHUB_TOKEN: githubToken,
        tagName,
        tagMsg,
      }),
      createAnnotations({
        githubToken,
        newVersion: tagMsg,
        linesReplaced: [
          {
            line: lineIndex,
            path: files[0],
            newValue: newVersion,
          },
        ],
      }),
    ]);
  } catch (error) {
    console.log("commit , tag failed", error);
  }
  console.log("setting output version=" + newVersion + " prefix=" + prefix);

  // if (files && files.length) {
  //   await createAnnotations({
  //     githubToken,
  //     newVersion: tagMsg,
  //     linesReplaced: [
  //       {
  //         line: lineIndex,
  //         path: files[0],
  //         newValue: newVersion,
  //       },
  //     ],
  //   });
  // }

  core.setOutput("version", newVersion);
  core.setOutput("prefix", prefix);
  core.info(`new version ${tagMsg}`);
}

try {
  run();
} catch (e) {
  console.error(e);
}

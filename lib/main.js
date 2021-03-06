"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const globby_1 = __importDefault(require("globby"));
const commit_1 = __importDefault(require("./commit"));
const createTag_1 = require("./createTag");
const semver_1 = require("semver");
const exec_1 = require("@actions/exec");
const createAnnotation_1 = require("./createAnnotation");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = {
            cwd: process.env.GITHUB_WORKSPACE,
            listeners: {
                stdline: core.debug,
                stderr: core.debug,
                debug: core.debug,
            },
        };
        const versionResult = yield exec_1.exec("npm", ["version", "patch"], options);
        console.log("version result = ", versionResult);
        const githubToken = core.getInput("github_token") || process.env.GITHUB_TOKEN;
        const ignore = core
            .getInput("ignore")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean) || [];
        const GITHUB_REF = process.env.GITHUB_REF || "";
        const branch = core.getInput("branch") ||
            process.env.BRANCH ||
            GITHUB_REF.split("/").reverse()[0] ||
            "master";
        const versionPath = core.getInput("version_file") || "package.json";
        const prefix = (core.getInput("prefix") || "").trim();
        const packageJsonFile = fs
            .readFileSync(versionPath, "utf8")
            .toString()
            .trim();
        const packageJsonArray = JSON.stringify(JSON.parse(packageJsonFile), null, 1).split("\n");
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
        const newVersion = semver_1.inc(version, preReleaseTag ? "prerelease" : "patch", preReleaseTag !== null && preReleaseTag !== void 0 ? preReleaseTag : undefined);
        if (!newVersion) {
            throw new Error("could not bump version " + version);
        }
        packageJson.version = newVersion;
        console.log(`Rewriting version file: ${version} => ${newVersion}`);
        fs.writeFileSync(versionPath, JSON.stringify(packageJson, null, 2), "utf8");
        const tagName = prefix ? prefix + "_" + newVersion : newVersion;
        const tagMsg = `Version auto-bumped: ${newVersion}`;
        const files = yield globby_1.default("package.json");
        try {
            console.log("\n\n  ======= COMMIT ========");
            yield commit_1.default({
                USER_EMAIL: "auto-bumper@no-reply.bumper.com",
                USER_NAME: "auto-bumper",
                GITHUB_TOKEN: githubToken,
                MESSAGE: tagMsg,
                tagName,
                tagMsg,
                branch,
            });
            console.log("\n\n  ======= TAG ========");
            yield createTag_1.createTag({
                GITHUB_TOKEN: githubToken,
                tagName,
                tagMsg,
            });
            console.log("\n\n  ======= ANNOTATION ========");
            yield createAnnotation_1.createAnnotations({
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
        }
        catch (error) {
            console.log("Main failed", error);
            core.setFailed(error.message);
            process.exit(1);
        }
    });
}
try {
    run();
}
catch (e) {
    console.error(e);
}

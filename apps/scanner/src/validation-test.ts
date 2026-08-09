import fs from "node:fs/promises";
import path from "node:path";

import {
  validateProject,
  type ValidationCommand
} from "@codesentinel/validation-engine";

import {
  resolveProjectPath
} from "./path-resolver.js";

interface PackageJson {
  name?: string;

  version?: string;

  scripts?: Record<
    string,
    string
  >;

  packageManager?: string;
}

const inputPath =
  process.argv[2];

if (!inputPath) {
  console.error(
    "Usage: npm run validation-test -- <project-path>"
  );

  process.exit(1);
}

const projectPath =
  await resolveProjectPath(
    inputPath
  );

console.log("");

console.log(
  "🧪 CodeSentinel Validation Engine"
);

console.log(
  "================================="
);

console.log(
  `Input: ${inputPath}`
);

console.log(
  `Resolved Project: ${projectPath}`
);

console.log("");

/*
 * Read package.json.
 */
const packageJsonPath =
  path.join(
    projectPath,
    "package.json"
  );

let packageJson: PackageJson;

try {
  const packageJsonContent =
    await fs.readFile(
      packageJsonPath,
      "utf8"
    );

  packageJson =
    JSON.parse(
      packageJsonContent
    );
} catch (error) {
  console.error(
    "❌ Unable to read package.json"
  );

  console.error(error);

  process.exit(1);
}

/*
 * Detect package manager.
 */
const packageManager =
  packageJson.packageManager
    ?.split("@")[0] ??
  "npm";

console.log(
  `📦 Package Manager: ${packageManager}`
);

console.log(
  `📁 Project: ${
    packageJson.name ??
    path.basename(projectPath)
  }`
);

console.log("");

/*
 * Get npm scripts.
 */
const scripts =
  packageJson.scripts ?? {};

const commands: ValidationCommand[] =
  [];

/*
 * Install
 */
if (
  packageManager === "npm"
) {
  commands.push({
    name:
      "Install dependencies",

    command: "npm",

    args: [
      "install"
    ]
  });
}

/*
 * Build
 */
if (scripts.build) {
  commands.push({
    name: "Build",

    command: "npm",

    args: [
      "run",
      "build"
    ]
  });
} else {
  commands.push({
    name: "Build",

    command: "__skip__",

    args: []
  });
}

/*
 * Test
 */
if (scripts.test) {
  commands.push({
    name: "Test",

    command: "npm",

    args: [
      "test"
    ]
  });
} else {
  commands.push({
    name: "Test",

    command: "__skip__",

    args: []
  });
}

/*
 * Lint
 */
if (scripts.lint) {
  commands.push({
    name: "Lint",

    command: "npm",

    args: [
      "run",
      "lint"
    ]
  });
} else {
  commands.push({
    name: "Lint",

    command: "__skip__",

    args: []
  });
}

/*
 * Type Check
 */
if (scripts.typecheck) {
  commands.push({
    name: "Type Check",

    command: "npm",

    args: [
      "run",
      "typecheck"
    ]
  });
} else if (
  scripts["type-check"]
) {
  commands.push({
    name: "Type Check",

    command: "npm",

    args: [
      "run",
      "type-check"
    ]
  });
} else {
  commands.push({
    name: "Type Check",

    command: "__skip__",

    args: []
  });
}

/*
 * Run validation.
 */
const report =
  await validateProject(
    projectPath,
    commands,
    packageManager
  );

/*
 * Summary
 */
const total =
  report.results.length;

const passedCount =
  report.results.filter(
    (result) =>
      result.status ===
      "passed"
  ).length;

const failedCount =
  report.results.filter(
    (result) =>
      result.status ===
      "failed"
  ).length;

const skippedCount =
  report.results.filter(
    (result) =>
      result.status ===
      "skipped"
  ).length;

console.log("");

console.log(
  "📊 Validation Report"
);

console.log(
  "===================="
);

console.log("");

console.log(
  `Total:   ${total}`
);

console.log(
  `Passed:  ${passedCount}`
);

console.log(
  `Failed:  ${failedCount}`
);

console.log(
  `Skipped: ${skippedCount}`
);

console.log("");

/*
 * Findings
 */
if (
  report.findings.length > 0
) {
  console.log(
    "🚨 Validation Findings"
  );

  console.log(
    "======================"
  );

  console.log("");

  for (
    const finding of
      report.findings
  ) {
    console.log(
      `🔴 ${finding.severity.toUpperCase()}`
    );

    console.log(
      finding.title
    );

    console.log(
      `Command: ${finding.command}`
    );

    console.log(
      `Exit Code: ${
        finding.exitCode
      }`
    );

    console.log(
      finding.message
    );

    console.log("");
  }
}

/*
 * Final project status.
 */
console.log(
  report.passed
    ? "🎯 Project Status: VALID"
    : "❌ Project Status: INVALID"
);

console.log("");

/*
 * Final JSON report.
 */
console.log(
  JSON.stringify(
    {
      ...report,

      summary: {
        total,

        passedCount,

        failedCount,

        skippedCount
      }
    },

    null,

    2
  )
);

/*
 * Exit code:
 *
 * 0 = valid
 * 1 = invalid
 */
process.exit(
  report.passed
    ? 0
    : 1
);
import {
  validateProject
} from "@codesentinel/validation-engine";

import {
  resolveProjectPath
} from "./path-resolver.js";

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

/**
 * Validation commands
 */
const commands = [
  {
    name: "Install dependencies",

    command: "npm",

    args: [
      "install"
    ]
  },

  {
    name: "Build",

    command: "npm",

    args: [
      "run",
      "build"
    ]
  },

  {
    name: "Test",

    command: "npm",

    args: [
      "test"
    ]
  },

  {
    name: "Lint",

    command: "npm",

    args: [
      "run",
      "lint"
    ]
  },

  {
    name: "Type Check",

    command: "npx",

    args: [
      "tsc",
      "--noEmit",
      "-p",
      "tsconfig.json"
    ]
  }
];
console.log("\n🔍 Validation Commands:");
console.log(
  JSON.stringify(commands, null, 2)
);

const report =
  await validateProject(
    projectPath,
    commands,
    "npm"
  );

console.log("");

/**
 * Validation Report
 */
console.log(
  "📊 Validation Report"
);

console.log(
  "===================="
);

console.log("");

const total =
  report.results.length;

const passed =
  report.results.filter(
    (result) =>
      result.status === "passed"
  ).length;

const failed =
  report.results.filter(
    (result) =>
      result.status === "failed"
  ).length;

const skipped =
  report.results.filter(
    (result) =>
      result.status === "skipped"
  ).length;

const warnings =
  report.warnings.length;

console.log(
  `Total:    ${total}`
);

console.log(
  `Passed:   ${passed}`
);

console.log(
  `Failed:   ${failed}`
);

console.log(
  `Skipped:  ${skipped}`
);

console.log(
  `Warnings: ${warnings}`
);

console.log("");

/**
 * Validation Findings
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
    const finding
    of report.findings
  ) {
    console.log(
      `🔴 ${finding.severity.toUpperCase()}`
    );

    console.log(
      finding.title
    );

    if (
      finding.command
    ) {
      console.log(
        `Command: ${finding.command}`
      );
    }

    if (
      finding.exitCode !==
      undefined &&
      finding.exitCode !==
      null
    ) {
      console.log(
        `Exit Code: ${finding.exitCode}`
      );
    }

    if (
      finding.file
    ) {
      console.log(
        `File: ${finding.file}`
      );
    }

    if (
      finding.line !==
      undefined
    ) {
      console.log(
        `Line: ${finding.line}`
      );
    }

    if (
      finding.column !==
      undefined
    ) {
      console.log(
        `Column: ${finding.column}`
      );
    }

    if (
      finding.code
    ) {
      console.log(
        `Code: ${finding.code}`
      );
    }

    console.log(
      finding.message
    );

    if (
      finding.suggestion
    ) {
      console.log(
        `💡 Suggested Fix: ${finding.suggestion}`
      );
    }

    if (
      finding.evidence
    ) {
      console.log(
        `Evidence: ${finding.evidence}`
      );
    }

    console.log("");
  }
}

/**
 * Validation Warnings
 */
if (
  report.warnings.length > 0
) {
  console.log(
    "⚠️ Validation Warnings"
  );

  console.log(
    "======================"
  );

  console.log("");

  for (
    const warning
    of report.warnings
  ) {
    console.log(
      `🟡 ${warning.severity.toUpperCase()}`
    );

    console.log(
      warning.title
    );

    if (
      warning.command
    ) {
      console.log(
        `Command: ${warning.command}`
      );
    }

    if (
      warning.code
    ) {
      console.log(
        `Code: ${warning.code}`
      );
    }

    if (
      warning.file
    ) {
      console.log(
        `File: ${warning.file}`
      );
    }

    if (
      warning.line !==
      undefined
    ) {
      console.log(
        `Line: ${warning.line}`
      );
    }

    if (
      warning.column !==
      undefined
    ) {
      console.log(
        `Column: ${warning.column}`
      );
    }

    console.log(
      warning.message
    );

    if (
      warning.evidence
    ) {
      console.log(
        `Evidence: ${warning.evidence}`
      );
    }

    console.log("");
  }
}

/**
 * Final project status
 */
console.log(
  report.passed
    ? "🎯 Project Status: VALID"
    : "❌ Project Status: INVALID"
);

console.log("");

/**
 * Full JSON report
 */
console.log(
  JSON.stringify(
    report,
    null,
    2
  )
);

process.exit(
  report.passed
    ? 0
    : 1
);
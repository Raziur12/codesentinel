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
  await resolveProjectPath(inputPath);

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

const report =
  await validateProject(
    projectPath,
    [
      {
        name: "Install dependencies",
        command: "npm",
        args: ["install"]
      },
      {
        name: "Build",
        command: "npm",
        args: ["run", "build"]
      },
      {
        name: "Test",
        command: "npm",
        args: ["test"]
      },
      {
        name: "Lint",
        command: "npm",
        args: ["run", "lint"]
      }
    ],
    "npm"
  );

console.log("");
console.log(
  "📊 Validation Report"
);
console.log(
  "===================="
);

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
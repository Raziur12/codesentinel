import fs from "node:fs/promises";
import path from "node:path";

import {
  validateProject
} from "@codesentinel/validation-engine";

import {
  analyzeProject
} from "@codesentinel/project-analyzer";

import {
  deduplicateDetections,
  createTechnologyProfile
} from "@codesentinel/scanner-core";

import type {
  ScanContext,
  ScanResult,
  ScannerPlugin
} from "@codesentinel/scanner-core";

import {
  universalTechnologyPlugin
} from "@codesentinel/technology-detectors";

import {
  resolveProjectPath
} from "./path-resolver.js";


async function getFiles(
  directory: string,
  root = directory
): Promise<string[]> {
  const entries = await fs.readdir(
    directory,
    {
      withFileTypes: true
    }
  );

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      if (
        [
          "node_modules",
          ".git",
          "dist",
          "build",
          ".next",
          ".codesentinel"
        ].includes(entry.name)
      ) {
        continue;
      }

      files.push(
        ...(await getFiles(
          fullPath,
          root
        ))
      );
    } else {
      files.push(
        path.relative(
          root,
          fullPath
        )
      );
    }
  }

  return files;
}


async function scanProject(
  projectPath: string,
  plugins: ScannerPlugin[]
): Promise<ScanResult> {
  const startedAt =
    new Date().toISOString();

  /*
   * 1. Collect project files
   */
  const files =
    await getFiles(projectPath);

  const context: ScanContext = {
    projectPath,
    files
  };


  /*
   * 2. Analyze project structure
   */
  const projectStructure =
    await analyzeProject(
      projectPath
    );


  /*
   * 3. Run every detector exactly once
   */
  const rawTechnologies = [];

  for (const plugin of plugins) {
    const results =
      await plugin.detect(context);

    rawTechnologies.push(
      ...results
    );
  }


  /*
   * 4. Remove duplicate technologies
   *    and merge their evidence.
   */
  const technologies =
    deduplicateDetections(
      rawTechnologies
    );


  /*
   * 5. Create structured technology profile
   */
  const technologyProfile =
    createTechnologyProfile(
      technologies
    );


  /*
   * 6. Run project validation
   */
  const validationReport =
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


  /*
   * 7. Save CodeSentinel artifacts
   */
  const outputDirectory =
    path.join(
      projectPath,
      ".codesentinel"
    );

  await fs.mkdir(
    outputDirectory,
    {
      recursive: true
    }
  );


  /*
   * Save technology profile
   */
  await fs.writeFile(
    path.join(
      outputDirectory,
      "technology-profile.json"
    ),
    JSON.stringify(
      technologyProfile,
      null,
      2
    ),
    "utf8"
  );


  /*
   * Save validation report
   */
  await fs.writeFile(
    path.join(
      outputDirectory,
      "validation-report.json"
    ),
    JSON.stringify(
      validationReport,
      null,
      2
    ),
    "utf8"
  );


  /*
   * 8. Create final scan result
   */
  const completedAt =
    new Date().toISOString();


  return {
    projectPath,
    filesScanned: files.length,
    projectStructure,
    technologies,
    technologyProfile,

    validation: {
      passed:
        validationReport.passed,

      total:
        validationReport.results.length,

      passedCount:
        validationReport.results.filter(
          result =>
            result.status === "passed"
        ).length,

      failedCount:
        validationReport.results.filter(
          result =>
            result.status === "failed"
        ).length,

      skippedCount:
        validationReport.results.filter(
          result =>
            result.status === "skipped"
        ).length
    },

    startedAt,
    completedAt
  };
}


async function main(): Promise<void> {
  const inputPath =
    process.argv[2] ?? ".";


  /*
   * IMPORTANT:
   * Resolve the path from the repository root,
   * not from apps/scanner.
   */
  const projectPath =
    await resolveProjectPath(
      inputPath
    );


  console.log(
    "🔎 CodeSentinel Scanner"
  );

  console.log(
    "======================"
  );

  console.log(
    `Input: ${inputPath}`
  );

  console.log(
    `Resolved Project: ${projectPath}`
  );

  console.log("");


  const result =
    await scanProject(
      projectPath,
      [
        universalTechnologyPlugin
      ]
    );


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}


main().catch(
  (error) => {
    console.error(
      "Scanner failed:"
    );

    console.error(error);

    process.exit(1);
  }
);
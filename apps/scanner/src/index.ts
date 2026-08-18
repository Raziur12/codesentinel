import fs from "node:fs/promises";
import path from "node:path";

import {
  discoverValidationPlan,
  validateProject
} from "@codesentinel/validation-engine";

import type {
  ValidationReport
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
  resolveProjectPath,
  resolveWorkspaceProjectPath
} from "./path-resolver.js";

interface CliOptions {
  inputPath: string;

  workspacePath?: string;

  format: "text" | "json";
}

interface ScanExecution {
  result: ScanResult;

  validationReport: ValidationReport;
}

interface JsonScanOutput {
  scan: {
    metadata: {
      schemaVersion: string;

      generatedAt: string;

      format: "json";
    };

    project: {
      path: string;

      filesScanned: number;

      structure: ScanResult["projectStructure"];
    };

    technologyProfile: ScanResult["technologyProfile"];

    validation: ValidationReport;

    findings: ValidationReport["findings"];

    summary: NonNullable<ScanResult["validation"]>;
  };
}

function parseCliOptions(
  args: string[]
): CliOptions {
  let inputPath:
    | string
    | undefined;

  let workspacePath:
    | string
    | undefined;

  let format:
    CliOptions["format"] =
      "text";

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    const arg =
      args[index];

    if (
      arg === "--workspace" ||
      arg === "--scan-workspace" ||
      arg === "--workspace-path"
    ) {
      workspacePath =
        args[index + 1];

      if (
        !workspacePath
      ) {
        throw new Error(
          `${arg} requires a workspace path`
        );
      }

      index += 1;
      continue;
    }

    if (
      arg === "--format"
    ) {
      const requestedFormat =
        args[index + 1];

      if (
        requestedFormat !== "json" &&
        requestedFormat !== "text"
      ) {
        throw new Error(
          "--format requires json or text"
        );
      }

      format =
        requestedFormat;

      index += 1;
      continue;
    }

    if (
      arg.startsWith("--format=")
    ) {
      const requestedFormat =
        arg.slice(
          "--format=".length
        );

      if (
        requestedFormat !== "json" &&
        requestedFormat !== "text"
      ) {
        throw new Error(
          "--format requires json or text"
        );
      }

      format =
        requestedFormat;

      continue;
    }

    if (
      arg.startsWith("workspace=")
    ) {
      workspacePath =
        arg.slice(
          "workspace=".length
        );

      continue;
    }

    if (
      !inputPath
    ) {
      inputPath =
        arg;

      continue;
    }

    if (
      !workspacePath
    ) {
      workspacePath =
        arg;
    }
  }

  return {
    inputPath:
      inputPath ?? ".",

    workspacePath,

    format
  };
}


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
): Promise<ScanExecution> {
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
   * 6. Discover and run project validation
   */
  const validationPlan =
    await discoverValidationPlan(
      projectPath
    );

  const validationReport =
    await validateProject(
      projectPath,
      validationPlan.commands,
      validationPlan.packageManager,
      validationPlan.configuration
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


  const result: ScanResult = {
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

      warningCount:
        validationReport.results.filter(
          result =>
            result.status === "warning"
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

  return {
    result,
    validationReport
  };
}

function createJsonOutput(
  execution: ScanExecution
): JsonScanOutput {
  return {
    scan: {
      metadata: {
        schemaVersion:
          "1.0.0",
        generatedAt:
          execution.result.completedAt,
        format:
          "json"
      },
      project: {
        path:
          execution.result.projectPath,
        filesScanned:
          execution.result.filesScanned,
        structure:
          execution.result.projectStructure
      },
      technologyProfile:
        execution.result.technologyProfile,
      validation:
        execution.validationReport,
      findings:
        execution.validationReport.findings,
      summary:
        execution.result.validation ?? {
          passed:
            false,
          total:
            0,
          passedCount:
            0,
          failedCount:
            0,
          warningCount:
            0,
          skippedCount:
            0
        }
    }
  };
}

async function withConsoleSilenced<T>(
  callback: () => Promise<T>
): Promise<T> {
  const originalLog =
    console.log;

  console.log =
    () => undefined;

  try {
    return await callback();
  } finally {
    console.log =
      originalLog;
  }
}


async function main(): Promise<void> {
  const cliOptions =
    parseCliOptions(
      process.argv.slice(2)
    );


  /*
   * IMPORTANT:
   * Resolve the path from the repository root,
   * not from apps/scanner.
   */
  const rootProjectPath =
    await resolveProjectPath(
      cliOptions.inputPath
    );

  const projectPath =
    cliOptions.workspacePath
      ? await resolveWorkspaceProjectPath(
          rootProjectPath,
          cliOptions.workspacePath
        )
      : rootProjectPath;

  const displayInput =
    cliOptions.workspacePath
      ? `${cliOptions.inputPath} --workspace ${cliOptions.workspacePath}`
      : cliOptions.inputPath;

  const relativeWorkspacePath =
    cliOptions.workspacePath
      ? path.relative(
          rootProjectPath,
          projectPath
        )
      : undefined;

  if (
    cliOptions.format === "json"
  ) {
    const execution =
      await withConsoleSilenced(
        () =>
          scanProject(
            projectPath,
            [
              universalTechnologyPlugin
            ]
          )
      );

    console.log(
      JSON.stringify(
        createJsonOutput(
          execution
        ),
        null,
        2
      )
    );

    return;
  }


  console.log(
    "🔎 CodeSentinel Scanner"
  );

  console.log(
    "======================"
  );

  console.log(
    `Input: ${displayInput}`
  );

  if (
    relativeWorkspacePath
  ) {
    console.log(
      `Workspace: ${relativeWorkspacePath}`
    );
  }

  console.log(
    `Resolved Project: ${projectPath}`
  );

  console.log("");


  const execution =
    await scanProject(
      projectPath,
      [
        universalTechnologyPlugin
      ]
    );

  const result =
    execution.result;

  console.log(
    `Summary: ${result.validation?.passed ? "passed" : "failed"}`
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

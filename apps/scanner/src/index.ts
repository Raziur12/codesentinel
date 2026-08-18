import fs from "node:fs/promises";
import path from "node:path";

import {
  discoverValidationPlan,
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
  resolveProjectPath,
  resolveWorkspaceProjectPath
} from "./path-resolver.js";

import {
  ConsoleReporter,
  JsonReporter
} from "./reporters/index.js";

import type {
  ScanExecution
} from "./reporters/index.js";

interface CliOptions {
  inputPath: string;

  workspacePath?: string;

  format: "text" | "json";
}

const EXIT_VALIDATION_PASSED =
  0;

const EXIT_VALIDATION_FAILED =
  1;

const EXIT_SCANNER_ERROR =
  2;

const EXIT_INVALID_INPUT =
  3;

class InvalidInputError extends Error {
  constructor(
    message: string
  ) {
    super(message);
    this.name =
      "InvalidInputError";
  }
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
        throw new InvalidInputError(
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
        throw new InvalidInputError(
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
        throw new InvalidInputError(
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


function getValidationExitCode(
  execution: ScanExecution
): number {
  return execution.validationReport.passed
    ? EXIT_VALIDATION_PASSED
    : EXIT_VALIDATION_FAILED;
}

function getErrorExitCode(
  error: unknown
): number {
  if (
    error instanceof InvalidInputError
  ) {
    return EXIT_INVALID_INPUT;
  }

  if (
    error instanceof Error &&
    (
      error.message.includes("Project directory does not exist") ||
      error.message.includes("Project path is not a directory") ||
      error.message.includes("Workspace path must be inside project root") ||
      error.message.includes("requires a workspace path")
    )
  ) {
    return EXIT_INVALID_INPUT;
  }

  return EXIT_SCANNER_ERROR;
}

async function main(): Promise<number> {
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
    const reporter =
      new JsonReporter();

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

    reporter.write(
      execution
    );

    return getValidationExitCode(
      execution
    );
  }



  const reporter =
    new ConsoleReporter();

  reporter.start({
    displayInput,
    projectPath,
    workspacePath:
      relativeWorkspacePath
  });


  const execution =
    await scanProject(
      projectPath,
      [
        universalTechnologyPlugin
      ]
    );

  reporter.complete(
    execution
  );

  return getValidationExitCode(
    execution
  );
}


main()
  .then(
    exitCode => {
      process.exitCode =
        exitCode;
    }
  )
  .catch(
    (error) => {
      const exitCode =
        getErrorExitCode(
          error
        );

    console.error(
      "Scanner failed:"
    );

    console.error(error);

      process.exitCode =
        exitCode;
    }
  );

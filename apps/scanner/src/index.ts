import fs from "node:fs/promises";
import path from "node:path";

import {
  discoverValidationPlan,
  validateProject
} from "@codesentinel/validation-engine";

import {
  analyzeDependencies,
  analyzeProject
} from "@codesentinel/project-analyzer";

import {
  calculateProjectHealthScore,
  createAiAnalysisInput,
  createAiProvider,
  deduplicateDetections,
  createTechnologyProfile
} from "@codesentinel/scanner-core";

import type {
  AiFixMode,
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

  fix: boolean;

  dryRun: boolean;

  interactive: boolean;

  aiProvider: string;
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

  let fix =
    false;

  let dryRun =
    false;

  let interactive =
    false;

  let aiProvider =
    "local-deterministic";

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    const arg =
      args[index];

    if (
      arg === "--fix"
    ) {
      fix =
        true;
      continue;
    }

    if (
      arg === "--dry-run"
    ) {
      dryRun =
        true;
      continue;
    }

    if (
      arg === "--interactive"
    ) {
      interactive =
        true;
      continue;
    }

    if (
      arg === "--ai-provider"
    ) {
      aiProvider =
        args[index + 1];

      if (
        !aiProvider
      ) {
        throw new InvalidInputError(
          "--ai-provider requires a provider id"
        );
      }

      index += 1;
      continue;
    }

    if (
      arg.startsWith("--ai-provider=")
    ) {
      aiProvider =
        arg.slice(
          "--ai-provider=".length
        );

      continue;
    }

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

    format,

    fix,

    dryRun,

    interactive,

    aiProvider
  };
}

function getAiFixMode(
  options: Pick<CliOptions, "fix" | "dryRun" | "interactive">
): AiFixMode {
  if (
    options.interactive
  ) {
    return "interactive";
  }

  if (
    options.dryRun
  ) {
    return "dry-run";
  }

  if (
    options.fix
  ) {
    return "suggestion-only";
  }

  return "suggestion-only";
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
  plugins: ScannerPlugin[],
  options: Pick<CliOptions, "fix" | "dryRun" | "interactive" | "aiProvider"> = {
    fix:
      false,
    dryRun:
      false,
    interactive:
      false,
    aiProvider:
      "local-deterministic"
  }
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

  const dependencyAnalysis =
    await analyzeDependencies(
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

  const health =
    calculateProjectHealthScore({
      projectStructure,
      dependencyAnalysis,
      validation:
        validationReport
    });

  const completedAt =
    new Date().toISOString();

  const validationSummary = {
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
  };

  const ai =
    createAiAnalysisInput({
      projectPath,
      filesScanned:
        files.length,
      projectStructure,
      technologyProfile,
      dependencyAnalysis,
      health,
      validation:
        validationSummary,
      findings:
        validationReport.findings,
      warnings:
        validationReport.warnings,
      generatedAt:
        completedAt
    });

  const aiProvider =
    createAiProvider(
      options.aiProvider
    );

  const aiRootCause =
    await aiProvider.analyzeFindings(
      ai
    );

  const aiFixSuggestions =
    await aiProvider.suggestFix(
      aiRootCause,
      getAiFixMode(
        options
      )
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
   * Save dependency analysis
   */
  await fs.writeFile(
    path.join(
      outputDirectory,
      "dependency-analysis.json"
    ),
    JSON.stringify(
      dependencyAnalysis,
      null,
      2
    ),
    "utf8"
  );


  /*
   * Save health score
   */
  await fs.writeFile(
    path.join(
      outputDirectory,
      "health-score.json"
    ),
    JSON.stringify(
      health,
      null,
      2
    ),
    "utf8"
  );


  /*
   * Save AI analysis input
   */
  await fs.writeFile(
    path.join(
      outputDirectory,
      "ai-analysis-input.json"
    ),
    JSON.stringify(
      ai,
      null,
      2
    ),
    "utf8"
  );


  /*
   * Save AI root-cause analysis
   */
  await fs.writeFile(
    path.join(
      outputDirectory,
      "ai-root-cause-analysis.json"
    ),
    JSON.stringify(
      aiRootCause,
      null,
      2
    ),
    "utf8"
  );


  /*
   * Save AI fix suggestions
   */
  await fs.writeFile(
    path.join(
      outputDirectory,
      "ai-fix-suggestions.json"
    ),
    JSON.stringify(
      aiFixSuggestions,
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
  const result: ScanResult = {
    projectPath,
    filesScanned: files.length,
    projectStructure,
    technologies,
    technologyProfile,
    dependencyAnalysis,
    health,
    ai,
    aiRootCause,
    aiFixSuggestions,
    aiProvider:
      {
        id:
          aiProvider.id,
        name:
          aiProvider.name
      },

    validation:
      validationSummary,

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
            ],
            cliOptions
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
      ],
      cliOptions
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

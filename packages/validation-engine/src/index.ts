import { spawn } from "node:child_process";
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Validation status.
 */
export type ValidationStatus =
  | "passed"
  | "warning"
  | "failed"
  | "skipped";

/**
 * Validation severity.
 */
export type ValidationSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

/**
 * Validation category.
 */
export type ValidationCategory =
  | "build"
  | "test"
  | "lint"
  | "type-check"
  | "dependency"
  | "configuration";

/**
 * Validation command definition.
 */
export interface ValidationCommand {
  name: string;

  command: string;

  args: string[];

  executable: string;

  available: boolean;

  category: ValidationCategory;

  priority: number;

  skipReason?: string;
}

/**
 * Structured validation finding.
 */
export interface ValidationFinding {
  type: "validation";

  severity: ValidationSeverity;

  category: ValidationCategory;

  title: string;

  message: string;

  command: string;

  exitCode: number | null;

  evidence?: string;

  file?: string;

  line?: number;

  column?: number;

  code?: string;

  suggestion?: string;
}

/**
 * Result of one validation command.
 *
 * A command can produce multiple findings.
 */
export interface ValidationResult {
  name: string;

  command: string;

  status: ValidationStatus;

  category: ValidationCategory;

  exitCode: number | null;

  stdout: string;

  stderr: string;

  durationMs: number;

  findings?: ValidationFinding[];

  warnings?: ValidationFinding[];

  skipReason?: string;
}

interface PackageJson {
  scripts?: Record<string, string>;

  packageManager?: string;

  workspaces?: string[] | {
    packages?: string[];
  };
}

export interface ValidationPlan {
  packageManager: string;

  commands: ValidationCommand[];

  workspaces: string[];
}

/**
 * Complete validation report.
 */
export interface ValidationReport {
  projectPath: string;

  packageManager: string;

  results: ValidationResult[];

  findings: ValidationFinding[];

  warnings: ValidationFinding[];

  passed: boolean;

  startedAt: string;

  completedAt: string;
}

/**
 * Parsed TypeScript compiler error.
 *
 * Example:
 *
 * app.ts(1,7): error TS2322:
 * Type 'number' is not assignable to type 'string'.
 */
interface ParsedTypeScriptError {
  file: string;

  line: number;

  column: number;

  code: string;

  message: string;
}

/**
 * Parsed warning coming from the
 * package manager / runtime / engine.
 *
 * Example:
 *
 * npm warn EBADENGINE Unsupported engine {
 *   package: 'vite@7.3.6',
 *   required: { node: '^20.19.0 || >=22.12.0' },
 *   current: { node: 'v18.20.8', npm: '10.8.2' }
 * }
 */
interface ParsedEngineWarning {
  packageName?: string;

  packageVersion?: string;

  requiredNode?: string;

  currentNode?: string;

  currentNpm?: string;

  message: string;
}

/**
 * Create an actionable suggestion
 * for a parsed engine warning.
 */
function createEngineWarningSuggestion(
  warning: ParsedEngineWarning
): string {
  if (
    warning.requiredNode
  ) {
    return (
      `Upgrade Node.js to a supported version: ${warning.requiredNode}.`
    );
  }

  return (
    "Check the package engine requirements and use a compatible Node.js version."
  );
}

/**
 * Convert command + arguments into
 * a human-readable command string.
 *
 * Example:
 *
 * npm + ["run", "build"]
 *
 * becomes:
 *
 * npm run build
 */
function getCommandText(
  validationCommand: ValidationCommand
): string {
  return [
    validationCommand.command,
    ...validationCommand.args
  ].join(" ");
}

async function fileExists(
  filePath: string
): Promise<boolean> {
  try {
    const stats =
      await fs.stat(filePath);

    return stats.isFile();
  } catch {
    return false;
  }
}

async function readPackageJson(
  projectPath: string
): Promise<PackageJson | null> {
  const packageJsonPath =
    path.join(
      projectPath,
      "package.json"
    );

  if (
    !(await fileExists(packageJsonPath))
  ) {
    return null;
  }

  try {
    const content =
      await fs.readFile(
        packageJsonPath,
        "utf8"
      );

    return JSON.parse(
      content
    ) as PackageJson;
  } catch {
    return null;
  }
}

function getWorkspacePatterns(
  packageJson: PackageJson | null
): string[] {
  if (
    !packageJson?.workspaces
  ) {
    return [];
  }

  if (
    Array.isArray(
      packageJson.workspaces
    )
  ) {
    return packageJson.workspaces;
  }

  return packageJson.workspaces.packages ?? [];
}

function detectPackageManager(
  packageJson: PackageJson | null
): string {
  const declaredManager =
    packageJson?.packageManager?.split("@")[0];

  if (
    declaredManager
  ) {
    return declaredManager;
  }

  return "npm";
}

function createCommand(
  name: string,
  category: ValidationCategory,
  priority: number,
  command: string,
  args: string[],
  available = true,
  skipReason?: string
): ValidationCommand {
  return {
    name,
    command,
    args,
    executable:
      command,
    available,
    category,
    priority,
    skipReason
  };
}

async function hasWorkspaceScript(
  projectPath: string,
  workspacePatterns: string[],
  scriptName: string
): Promise<boolean> {
  for (
    const workspacePattern
    of workspacePatterns
  ) {
    const normalizedPattern =
      workspacePattern.replace(/\\/g, "/");

    if (
      !normalizedPattern.endsWith("/*")
    ) {
      continue;
    }

    const parentDirectory =
      path.join(
        projectPath,
        normalizedPattern.slice(0, -2)
      );

    let entries:
      | Dirent[];

    try {
      entries =
        await fs.readdir(
          parentDirectory,
          {
            withFileTypes: true
          }
        );
    } catch {
      continue;
    }

    for (
      const entry
      of entries
    ) {
      if (
        !entry.isDirectory()
      ) {
        continue;
      }

      const workspacePackageJson =
        await readPackageJson(
          path.join(
            parentDirectory,
            entry.name
          )
        );

      if (
        workspacePackageJson?.scripts?.[scriptName]
      ) {
        return true;
      }
    }
  }

  return false;
}

async function createScriptCommand(
  name: string,
  category: ValidationCategory,
  priority: number,
  packageManager: string,
  scriptName: string,
  scripts: Record<string, string> | undefined,
  projectPath: string,
  workspacePatterns: string[]
): Promise<ValidationCommand> {
  if (
    scripts?.[scriptName]
  ) {
    const isWorkspaceFanOut =
      scripts[scriptName].includes("--workspaces") ||
      scripts[scriptName].includes("-ws");

    if (
      isWorkspaceFanOut &&
      !(await hasWorkspaceScript(
        projectPath,
        workspacePatterns,
        scriptName
      ))
    ) {
      return createCommand(
        name,
        category,
        priority,
        packageManager,
        ["run", scriptName],
        false,
        `No workspace ${scriptName} script found`
      );
    }

    return createCommand(
      name,
      category,
      priority,
      packageManager,
      ["run", scriptName]
    );
  }

  return createCommand(
    name,
    category,
    priority,
    packageManager,
    ["run", scriptName],
    false,
    `No ${scriptName} script found`
  );
}

async function findTypeScriptConfig(
  projectPath: string
): Promise<string | null> {
  const entries =
    await fs.readdir(
      projectPath,
      {
        withFileTypes: true
      }
    );

  const configNames =
    entries
      .filter(
        entry =>
          entry.isFile() &&
          /^tsconfig(?:\..+)?\.json$/i.test(
            entry.name
          )
      )
      .map(
        entry =>
          entry.name
      )
      .sort();

  return configNames[0] ?? null;
}

export async function discoverValidationPlan(
  projectPath: string
): Promise<ValidationPlan> {
  const packageJson =
    await readPackageJson(
      projectPath
    );

  const packageManager =
    detectPackageManager(
      packageJson
    );

  const scripts =
    packageJson?.scripts;

  const workspaces =
    getWorkspacePatterns(
      packageJson
    );

  const tsconfig =
    await findTypeScriptConfig(
      projectPath
    );

  const installCommand =
    packageJson
      ? createCommand(
          "Install dependencies",
          "dependency",
          10,
          packageManager,
          ["install"]
        )
      : createCommand(
          "Install dependencies",
          "dependency",
          10,
          packageManager,
          ["install"],
          false,
          "No package.json found"
        );

  const typeCheckCommand =
    tsconfig
      ? createCommand(
          "Type Check",
          "type-check",
          50,
          "npx",
          [
            "tsc",
            "--noEmit",
            "-p",
            tsconfig
          ]
        )
      : createCommand(
          "Type Check",
          "type-check",
          50,
          "npx",
          [
            "tsc",
            "--noEmit",
            "-p",
            "tsconfig.json"
          ],
          false,
          "No TypeScript config found"
        );

  return {
    packageManager,
    workspaces,
    commands: [
      installCommand,
      await createScriptCommand(
        "Build",
        "build",
        20,
        packageManager,
        "build",
        scripts,
        projectPath,
        workspaces
      ),
      await createScriptCommand(
        "Test",
        "test",
        30,
        packageManager,
        "test",
        scripts,
        projectPath,
        workspaces
      ),
      await createScriptCommand(
        "Lint",
        "lint",
        40,
        packageManager,
        "lint",
        scripts,
        projectPath,
        workspaces
      ),
      typeCheckCommand
    ]
  };
}

/**
 * Detect the validation category
 * from the command name.
 */
function getValidationCategory(
  commandName: string
): ValidationCategory {
  const name =
    commandName.toLowerCase();

  if (
    name.includes("install") ||
    name.includes("dependency")
  ) {
    return "dependency";
  }

  if (
    name.includes("type") ||
    name.includes("typecheck") ||
    name.includes("type-check")
  ) {
    return "type-check";
  }

  if (
    name.includes("build")
  ) {
    return "build";
  }

  if (
    name.includes("test")
  ) {
    return "test";
  }

  if (
    name.includes("lint")
  ) {
    return "lint";
  }

  return "configuration";
}

/**
 * Decide severity based on
 * validation category.
 */
function getValidationSeverity(
  category: ValidationCategory
): ValidationSeverity {
  switch (
    category
  ) {
    case "dependency":
      return "high";

    case "build":
      return "high";

    case "type-check":
      return "high";

    case "test":
      return "medium";

    case "lint":
      return "low";

    case "configuration":
      return "medium";

    default:
      return "medium";
  }
}

function parseTypeScriptErrors(
  output: string
): ParsedTypeScriptError[] {
  const errors: ParsedTypeScriptError[] = [];

  const regex =
    /(?:^|\r?\n)(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+?)(?=\r?\n|$)/g;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(output)) !== null
  ) {
    errors.push({
      file: match[1].trim(),

      line:
        Number(match[2]),

      column:
        Number(match[3]),

      code:
        match[4],

      message:
        match[5].trim()
    });
  }

  return errors;
}



function createTypeScriptSuggestion(
  error: ParsedTypeScriptError
): string {
  if (
    error.code === "TS2322"
  ) {
    return (
      "Check the value type and variable type. " +
      "Make sure the assigned value matches the expected TypeScript type."
    );
  }

  if (
    error.code === "TS2339"
  ) {
    return (
      "Check whether the property or method exists on the current type. " +
      "Verify the object type and property name."
    );
  }

  if (
    error.code === "TS2304"
  ) {
    return (
      "Check whether the referenced name is declared, imported, or spelled correctly."
    );
  }

  return (
    "Review the TypeScript error and update the code so the types and declarations match."
  );
}

/**
 * Parse Node/npm engine warnings.
 *
 * Example:
 *
 * npm warn EBADENGINE Unsupported engine {
 *   package: 'vite@7.3.6',
 *   required: { node: '^20.19.0 || >=22.12.0' },
 *   current: { node: 'v18.20.8', npm: '10.8.2' }
 * }
 */
function parseEngineWarning(
  output: string
): ParsedEngineWarning | null {
  if (
    !output.includes("EBADENGINE") &&
    !output
      .toLowerCase()
      .includes("unsupported engine")
  ) {
    return null;
  }

  const packageMatch =
    output.match(
      /package:\s*['"]([^'"]+)['"]/i
    );

  const requiredNodeMatch =
    output.match(
      /required:\s*\{\s*node:\s*['"]([^'"]+)['"]/i
    );

  const currentNodeMatch =
    output.match(
      /current:\s*\{\s*node:\s*['"]([^'"]+)['"],\s*npm:\s*['"]([^'"]+)['"]\s*\}/i
    );

  const packageNameAndVersion =
    packageMatch?.[1];

  let packageName:
    | string
    | undefined;

  let packageVersion:
    | string
    | undefined;

  if (
    packageNameAndVersion
  ) {
    const packageParts =
      packageNameAndVersion.match(
        /^(.+?)@([^@]+)$/
      );

    if (
      packageParts
    ) {
      packageName =
        packageParts[1];

      packageVersion =
        packageParts[2];
    } else {
      packageName =
        packageNameAndVersion;
    }
  }

  return {
    packageName,

    packageVersion,

    requiredNode:
      requiredNodeMatch?.[1],

    currentNode:
      currentNodeMatch?.[1],

    currentNpm:
      currentNodeMatch?.[2],

    message:
      "Package engine requirement does not match the current Node.js environment."
  };
}

/**
 * Create structured findings
 * whenever a validation command fails.
 *
 * One command may produce multiple findings.
 */
function createFailureFindings(
  validationCommand: ValidationCommand,
  exitCode: number | null,
  stdout: string,
  stderr: string
): ValidationFinding[] {
  const command =
    getCommandText(
      validationCommand
    );

  const category =
    validationCommand.category;

  const severity =
    getValidationSeverity(
      category
    );

  /**
   * Prefer stderr because compiler,
   * lint and runtime errors usually
   * appear there.
   *
   * If stderr is empty, use stdout.
   */
  const output =
    stderr.trim() ||
    stdout.trim() ||
    "Command failed without output.";

  /**
   * Parse ALL TypeScript errors.
   */
  const parsedTypeScriptErrors =
    parseTypeScriptErrors(
      output
    );

  /**
   * Build/type-check commands
   * can contain multiple TypeScript errors.
   */
  if (
    (
      category === "build" ||
      category === "type-check"
    ) &&
    parsedTypeScriptErrors.length > 0
  ) {
    return parsedTypeScriptErrors.map(
      (
        error
      ): ValidationFinding => ({
        type:
          "validation",

        severity,

        category,

        title:
          "TypeScript error",

        message:
          error.message,

        command,

        exitCode,

        evidence:
          `${error.file}(${error.line},${error.column}) [${error.code}]`,

        file:
          error.file,

        line:
          error.line,

        column:
          error.column,

        code:
          error.code,

        suggestion:
          createTypeScriptSuggestion(
            error
          )
      })
    );
  }

  /**
   * Check for Node/npm engine
   * compatibility warnings.
   */
  const parsedEngineWarning =
    parseEngineWarning(
      output
    );

  if (
    parsedEngineWarning
  ) {
    let engineMessage =
      parsedEngineWarning.message;

    if (
      parsedEngineWarning.packageName
    ) {
      engineMessage +=
        ` Package: ${parsedEngineWarning.packageName}`;

      if (
        parsedEngineWarning.packageVersion
      ) {
        engineMessage +=
          `@${parsedEngineWarning.packageVersion}`;
      }
    }

    if (
      parsedEngineWarning.requiredNode
    ) {
      engineMessage +=
        ` requires Node.js ${parsedEngineWarning.requiredNode}.`;
    }

    if (
      parsedEngineWarning.currentNode
    ) {
      engineMessage +=
        ` Current Node.js version is ${parsedEngineWarning.currentNode}.`;
    }

    return [
      {
        type:
          "validation",

        severity:
          "medium",

        category,

        title:
          "Node.js engine warning",

        message:
          engineMessage,

        command,

        exitCode,

        evidence:
          output,

        code:
          "EBADENGINE",

        suggestion:
          createEngineWarningSuggestion(
            parsedEngineWarning
          )
      }
    ];
  }

  /**
   * Generic validation failure.
   */
  return [
    {
      type:
        "validation",

      severity,

      category,

      title:
        `${validationCommand.name} failed`,

      message:
        `The ${validationCommand.name.toLowerCase()} command failed.`,

      command,

      exitCode,

      evidence:
        output
    }
  ];
}

/**
 * Create a stable key for a validation finding.
 *
 * The command is intentionally excluded.
 *
 * This allows:
 *
 * npm run build
 *
 * and:
 *
 * npx tsc --noEmit
 *
 * to be treated as the same logical finding.
 */
function getFindingKey(
  finding: ValidationFinding
): string {
  return [
    finding.code ?? "",
    finding.file ?? "",
    finding.line ?? "",
    finding.column ?? "",
    finding.message.trim()
  ].join("|");
}

/**
 * Remove duplicate validation findings.
 */
function deduplicateFindings(
  findings: ValidationFinding[]
): ValidationFinding[] {
  const uniqueFindings =
    new Map<
      string,
      ValidationFinding
    >();

  for (
    const finding
    of findings
  ) {
    const key =
      getFindingKey(
        finding
      );

    console.log(
      `🔑 Finding Key: ${key}`
    );

    if (
      !uniqueFindings.has(
        key
      )
    ) {
      uniqueFindings.set(
        key,
        finding
      );
    }
  }

  const result =
    Array.from(
      uniqueFindings.values()
    );

  console.log(
    `🔎 Deduplication: ${findings.length} → ${result.length}`
  );

  return result;
}

/**
 * Create a skipped validation result.
 */
function createSkippedResult(
  validationCommand: ValidationCommand
): ValidationResult {
  const skipReason =
    validationCommand.skipReason ??
    "Validation command is not available";

  return {
    name:
      validationCommand.name,

    command:
      getCommandText(
        validationCommand
      ),

    status:
      "skipped",

    category:
      validationCommand.category,

    exitCode:
      null,

    stdout:
      "",

    stderr:
      "",

    durationMs:
      0,

    findings:
      [],

    warnings:
      [],

    skipReason
  };
}

/**
 * Execute one validation command.
 */
function runCommand(
  projectPath: string,
  validationCommand: ValidationCommand
): Promise<ValidationResult> {
  return new Promise(
    (resolve) => {
      const started =
        Date.now();

      const isWindows =
        process.platform ===
        "win32";

      /**
       * On Windows npm is executed
       * through npm.cmd.
       */
      const executable =
        isWindows
          ? `${validationCommand.command}.cmd`
          : validationCommand.command;

      console.log(
        `Executable: ${executable}`
      );

      /**
       * shell:true is important for
       * Windows/Git Bash compatibility.
       */
      const child =
        spawn(
          executable,

          validationCommand.args,

          {
            cwd:
              projectPath,

            shell:
              isWindows,

            windowsHide:
              true,

            stdio: [
              "ignore",
              "pipe",
              "pipe"
            ]
          }
        );

      let stdout =
        "";

      let stderr =
        "";

      /**
       * Capture stdout.
       */
      child.stdout?.on(
        "data",
        (data) => {
          stdout +=
            data.toString();
        }
      );

      /**
       * Capture stderr.
       */
      child.stderr?.on(
        "data",
        (data) => {
          stderr +=
            data.toString();
        }
      );

      /**
       * Command completed.
       */
      child.on(
        "close",
        (exitCode) => {
          const status:
            ValidationStatus =
            exitCode === 0
              ? "passed"
              : "failed";

          const result:
            ValidationResult = {
            name:
              validationCommand.name,

            command:
              getCommandText(
                validationCommand
              ),

            status,

            category:
              validationCommand.category,

            exitCode,

            stdout,

            stderr,

            durationMs:
              Date.now() -
              started,

            findings:
              [],

            warnings:
              []
          };

          /**
           * Combine stdout and stderr
           * because warnings may appear
           * in either stream.
           */
          const combinedOutput =
            `${stdout}\n${stderr}`;

          /**
           * Detect Node/npm engine warning
           * even when command succeeds.
           */
          const parsedEngineWarning =
            parseEngineWarning(
              combinedOutput
            );

          if (
            parsedEngineWarning
          ) {
            let engineMessage =
              parsedEngineWarning.message;

            if (
              parsedEngineWarning.packageName
            ) {
              engineMessage +=
                ` Package: ${parsedEngineWarning.packageName}`;

              if (
                parsedEngineWarning.packageVersion
              ) {
                engineMessage +=
                  `@${parsedEngineWarning.packageVersion}`;
              }
            }

            if (
              parsedEngineWarning.requiredNode
            ) {
              engineMessage +=
                ` Required Node.js: ${parsedEngineWarning.requiredNode}.`;
            }

            if (
              parsedEngineWarning.currentNode
            ) {
              engineMessage +=
                ` Current Node.js: ${parsedEngineWarning.currentNode}.`;
            }

            const warningFinding:
              ValidationFinding = {
              type:
                "validation",

              severity:
                "medium",

              category:
                validationCommand.category,

              title:
                "Node.js engine warning",

              message:
                engineMessage,

              command:
                getCommandText(
                  validationCommand
                ),

              exitCode,

              evidence:
                combinedOutput.trim(),

              code:
                "EBADENGINE",

              suggestion:
                createEngineWarningSuggestion(
                  parsedEngineWarning
                )
            };

            result.warnings?.push(
              warningFinding
            );
          }

          if (
            status === "passed" &&
            result.warnings &&
            result.warnings.length > 0
          ) {
            result.status =
              "warning";
          }

          /**
           * If command failed,
           * attach structured findings.
           */
          if (
            status ===
            "failed"
          ) {
            result.findings =
              createFailureFindings(
                validationCommand,
                exitCode,
                stdout,
                stderr
              );
          }

          resolve(
            result
          );
        }
      );

      /**
       * Process could not start.
       */
      child.on(
        "error",
        (error) => {
          const errorOutput =
            stderr +
            "\n" +
            error.message;

          const result:
            ValidationResult = {
            name:
              validationCommand.name,

            command:
              getCommandText(
                validationCommand
              ),

            status:
              "failed",

            category:
              validationCommand.category,

            exitCode:
              null,

            stdout,

            stderr:
              errorOutput,

            durationMs:
              Date.now() -
              started,

            findings:
              [],

            warnings:
              []
          };

          result.findings =
            createFailureFindings(
              validationCommand,
              null,
              stdout,
              errorOutput
            );

          resolve(
            result
          );
        }
      );
    }
  );
}

/**
 * Run all validations for a project.
 */
export async function validateProject(
  projectPath: string,
  commands: ValidationCommand[],
  packageManager = "npm"
): Promise<ValidationReport> {
  const startedAt =
    new Date().toISOString();

  const results:
    ValidationResult[] = [];

  const findings:
    ValidationFinding[] = [];

  const warnings:
    ValidationFinding[] = [];

  /**
   * Run every validation command.
   */
  for (
    const validationCommand
    of commands
  ) {
    console.log("");

    if (
      validationCommand.available ===
      false
    ) {
      const result =
        createSkippedResult(
          validationCommand
        );

      results.push(
        result
      );

      console.log(
        `⏭️ Skipped ${result.name}: ${result.skipReason}`
      );

      continue;
    }

    console.log(
      `▶ Running command: ${getCommandText(validationCommand)}`
    );

    /**
     * Run command.
     */
    const result =
      await runCommand(
        projectPath,
        validationCommand
      );

    /**
     * Store result.
     */
    results.push(
      result
    );

    /**
     * Collect findings.
     */
    if (
      result.findings &&
      result.findings.length > 0
    ) {
      findings.push(
        ...result.findings
      );
    }

    /**
     * Collect warnings.
     */
    if (
      result.warnings &&
      result.warnings.length > 0
    ) {
      warnings.push(
        ...result.warnings
      );
    }

    /**
     * Print status.
     */
    if (
      result.status ===
      "passed"
    ) {
      console.log(
        `✅ ${result.name}`
      );
    }

    if (
      result.status ===
      "warning"
    ) {
      console.log(
        `⚠️ ${result.name}`
      );
    }

    if (
      result.status ===
      "failed"
    ) {
      console.log(
        `❌ ${result.name}`
      );

      /**
       * Print every finding
       * generated by this command.
       */
      if (
        result.findings &&
        result.findings.length > 0
      ) {
        for (
          const finding
          of result.findings
        ) {
          console.log("");

          console.log(
            `Severity: ${finding.severity}`
          );

          console.log(
            `Category: ${finding.category}`
          );

          console.log(
            `Finding: ${finding.title}`
          );

          console.log(
            `Message: ${finding.message}`
          );

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

          if (
            finding.suggestion
          ) {
            console.log(
              `💡 Suggested Fix: ${finding.suggestion}`
            );
          }
        }
      }
    }

    /**
     * Print warnings.
     */
    if (
      result.warnings &&
      result.warnings.length > 0
    ) {
      for (
        const warning
        of result.warnings
      ) {
        console.log("");

        console.log(
          `⚠️ ${warning.title}`
        );

        console.log(
          warning.message
        );

        if (
          warning.suggestion
        ) {
          console.log(
            `💡 Suggested Fix: ${warning.suggestion}`
          );
        }
      }
    }

    /**
     * Print stdout.
     */
    if (
      result.stdout.trim()
    ) {
      console.log("");

      console.log(
        "STDOUT:"
      );

      console.log(
        result.stdout.trim()
      );
    }

    /**
     * Print stderr.
     */
    if (
      result.stderr.trim()
    ) {
      console.log("");

      console.log(
        "STDERR:"
      );

      console.log(
        result.stderr.trim()
      );
    }
  }

  /**
   * Remove duplicate findings.
   */
  const uniqueFindings =
    deduplicateFindings(
      findings
    );

  /**
   * Remove duplicate warnings.
   */
  const uniqueWarnings =
    deduplicateFindings(
      warnings
    );

  /**
   * Project is valid only when
   * there are no validation findings.
   */
  const passed =
    uniqueFindings.length ===
    0;

  const completedAt =
    new Date().toISOString();

  return {
    projectPath,

    packageManager,

    results,

    findings:
      uniqueFindings,

    warnings:
      uniqueWarnings,

    passed,

    startedAt,

    completedAt
  };
}

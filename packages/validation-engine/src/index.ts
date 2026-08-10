import { spawn } from "node:child_process";

export type ValidationStatus =
  | "passed"
  | "failed"
  | "skipped";

export type ValidationSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type ValidationCategory =
  | "build"
  | "test"
  | "lint"
  | "type-check"
  | "dependency"
  | "configuration";

export interface ValidationCommand {
  name: string;
  command: string;
  args: string[];
}

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
}

export interface ValidationResult {
  name: string;

  command: string;

  status: ValidationStatus;

  exitCode: number | null;

  stdout: string;

  stderr: string;

  durationMs: number;

  finding?: ValidationFinding;

  warnings?: ValidationFinding[];
}

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
 * Convert command + arguments into
 * a human-readable command string.
 *
 * Example:
 *
 * command = "npm"
 * args = ["run", "build"]
 *
 * Result:
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

  if (name.includes("build")) {
    return "build";
  }

  if (name.includes("test")) {
    return "test";
  }

  if (name.includes("lint")) {
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
  switch (category) {
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

/**
 * Parse TypeScript compiler errors.
 *
 * Supports:
 *
 * app.ts(1,7): error TS2322:
 * Type 'number' is not assignable to type 'string'.
 */
function parseTypeScriptError(
  output: string
): ParsedTypeScriptError | null {
  const match = output.match(
    /(?:^|\r?\n)(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+?)(?:\r?\n|$)/
  );

  if (!match) {
    return null;
  }

  return {
    file: match[1].trim(),

    line: Number(match[2]),

    column: Number(match[3]),

    code: match[4],

    message: match[5].trim()
  };
}

/**
 * Parse Node/npm engine warnings.
 *
 * Example:
 *
 * npm warn EBADENGINE Unsupported engine {
 * npm warn EBADENGINE   package: 'vite@7.3.6',
 * npm warn EBADENGINE   required: { node: '^20.19.0 || >=22.12.0' },
 * npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
 * npm warn EBADENGINE }
 */
function parseEngineWarning(
  output: string
): ParsedEngineWarning | null {
  if (
    !output.includes("EBADENGINE") &&
    !output.toLowerCase().includes("unsupported engine")
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

  if (packageNameAndVersion) {
    const packageParts =
      packageNameAndVersion.match(
        /^(.+?)@([^@]+)$/
      );

    if (packageParts) {
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
 * Create a structured finding
 * whenever a validation command fails.
 */
function createFailureFinding(
  validationCommand: ValidationCommand,
  exitCode: number | null,
  stdout: string,
  stderr: string
): ValidationFinding {
  const command =
    getCommandText(
      validationCommand
    );

  const category =
    getValidationCategory(
      validationCommand.name
    );

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
   * First try to detect TypeScript error.
   */
  const parsedTypeScriptError =
    parseTypeScriptError(
      output
    );

  /**
   * TypeScript build/type-check
   * gets a structured finding.
   */
  if (
    category === "build" ||
    category === "type-check"
  ) {
    const firstError =
      parsedTypeScriptError;

    if (firstError) {
      return {
        type: "validation",

        severity,

        category,

        title: "TypeScript error",

        message:
          firstError.message,

        command,

        exitCode,

        evidence:
          `${firstError.file}(${firstError.line},${firstError.column}) [${firstError.code}]`,

        file:
          firstError.file,

        line:
          firstError.line,

        column:
          firstError.column,

        code:
          firstError.code
      };
    }
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

    return {
      type: "validation",

      severity: "medium",

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
        "EBADENGINE"
    };
  }

  /**
   * Generic validation failure.
   */
  return {
    type: "validation",

    severity,

    category,

    title:
      parsedTypeScriptError
        ? "TypeScript error"
        : `${validationCommand.name} failed`,

    message:
      parsedTypeScriptError
        ? parsedTypeScriptError.message
        : `The ${validationCommand.name.toLowerCase()} command failed.`,

    command,

    exitCode,

    evidence:
      parsedTypeScriptError
        ? `${parsedTypeScriptError.file}(${parsedTypeScriptError.line},${parsedTypeScriptError.column}) [${parsedTypeScriptError.code}]`
        : output,

    file:
      parsedTypeScriptError?.file,

    line:
      parsedTypeScriptError?.line,

    column:
      parsedTypeScriptError?.column,

    code:
      parsedTypeScriptError?.code
  };
}

/**
 * Create a skipped validation result.
 *
 * We use:
 *
 * command = "__skip__"
 *
 * to represent validations that
 * are not available for a project.
 */
function createSkippedResult(
  validationCommand: ValidationCommand
): ValidationResult {
  return {
    name:
      validationCommand.name,

    command:
      getCommandText(
        validationCommand
      ),

    status: "skipped",

    exitCode: null,

    stdout: "",

    stderr: "",

    durationMs: 0
  };
}

/**
 * Execute one validation command.
 */
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
        process.platform === "win32";

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
            cwd: projectPath,

            shell: isWindows,

            windowsHide: true,

            stdio: [
              "ignore",
              "pipe",
              "pipe"
            ]
          }
        );

      let stdout = "";

      let stderr = "";

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
          const status =
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

            exitCode,

            stdout,

            stderr,

            durationMs:
              Date.now() - started,

            warnings: []
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
           * even when the command succeeded.
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
              type: "validation",

              severity: "medium",

              category:
                getValidationCategory(
                  validationCommand.name
                ),

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
                "EBADENGINE"
            };

            result.warnings?.push(
              warningFinding
            );
          }

          /**
           * If command failed,
           * attach a structured finding.
           */
          if (
            status === "failed"
          ) {
            result.finding =
              createFailureFinding(
                validationCommand,
                exitCode,
                stdout,
                stderr
              );
          }

          resolve(result);
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

            status: "failed",

            exitCode: null,

            stdout,

            stderr:
              errorOutput,

            durationMs:
              Date.now() - started,

            warnings: []
          };

          result.finding =
            createFailureFinding(
              validationCommand,
              null,
              stdout,
              errorOutput
            );

          resolve(result);
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

  /**
   * Findings are collected
   * from failed validations.
   */
  const findings:
    ValidationFinding[] = [];

  const warnings:
    ValidationFinding[] = [];

  /**
   * Run commands one by one.
   *
   * This is intentional.
   *
   * Example:
   *
   * npm install
   *      ↓
   * npm run build
   *      ↓
   * npm test
   *      ↓
   * npm run lint
   */
  for (
    const command of commands
  ) {
    console.log(
      `\n▶ Running command: ${command.command
      } ${command.args.join(" ")}`
    );

    /**
     * Special command:
     *
     * __skip__
     *
     * means this validation
     * should not be executed.
     */
    if (
      command.command ===
      "__skip__"
    ) {
      const result =
        createSkippedResult(
          command
        );

      results.push(result);

      console.log(
        `⏭ ${command.name}`
      );

      continue;
    }

    /**
     * Execute actual command.
     */
    const result =
      await runCommand(
        projectPath,
        command
      );

    /**
     * Save result.
     */
    results.push(result);

    /**
 * Collect warnings generated by
 * successful or failed commands.
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
     * Successful validation.
     */
    if (
      result.status ===
      "passed"
    ) {
      console.log(
        `✅ ${command.name}`
      );
    }

    /**
     * Failed validation.
     */
    else {
      console.log(
        `❌ ${command.name}`
      );

      /**
       * If a finding was generated,
       * save it in the report.
       */
      if (
        result.finding
      ) {
        findings.push(
          result.finding
        );

        console.log("");

        console.log(
          `Severity: ${result.finding.severity
          }`
        );

        console.log(
          `Category: ${result.finding.category
          }`
        );

        console.log(
          `Finding: ${result.finding.title
          }`
        );

        console.log(
          `Message: ${result.finding.message
          }`
        );

        /**
         * Print structured
         * source information.
         */
        if (
          result.finding.file
        ) {
          console.log(
            `File: ${result.finding.file
            }`
          );
        }

        if (
          result.finding.line
        ) {
          console.log(
            `Line: ${result.finding.line
            }`
          );
        }

        if (
          result.finding.column
        ) {
          console.log(
            `Column: ${result.finding.column
            }`
          );
        }

        if (
          result.finding.code
        ) {
          console.log(
            `Code: ${result.finding.code
            }`
          );
        }
      }

      /**
       * Print stderr.
       */
      if (
        result.stderr
      ) {
        console.log("");

        console.log(
          "STDERR:"
        );

        console.log(
          result.stderr
        );
      }

      /**
       * Print stdout.
       */
      if (
        result.stdout
      ) {
        console.log("");

        console.log(
          "STDOUT:"
        );

        console.log(
          result.stdout
        );
      }
    }
  }

  const completedAt =
    new Date().toISOString();

  /**
   * Project is valid when
   * every validation either
   *
   * passed OR
   * was skipped.
   */
  const passed =
    results.every(
      (result) =>
        result.status ===
        "passed" ||
        result.status ===
        "skipped"
    );

  return {
    projectPath,

    packageManager,

    results,

    findings,

    warnings,

    passed,

    startedAt,

    completedAt
  };
}
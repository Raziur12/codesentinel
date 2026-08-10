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

  suggestion?: string;
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
 * Create an actionable suggestion
 * for a TypeScript compiler error.
 */
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
          firstError.code,

        suggestion:
          createTypeScriptSuggestion(
            firstError
          )
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
        "EBADENGINE",

      suggestion:
        createEngineWarningSuggestion(
          parsedEngineWarning
        )
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
 * Create a stable key for a validation finding.
 *
 * Findings generated by different validation commands
 * may represent the same underlying problem.
 *
 * Example:
 *
 * npm run build
 * npx tsc --noEmit -p tsconfig.json
 *
 * Both can produce:
 *
 * app.ts(1,7) TS2322
 *
 * We treat them as one logical finding.
 */
function getFindingKey(
  finding: ValidationFinding
): string {
  return [
    finding.category,
    finding.code ?? "",
    finding.file ?? "",
    finding.line ?? "",
    finding.column ?? "",
    finding.message.trim()
  ].join("|");
}

/**
 * Remove duplicate validation findings.
 *
 * The same underlying issue can be reported by
 * multiple validations.
 *
 * Example:
 *
 * npm run build
 * npx tsc --noEmit
 *
 * Both may report:
 *
 * app.ts(1,7) [TS2322]
 *
 * We keep only one finding.
 */
/**
 * Remove duplicate validation findings.
 *
 * The same underlying error may be detected
 * by multiple validation commands.
 *
 * Example:
 *
 * npm run build
 * npx tsc --noEmit
 *
 * Both may report:
 *
 * app.ts(1,7) TS2322
 *
 * These should appear as one finding
 * in the final project report.
 */
function deduplicateFindings(
  findings: ValidationFinding[]
): ValidationFinding[] {
  const uniqueFindings =
    new Map<string, ValidationFinding>();

  for (
    const finding of findings
  ) {
    /**
     * Build a stable identity for the
     * underlying problem.
     *
     * We intentionally do NOT include
     * the command because the same error
     * can be detected by different commands.
     */
    const key = [
      finding.category,
      finding.code ?? "",
      finding.file ?? "",
      finding.line ?? "",
      finding.column ?? "",
      finding.message.trim()
    ].join("|");

    /**
     * Keep the first occurrence.
     */
    if (
      !uniqueFindings.has(key)
    ) {
      uniqueFindings.set(
        key,
        finding
      );
    }
  }

  return Array.from(
    uniqueFindings.values()
  );
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

  const findings:
    ValidationFinding[] = [];

  const warnings:
    ValidationFinding[] = [];

  // ... tumhara existing for loop ...
  // ... saare commands yahan run honge ...


  /**
   * Remove duplicate findings
   * before creating the final report.
   */
  const uniqueFindings =
    deduplicateFindings(
      findings
    );

  /**
   * Remove duplicate warnings
   * before creating the final report.
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
    uniqueFindings.length === 0;

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

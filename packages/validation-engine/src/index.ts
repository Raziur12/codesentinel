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
}

export interface ValidationReport {
  projectPath: string;

  packageManager: string;

  results: ValidationResult[];

  findings: ValidationFinding[];

  passed: boolean;

  startedAt: string;

  completedAt: string;
}

/*
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

/*
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

/*
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

/*
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

  /*
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

  return {
    type: "validation",

    severity,

    category,

    title:
      `${validationCommand.name} failed`,

    message:
      `The ${validationCommand.name.toLowerCase()} command failed.`,

    command,

    exitCode,

    evidence: output
  };
}

/*
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

/*
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

      /*
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

      /*
       * shell:true is important for
       * Windows/Git Bash compatibility.
       */
      const child = spawn(
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

      /*
       * Capture stdout.
       */
      child.stdout?.on(
        "data",
        (data) => {
          stdout +=
            data.toString();
        }
      );

      /*
       * Capture stderr.
       */
      child.stderr?.on(
        "data",
        (data) => {
          stderr +=
            data.toString();
        }
      );

      /*
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
              Date.now() - started
          };

          /*
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

      /*
       * Process could not start.
       *
       * Example:
       *
       * npm.cmd not found
       * command not found
       * permission problem
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
              Date.now() - started
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

/*
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

  /*
   * Findings are collected
   * from failed validations.
   */
  const findings:
    ValidationFinding[] = [];

  /*
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
      `\n▶ Running command: ${
        command.command
      } ${command.args.join(" ")}`
    );

    /*
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

    /*
     * Execute actual command.
     */
    const result =
      await runCommand(
        projectPath,
        command
      );

    /*
     * Save result.
     */
    results.push(result);

    /*
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

    /*
     * Failed validation.
     */
    else {
      console.log(
        `❌ ${command.name}`
      );

      /*
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
          `Severity: ${
            result.finding.severity
          }`
        );

        console.log(
          `Category: ${
            result.finding.category
          }`
        );

        console.log(
          `Finding: ${
            result.finding.title
          }`
        );

        console.log(
          `Message: ${
            result.finding.message
          }`
        );
      }

      /*
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

      /*
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

  /*
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

    passed,

    startedAt,

    completedAt
  };
}
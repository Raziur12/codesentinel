import { spawn } from "node:child_process";

export type ValidationStatus =
  | "passed"
  | "failed"
  | "skipped";

export interface ValidationCommand {
  name: string;
  command: string;
  args: string[];
}

export interface ValidationResult {
  name: string;
  command: string;
  status: ValidationStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface ValidationReport {
  projectPath: string;
  packageManager: string;
  results: ValidationResult[];
  passed: boolean;
  startedAt: string;
  completedAt: string;
}

function runCommand(
  projectPath: string,
  validationCommand: ValidationCommand
): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const started = Date.now();

    const isWindows = process.platform === "win32";

    /*
     * Windows:
     * npm is actually npm.cmd.
     *
     * shell: true allows Windows/Git Bash
     * to correctly execute npm.cmd.
     *
     * Linux/macOS:
     * normal npm command is used.
     */
    const executable = isWindows
      ? `${validationCommand.command}.cmd`
      : validationCommand.command;

    console.log(
      `Executable: ${executable}`
    );

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

    child.stdout?.on(
      "data",
      (data) => {
        stdout += data.toString();
      }
    );

    child.stderr?.on(
      "data",
      (data) => {
        stderr += data.toString();
      }
    );

    child.on(
      "close",
      (exitCode) => {
        resolve({
          name: validationCommand.name,

          command: [
            validationCommand.command,
            ...validationCommand.args
          ].join(" "),

          status:
            exitCode === 0
              ? "passed"
              : "failed",

          exitCode,

          stdout,

          stderr,

          durationMs:
            Date.now() - started
        });
      }
    );

    child.on(
      "error",
      (error) => {
        resolve({
          name: validationCommand.name,

          command: [
            validationCommand.command,
            ...validationCommand.args
          ].join(" "),

          status: "failed",

          exitCode: null,

          stdout,

          stderr:
            stderr +
            "\n" +
            error.message,

          durationMs:
            Date.now() - started
        });
      }
    );
  });
}

export async function validateProject(
  projectPath: string,
  commands: ValidationCommand[],
  packageManager = "npm"
): Promise<ValidationReport> {
  const startedAt =
    new Date().toISOString();

  const results: ValidationResult[] = [];

  for (const command of commands) {
    console.log(
      `\n▶ Running command: ${
        command.command
      } ${command.args.join(" ")}`
    );

    const result =
      await runCommand(
        projectPath,
        command
      );

    results.push(result);

    if (result.status === "passed") {
      console.log(
        `✅ ${command.name}`
      );
    } else {
      console.log(
        `❌ ${command.name}`
      );

      if (result.stderr) {
        console.log(
          "\nSTDERR:"
        );

        console.log(
          result.stderr
        );
      }

      if (result.stdout) {
        console.log(
          "\nSTDOUT:"
        );

        console.log(
          result.stdout
        );
      }
    }
  }

  const completedAt =
    new Date().toISOString();

  return {
    projectPath,

    packageManager,

    results,

    passed: results.every(
      (result) =>
        result.status === "passed" ||
        result.status === "skipped"
    ),

    startedAt,

    completedAt
  };
}
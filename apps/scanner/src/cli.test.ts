import assert from "node:assert/strict";
import {
  spawn
} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

const scannerEntry =
  path.resolve(
    path.dirname(
      fileURLToPath(
        import.meta.url
      )
    ),
    "index.js"
  );

async function createFixture(
  files: Record<string, string>
): Promise<string> {
  const directory =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "codesentinel-cli-"
      )
    );

  for (
    const [
      relativePath,
      content
    ] of Object.entries(
      files
    )
  ) {
    const filePath =
      path.join(
        directory,
        relativePath
      );

    await fs.mkdir(
      path.dirname(
        filePath
      ),
      {
        recursive:
          true
      }
    );

    await fs.writeFile(
      filePath,
      content,
      "utf8"
    );
  }

  return directory;
}

function runScanner(
  args: string[]
): Promise<CommandResult> {
  return new Promise(
    (resolve, reject) => {
      const child =
        spawn(
          process.execPath,
          [
            scannerEntry,
            ...args
          ],
          {
            cwd:
              path.resolve(
                path.dirname(
                  scannerEntry
                ),
                "..",
                "..",
                ".."
              ),
            windowsHide:
              true,
            stdio:
              [
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

      child.stdout.on(
        "data",
        data => {
          stdout +=
            data.toString();
        }
      );

      child.stderr.on(
        "data",
        data => {
          stderr +=
            data.toString();
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        exitCode => {
          resolve({
            exitCode,
            stdout,
            stderr
          });
        }
      );
    }
  );
}

test(
  "scanner CLI writes JSON report and returns zero for a passing project",
  async () => {
    const projectPath =
      await createFixture({
        "package.json":
          JSON.stringify(
            {
              name:
                "passing-project",
              version:
                "1.0.0",
              scripts:
                {
                  build:
                    "node --check app.js",
                  test:
                    "node --test",
                  lint:
                    "node --check app.js"
                }
            },
            null,
            2
          ),
        "app.js":
          "console.log('passing project');\n"
      });

    const result =
      await runScanner([
        projectPath,
        "--format",
        "json"
      ]);

    assert.equal(
      result.exitCode,
      0,
      result.stderr
    );

    const output =
      JSON.parse(
        result.stdout
      );

    assert.equal(
      output.scan.metadata.format,
      "json"
    );

    assert.equal(
      output.scan.summary.passed,
      true
    );

    assert.equal(
      output.scan.validation.passed,
      true
    );
  }
);

test(
  "scanner CLI returns validation failure exit code for a failing project",
  async () => {
    const projectPath =
      await createFixture({
        "package.json":
          JSON.stringify(
            {
              name:
                "failing-project",
              version:
                "1.0.0",
              scripts:
                {
                  build:
                    "node fail-build.cjs",
                  test:
                    "echo test passes",
                  lint:
                    "echo lint passes"
                }
            },
            null,
            2
          ),
        "fail-build.cjs":
          "console.error('build failed'); process.exit(1);\n"
      });

    const result =
      await runScanner([
        projectPath,
        "--format=json"
      ]);

    assert.equal(
      result.exitCode,
      1
    );

    const output =
      JSON.parse(
        result.stdout
      );

    assert.equal(
      output.scan.summary.passed,
      false
    );

    assert.equal(
      output.scan.summary.failedCount > 0,
      true
    );
  }
);

test(
  "scanner CLI returns invalid-input exit code for an invalid format",
  async () => {
    const result =
      await runScanner([
        ".",
        "--format",
        "xml"
      ]);

    assert.equal(
      result.exitCode,
      3
    );

    assert.match(
      result.stderr,
      /--format requires json or text/
    );
  }
);

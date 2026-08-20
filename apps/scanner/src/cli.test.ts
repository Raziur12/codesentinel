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

    assert.equal(
      output.scan.securityReport.status,
      "passed"
    );

    const securityReport =
      JSON.parse(
        await fs.readFile(
          path.join(
            projectPath,
            ".codesentinel",
            "security-report.json"
          ),
          "utf8"
        )
      );

    assert.equal(
      securityReport.schemaVersion,
      "1.0.0"
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

    assert.equal(
      output.scan.aiPatchPlan.guardrails.automaticPatchApplied,
      false
    );

    assert.equal(
      output.scan.aiPatchPlan.patches.length > 0,
      true
    );
  }
);

test(
  "scanner CLI writes markdown report",
  async () => {
    const projectPath =
      await createFixture({
        "package.json":
          JSON.stringify(
            {
              name:
                "markdown-project",
              version:
                "1.0.0",
              scripts:
                {}
            },
            null,
            2
          ),
        "app.js":
          "console.log('markdown project');\n"
      });

    const result =
      await runScanner([
        projectPath,
        "--format=markdown"
      ]);

    assert.equal(
      result.exitCode,
      0,
      result.stderr
    );

    assert.match(
      result.stdout,
      /# CodeSentinel Scan Report/
    );

    assert.match(
      result.stdout,
      /Status: \*\*passed\*\*/
    );
  }
);

test(
  "scanner CLI writes SARIF report",
  async () => {
    const projectPath =
      await createFixture({
        "package.json":
          JSON.stringify(
            {
              name:
                "sarif-project",
              version:
                "1.0.0",
              scripts:
                {}
            },
            null,
            2
          ),
        "app.js":
          "console.log('sarif project');\n"
      });

    const result =
      await runScanner([
        projectPath,
        "--format",
        "sarif"
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
      output.version,
      "2.1.0"
    );

    assert.equal(
      output.runs[0].tool.driver.name,
      "CodeSentinel"
    );
  }
);

test(
  "scanner CLI treats missing root commands as skipped instead of failed",
  async () => {
    const projectPath =
      await createFixture({
        "package.json":
          JSON.stringify(
            {
              name:
                "missing-commands-project",
              version:
                "1.0.0",
              scripts:
                {}
            },
            null,
            2
          ),
        "app.js":
          "console.log('missing commands project');\n"
      });

    const result =
      await runScanner([
        projectPath,
        "--format=json"
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
      output.scan.summary.passed,
      true
    );

    assert.equal(
      output.scan.summary.failedCount,
      0
    );

    assert.equal(
      output.scan.summary.skippedCount > 0,
      true
    );

    assert.equal(
      output.scan.validation.results.some(
        (result: {
          category: string;
          status: string;
        }) =>
          result.category === "build" &&
          result.status === "skipped"
      ),
      true
    );
  }
);

test(
  "scanner CLI shows progress for text scans by default",
  async () => {
    const projectPath =
      await createFixture({
        "package.json":
          JSON.stringify(
            {
              name:
                "progress-project",
              version:
                "1.0.0",
              scripts:
                {}
            },
            null,
            2
          ),
        "app.js":
          "console.log('progress project');\n"
      });

    const result =
      await runScanner([
        projectPath
      ]);

    assert.equal(
      result.exitCode,
      0,
      result.stderr
    );

    assert.match(
      result.stderr,
      /Progress: Collecting project files/
    );

    assert.match(
      result.stdout,
      /Summary: passed/
    );
  }
);

test(
  "scanner CLI quiet mode prints only the final status",
  async () => {
    const projectPath =
      await createFixture({
        "package.json":
          JSON.stringify(
            {
              name:
                "quiet-project",
              version:
                "1.0.0",
              scripts:
                {}
            },
            null,
            2
          ),
        "app.js":
          "console.log('quiet project');\n"
      });

    const result =
      await runScanner([
        projectPath,
        "--quiet"
      ]);

    assert.equal(
      result.exitCode,
      0,
      result.stderr
    );

    assert.equal(
      result.stdout.trim(),
      "passed"
    );
  }
);

test(
  "scanner CLI verbose mode includes validation command output",
  async () => {
    const projectPath =
      await createFixture({
        "package.json":
          JSON.stringify(
            {
              name:
                "verbose-project",
              version:
                "1.0.0",
              scripts:
                {}
            },
            null,
            2
          ),
        "app.js":
          "console.log('verbose project');\n"
      });

    const result =
      await runScanner([
        projectPath,
        "--verbose",
        "--no-progress"
      ]);

    assert.equal(
      result.exitCode,
      0,
      result.stderr
    );

    assert.match(
      result.stdout,
      /Running command: npm install/
    );
  }
);

test(
  "scanner CLI debug mode prints debug context",
  async () => {
    const projectPath =
      await createFixture({
        "package.json":
          JSON.stringify(
            {
              name:
                "debug-project",
              version:
                "1.0.0",
              scripts:
                {}
            },
            null,
            2
          ),
        "app.js":
          "console.log('debug project');\n"
      });

    const result =
      await runScanner([
        projectPath,
        "--debug",
        "--no-progress"
      ]);

    assert.equal(
      result.exitCode,
      0,
      result.stderr
    );

    assert.match(
      result.stderr,
      /Debug: format=text/
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
      /--format requires text, json, markdown, or sarif/
    );
  }
);

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  validateProject
} from "./index.js";

import type {
  ValidationCommand
} from "./index.js";

async function createTemporaryProject(): Promise<string> {
  return fs.mkdtemp(
    path.join(
      os.tmpdir(),
      "codesentinel-security-"
    )
  );
}

test(
  "detects high-confidence secrets as secret findings",
  async () => {
    const projectPath =
      await createTemporaryProject();

    try {
      await fs.writeFile(
        path.join(
          projectPath,
          "app.js"
        ),
        "const key = 'AKIA1234567890ABCDEF';\n",
        "utf8"
      );

      const command:
        ValidationCommand = {
        name:
          "Secret Detection",
        command:
          "codesentinel",
        args:
          ["secrets"],
        executable:
          "codesentinel",
        available:
          true,
        category:
          "secret",
        priority:
          70,
        metadata:
          {
            internal:
              true
          }
      };

      const report =
        await validateProject(
          projectPath,
          [command],
          "npm"
        );

      assert.equal(
        report.passed,
        false
      );

      assert.equal(
        report.findings[0]?.category,
        "secret"
      );

      assert.equal(
        report.findings[0]?.code,
        "SECRET_AWS_ACCESS_KEY_ID"
      );

      assert.match(
        report.findings[0]?.evidence ?? "",
        /\[redacted\]/
      );
    } finally {
      await fs.rm(
        projectPath,
        {
          recursive:
            true,
          force:
            true
        }
      );
    }
  }
);

test(
  "parses npm audit JSON into security findings",
  async () => {
    const projectPath =
      await createTemporaryProject();

    try {
      const auditJson =
        JSON.stringify({
          auditReportVersion:
            2,
          vulnerabilities:
            {
              lodash:
                {
                  name:
                    "lodash",
                  severity:
                    "high",
                  range:
                    "<4.17.21",
                  via:
                    [
                      {
                        title:
                          "Prototype Pollution"
                      }
                    ],
                  fixAvailable:
                    true
                }
            }
        });

      const auditScriptPath =
        path.join(
          projectPath,
          "audit-fixture.cjs"
        );

      await fs.writeFile(
        auditScriptPath,
        [
          `console.log(${JSON.stringify(auditJson)});`,
          "process.exit(1);"
        ].join("\n"),
        "utf8"
      );

      const command:
        ValidationCommand = {
        name:
          "Security Audit",
        command:
          "node",
        args:
          [
            auditScriptPath
          ],
        executable:
          "node",
        available:
          true,
        category:
          "security",
        priority:
          60
      };

      const report =
        await validateProject(
          projectPath,
          [command],
          "npm"
        );

      assert.equal(
        report.passed,
        false
      );

      assert.equal(
        report.findings[0]?.category,
        "security"
      );

      assert.equal(
        report.findings[0]?.code,
        "NPM_AUDIT_VULNERABILITY"
      );

      assert.equal(
        report.findings[0]?.metadata?.packageName,
        "lodash"
      );
    } finally {
      await fs.rm(
        projectPath,
        {
          recursive:
            true,
          force:
            true
        }
      );
    }
  }
);

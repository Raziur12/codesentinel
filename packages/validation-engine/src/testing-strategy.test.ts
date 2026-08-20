import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  discoverValidationPlan,
  validateProject
} from "./index.js";

const repositoryRoot =
  path.resolve(
    path.dirname(
      fileURLToPath(
        import.meta.url
      )
    ),
    "..",
    "..",
    ".."
  );

const fixturesRoot =
  path.join(
    repositoryRoot,
    "tests",
    "scanner",
    "fixtures"
  );

function fixturePath(
  fixtureName: string
): string {
  return path.join(
    fixturesRoot,
    fixtureName
  );
}

function commandByCategory(
  plan: Awaited<ReturnType<typeof discoverValidationPlan>>,
  category: string
) {
  return plan.commands.find(
    command => command.category === category
  );
}

async function createTemporaryProject(
  packageJson: unknown,
  files: Record<string, string> = {}
): Promise<string> {
  const directory =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "codesentinel-validation-"
      )
    );

  await fs.writeFile(
    path.join(
      directory,
      "package.json"
    ),
    JSON.stringify(
      packageJson,
      null,
      2
    ),
    "utf8"
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

test(
  "roadmap scanner fixtures cover package managers, framework projects, failure projects, and monorepos",
  async () => {
    const fixtureExpectations = [
      {
        name:
          "npm-project",
        packageManager:
          "npm"
      },
      {
        name:
          "pnpm-project",
        packageManager:
          "pnpm"
      },
      {
        name:
          "yarn-project",
        packageManager:
          "yarn"
      },
      {
        name:
          "bun-project",
        packageManager:
          "bun"
      },
      {
        name:
          "vite-project",
        packageManager:
          "npm",
        buildAvailable:
          true
      },
      {
        name:
          "next-project",
        packageManager:
          "npm",
        buildAvailable:
          true
      },
      {
        name:
          "react-project",
        packageManager:
          "npm",
        buildAvailable:
          true,
        testAvailable:
          true,
        lintAvailable:
          true
      },
      {
        name:
          "node-express-project",
        packageManager:
          "npm",
        buildAvailable:
          true,
        testAvailable:
          true,
        lintAvailable:
          true
      },
      {
        name:
          "typescript-only-project",
        packageManager:
          "npm",
        typeCheckAvailable:
          true
      },
      {
        name:
          "multiple-tsconfig-project",
        packageManager:
          "npm",
        typeCheckAvailable:
          true
      },
      {
        name:
          "lint-failure-project",
        packageManager:
          "npm",
        lintAvailable:
          true
      },
      {
        name:
          "test-failure-project",
        packageManager:
          "npm",
        testAvailable:
          true
      },
      {
        name:
          "dependency-conflict-project",
        packageManager:
          "npm"
      }
    ];

    for (
      const expectation
      of fixtureExpectations
    ) {
      const plan =
        await discoverValidationPlan(
          fixturePath(
            expectation.name
          )
        );

      assert.equal(
        plan.packageManager,
        expectation.packageManager,
        `${expectation.name} package manager`
      );

      assert.equal(
        commandByCategory(
          plan,
          "dependency"
        )?.available,
        true,
        `${expectation.name} dependency command`
      );

      if (
        expectation.buildAvailable !== undefined
      ) {
        assert.equal(
          commandByCategory(
            plan,
            "build"
          )?.available,
          expectation.buildAvailable,
          `${expectation.name} build command`
        );
      }

      if (
        expectation.testAvailable !== undefined
      ) {
        assert.equal(
          commandByCategory(
            plan,
            "test"
          )?.available,
          expectation.testAvailable,
          `${expectation.name} test command`
        );
      }

      if (
        expectation.lintAvailable !== undefined
      ) {
        assert.equal(
          commandByCategory(
            plan,
            "lint"
          )?.available,
          expectation.lintAvailable,
          `${expectation.name} lint command`
        );
      }

      if (
        expectation.typeCheckAvailable !== undefined
      ) {
        assert.equal(
          commandByCategory(
            plan,
            "type-check"
          )?.available,
          expectation.typeCheckAvailable,
          `${expectation.name} type-check command`
        );
      }
    }

    const monorepoPlan =
      await discoverValidationPlan(
        fixturePath(
          "monorepo-project"
        )
      );

    assert.deepEqual(
      monorepoPlan.workspacePatterns,
      [
        "apps/*",
        "packages/*"
      ]
    );

    assert.deepEqual(
      monorepoPlan.workspaces.map(
        workspace => workspace.name
      ),
      [
        "@fixture/web",
        "@fixture/api"
      ]
    );
  }
);

test(
  "missing validation commands are skipped instead of failed",
  async () => {
    const projectPath =
      await createTemporaryProject(
        {
          name:
            "missing-root-commands",
          version:
            "1.0.0",
          scripts:
            {}
        },
        {
          "app.js":
            "console.log('missing command fixture');\n"
        }
      );

    const plan =
      await discoverValidationPlan(
        projectPath
      );

    assert.equal(
      commandByCategory(
        plan,
        "build"
      )?.available,
      false
    );

    assert.equal(
      commandByCategory(
        plan,
        "test"
      )?.available,
      false
    );

    assert.equal(
      commandByCategory(
        plan,
        "lint"
      )?.available,
      false
    );

    const report =
      await validateProject(
        projectPath,
        plan.commands,
        plan.packageManager,
        plan.configuration
      );

    const skippedCategories =
      report.results
        .filter(
          result => result.status === "skipped"
        )
        .map(
          result => result.category
        );

    assert.deepEqual(
      skippedCategories.filter(
        category =>
          [
            "build",
            "test",
            "lint",
            "type-check"
          ].includes(
            category
          )
      ),
      [
        "build",
        "test",
        "lint",
        "type-check"
      ]
    );

    assert.equal(
      report.passed,
      true
    );

    assert.equal(
      report.findings.length,
      0
    );
  }
);

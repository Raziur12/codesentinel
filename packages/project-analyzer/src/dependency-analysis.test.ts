import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeDependencies
} from "./index.js";

async function createTemporaryProject(): Promise<string> {
  return fs.mkdtemp(
    path.join(
      os.tmpdir(),
      "codesentinel-deps-"
    )
  );
}

test(
  "analyzes dependency groups, tree, engines, outdated signals, and conflicts",
  async () => {
    const projectPath =
      await createTemporaryProject();

    try {
      await fs.writeFile(
        path.join(
          projectPath,
          "package.json"
        ),
        JSON.stringify(
          {
            packageManager:
              "npm@11.0.0",
            engines:
              {
                node:
                  ">=22"
              },
            dependencies:
              {
                react:
                  "18.2.0"
              },
            devDependencies:
              {
                vite:
                  "^5.0.0"
              },
            peerDependencies:
              {
                "react-dom":
                  "^18.0.0"
              },
            optionalDependencies:
              {
                fsevents:
                  "^2.3.3"
              }
          },
          null,
          2
        ),
        "utf8"
      );

      await fs.writeFile(
        path.join(
          projectPath,
          "package-lock.json"
        ),
        JSON.stringify(
          {
            lockfileVersion:
              3,
            packages:
              {
                "":
                  {
                    dependencies:
                      {
                        react:
                          "18.2.0"
                      }
                  },
                "node_modules/react":
                  {
                    version:
                      "18.1.0",
                    dependencies:
                      {
                        "loose-envify":
                          "^1.1.0"
                      }
                  },
                "node_modules/vite":
                  {
                    version:
                      "5.0.1",
                    dev:
                      true,
                    engines:
                      {
                        node:
                          "^18.0.0 || >=20.0.0"
                      }
                  }
              }
          },
          null,
          2
        ),
        "utf8"
      );

      const analysis =
        await analyzeDependencies(
          projectPath
        );

      assert.equal(
        analysis.packageManager,
        "npm"
      );

      assert.equal(
        analysis.directDependencies[0]?.name,
        "react"
      );

      assert.equal(
        analysis.devDependencies[0]?.name,
        "vite"
      );

      assert.equal(
        analysis.peerDependencies[0]?.name,
        "react-dom"
      );

      assert.equal(
        analysis.optionalDependencies[0]?.name,
        "fsevents"
      );

      assert.equal(
        analysis.dependencyTree.length,
        2
      );

      assert.equal(
        analysis.outdatedDependencies[0]?.code,
        "DEPENDENCY_LOCK_VERSION_DRIFT"
      );

      assert.ok(
        analysis.engineRequirements.some(
          issue =>
            issue.code === "PROJECT_ENGINE_REQUIREMENT"
        )
      );

      assert.equal(
        analysis.peerDependencyConflicts[0]?.code,
        "PEER_DEPENDENCY_NOT_INSTALLED"
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

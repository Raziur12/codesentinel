import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateProjectHealthScore
} from "./index.js";

import type {
  CommonFinding,
  DependencyAnalysis,
  ProjectStructure
} from "./index.js";

const projectStructure: ProjectStructure = {
  rootFiles:
    ["package.json"],
  directories:
    ["src", "tests"],
  frontend:
    true,
  backend:
    false,
  tests:
    true,
  configuration:
    ["package.json", "tsconfig.json"],
  packageFiles:
    ["package.json", "package-lock.json"],
  infrastructure:
    [".github/workflows/codesentinel.yml"]
};

const dependencyAnalysis: DependencyAnalysis = {
  packageManager:
    "npm",
  packageFile:
    "package.json",
  lockfile:
    "package-lock.json",
  directDependencies:
    [],
  devDependencies:
    [],
  peerDependencies:
    [],
  optionalDependencies:
    [],
  dependencyTree:
    [],
  outdatedDependencies:
    [],
  engineRequirements:
    [],
  dependencyConflicts:
    [],
  peerDependencyConflicts:
    []
};

function createFinding(
  category: CommonFinding["category"]
): CommonFinding {
  return {
    id:
      "cs_test",
    key:
      "test-key",
    severity:
      "critical",
    category,
    title:
      "Test finding",
    message:
      "Test finding",
    source:
      "test",
    confidence:
      1
  };
}

test(
  "calculates a high health score from passing raw findings",
  () => {
    const health =
      calculateProjectHealthScore({
        projectStructure,
        dependencyAnalysis,
        validation:
          {
            results:
              [
                {
                  name:
                    "Build",
                  status:
                    "passed",
                  category:
                    "build"
                },
                {
                  name:
                    "Test",
                  status:
                    "passed",
                  category:
                    "test"
                },
                {
                  name:
                    "Type Check",
                  status:
                    "passed",
                  category:
                    "type-check"
                },
                {
                  name:
                    "Lint",
                  status:
                    "passed",
                  category:
                    "lint"
                },
                {
                  name:
                    "Security Audit",
                  status:
                    "passed",
                  category:
                    "security"
                },
                {
                  name:
                    "Secret Detection",
                  status:
                    "passed",
                  category:
                    "secret"
                }
              ],
            findings:
              [],
            warnings:
              []
          }
      });

    assert.equal(
      health.score,
      100
    );

    assert.equal(
      health.grade,
      "A"
    );
  }
);

test(
  "deducts health score for security findings",
  () => {
    const health =
      calculateProjectHealthScore({
        projectStructure,
        dependencyAnalysis,
        validation:
          {
            results:
              [
                {
                  name:
                    "Build",
                  status:
                    "passed",
                  category:
                    "build"
                },
                {
                  name:
                    "Security Audit",
                  status:
                    "failed",
                  category:
                    "security"
                }
              ],
            findings:
              [
                createFinding(
                  "security"
                )
              ],
            warnings:
              []
          }
      });

    const securityFactor =
      health.factors.find(
        factor =>
          factor.name === "security"
      );

    assert.equal(
      securityFactor?.status,
      "failed"
    );

    assert.ok(
      health.score < 100
    );
  }
);

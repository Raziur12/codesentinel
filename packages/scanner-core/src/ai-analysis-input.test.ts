import assert from "node:assert/strict";
import test from "node:test";

import {
  createAiAnalysisInput
} from "./index.js";

import type {
  CommonFinding,
  DependencyAnalysis,
  ProjectHealthScore,
  ProjectStructure,
  TechnologyProfile
} from "./index.js";

const projectStructure: ProjectStructure = {
  rootFiles:
    ["package.json"],
  directories:
    ["src"],
  frontend:
    false,
  backend:
    true,
  tests:
    true,
  configuration:
    ["package.json"],
  packageFiles:
    ["package.json", "package-lock.json"],
  infrastructure:
    []
};

const technologyProfile: TechnologyProfile = {
  languages:
    [],
  runtimes:
    [],
  frameworks:
    [],
  databases:
    [],
  buildTools:
    [],
  packageManagers:
    [],
  infrastructure:
    [],
  unknown:
    []
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

const health: ProjectHealthScore = {
  score:
    82,
  maxScore:
    100,
  grade:
    "B",
  summary:
    "1 warning factor(s)",
  factors:
    []
};

const finding: CommonFinding & {
  evidence: string;
} = {
  id:
    "cs_test",
  key:
    "test-key",
  severity:
    "high",
  category:
    "type-check",
  code:
    "TS2322",
  title:
    "TypeScript error",
  message:
    "Type number is not assignable to string.",
  file:
    "app.ts",
  line:
    1,
  column:
    7,
  source:
    "validation-engine",
  suggestion:
    "Assign a string value.",
  confidence:
    0.95,
  evidence:
    "app.ts(1,7) [TS2322]"
};

test(
  "creates structured AI analysis input from deterministic scan data",
  () => {
    const aiInput =
      createAiAnalysisInput({
        projectPath:
          "example-project",
        filesScanned:
          4,
        projectStructure,
        technologyProfile,
        dependencyAnalysis,
        health,
        validation:
          {
            passed:
              false,
            total:
              1,
            passedCount:
              0,
            failedCount:
              1,
            warningCount:
              0,
            skippedCount:
              0
          },
        findings:
          [finding],
        warnings:
          [],
        generatedAt:
          "2026-08-19T00:00:00.000Z"
      });

    assert.equal(
      aiInput.purpose,
      "ai-analysis-input"
    );

    assert.equal(
      aiInput.guardrails.deterministicValidationIsAuthoritative,
      true
    );

    assert.deepEqual(
      aiInput.guardrails.requireEvidenceLabels,
      [
        "confirmed",
        "inferred",
        "uncertain"
      ]
    );

    assert.equal(
      aiInput.findings[0]?.code,
      "TS2322"
    );

    assert.equal(
      aiInput.findings[0]?.evidence,
      "app.ts(1,7) [TS2322]"
    );
  }
);

import assert from "node:assert/strict";
import test from "node:test";

import {
  ConsoleReporter,
  JsonReporter,
  MarkdownReporter,
  SarifReporter
} from "./index.js";

import type {
  ScanExecution
} from "./index.js";

const execution: ScanExecution = {
  result:
    {
      projectPath:
        "/tmp/example",
      filesScanned:
        2,
      projectStructure:
        {
          rootFiles:
            [
              "package.json",
              "app.js"
            ],
          directories:
            [],
          frontend:
            false,
          backend:
            true,
          tests:
            false,
          configuration:
            [
              "package.json"
            ],
          packageFiles:
            [
              "package.json"
            ],
          infrastructure:
            []
        },
      technologies:
        [],
      technologyProfile:
        {
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
        },
      dependencyAnalysis:
        {
          packageManager:
            "npm",
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
        },
      health:
        {
          score:
            94,
          maxScore:
            100,
          grade:
            "A",
          summary:
            "Healthy",
          factors:
            [
              {
                name:
                  "build",
                label:
                  "Build",
                status:
                  "passed",
                score:
                  15,
                maxScore:
                  15,
                deductions:
                  0,
                summary:
                  "Build passed",
                evidence:
                  []
              }
            ]
        },
      ai:
        undefined,
      securityReport:
        {
          schemaVersion:
            "1.0.0",
          generatedAt:
            "2026-08-20T00:00:01.000Z",
          status:
            "passed",
          summary:
            {
              totalFindings:
                0,
              securityFindings:
                0,
              secretFindings:
                0,
              dependencyRiskSignals:
                0,
              critical:
                0,
              high:
                0,
              medium:
                0,
              low:
                0,
              info:
                0
            },
          checks:
            {
              audit:
                "passed",
              secrets:
                "passed"
            },
          findings:
            [],
          recommendations:
            [
              "No active security or secret findings were detected."
            ]
        },
      aiRootCause:
        undefined,
      aiFixSuggestions:
        undefined,
      aiPatchPlan:
        {
          schemaVersion:
            "1.0.0",
          generatedAt:
            "2026-08-20T00:00:01.000Z",
          purpose:
            "ai-patch-plan",
          provider:
            "local-deterministic",
          patches:
            [],
          skipped:
            {
              reason:
                "No patches"
            },
          guardrails:
            {
              automaticPatchApplied:
                false,
              requireExplicitConfirmation:
                true,
              runValidationAfterPatch:
                true,
              rollbackIfValidationWorsens:
                true
            }
        },
      aiProvider:
        {
          id:
            "local-deterministic",
          name:
            "Local deterministic AI provider"
        },
      validation:
        {
          passed:
            true,
          total:
            3,
          passedCount:
            2,
          failedCount:
            0,
          warningCount:
            0,
          skippedCount:
            1
        },
      startedAt:
        "2026-08-20T00:00:00.000Z",
      completedAt:
        "2026-08-20T00:00:01.000Z"
    },
  validationReport:
    {
      projectPath:
        "/tmp/example",
      packageManager:
        "npm",
      results:
        [],
      findings:
        [],
      warnings:
        [],
      ignoredFindings:
        [],
      ignoredWarnings:
        [],
      passed:
        true,
      startedAt:
        "2026-08-20T00:00:00.000Z",
      completedAt:
        "2026-08-20T00:00:01.000Z"
    }
};

test(
  "json reporter creates stable scanner output shape",
  () => {
    const output =
      new JsonReporter().createOutput(
        execution
      );

    assert.equal(
      output.scan.metadata.schemaVersion,
      "1.0.0"
    );

    assert.equal(
      output.scan.metadata.format,
      "json"
    );

    assert.equal(
      output.scan.project.path,
      "/tmp/example"
    );

    assert.equal(
      output.scan.summary.passed,
      true
    );

    assert.equal(
      output.scan.securityReport.status,
      "passed"
    );

    assert.deepEqual(
      output.scan.findings,
      []
    );

    assert.equal(
      output.scan.aiPatchPlan.guardrails.automaticPatchApplied,
      false
    );
  }
);

test(
  "console reporter prints summary, health, dependency, and skipped counts",
  () => {
    const messages: string[] = [];
    const originalLog =
      console.log;

    console.log =
      (...args: unknown[]) => {
        messages.push(
          args.join(
            " "
          )
        );
      };

    try {
      const reporter =
        new ConsoleReporter();

      reporter.start({
        displayInput:
          ".",
        projectPath:
          "/tmp/example"
      });

      reporter.complete(
        execution
      );
    } finally {
      console.log =
        originalLog;
    }

    const output =
      messages.join(
        "\n"
      );

    assert.match(
      output,
      /CodeSentinel Scanner/
    );

    assert.match(
      output,
      /CodeSentinel Health Score: 94\/100/
    );

    assert.match(
      output,
      /Dependencies: direct 0/
    );

    assert.match(
      output,
      /Security Report: passed/
    );

    assert.match(
      output,
      /Skipped: 1/
    );

    assert.match(
      output,
      /AI Patch Plan: 0 proposed patch/
    );
  }
);

test(
  "markdown reporter creates a readable scan report",
  () => {
    const output =
      new MarkdownReporter().createOutput(
        execution
      );

    assert.match(
      output,
      /# CodeSentinel Scan Report/
    );

    assert.match(
      output,
      /Status: \*\*passed\*\*/
    );

    assert.match(
      output,
      /Skipped: 1/
    );

    assert.match(
      output,
      /## Security/
    );
  }
);

test(
  "sarif reporter creates SARIF 2.1.0 output",
  () => {
    const output =
      new SarifReporter().createOutput(
        execution
      );

    assert.equal(
      output.version,
      "2.1.0"
    );

    assert.equal(
      output.runs[0].tool.driver.name,
      "CodeSentinel"
    );

    assert.deepEqual(
      output.runs[0].results,
      []
    );
  }
);

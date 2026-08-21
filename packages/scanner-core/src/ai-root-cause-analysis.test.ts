import assert from "node:assert/strict";
import test from "node:test";

import {
  createAiRootCauseAnalysis
} from "./index.js";

import type {
  AiAnalysisInput,
  AiFindingInput
} from "./index.js";

function createInput(
  findings: AiFindingInput[],
  warnings: AiFindingInput[] = []
): AiAnalysisInput {
  return {
    schemaVersion:
      "1.0.0",
    generatedAt:
      "2026-08-19T00:00:00.000Z",
    purpose:
      "ai-analysis-input",
    guardrails:
      {
        deterministicValidationIsAuthoritative:
          true,
        doNotReplaceValidation:
          true,
        useStructuredFindingsBeforeTerminalOutput:
          true,
        requireEvidenceLabels:
          [
            "confirmed",
            "inferred",
            "uncertain"
          ]
      },
    project:
      {
        path:
          "example-project",
        filesScanned:
          1,
        structure:
          {
            rootFiles:
              ["app.ts"],
            directories:
              [],
            frontend:
              false,
            backend:
              true,
            tests:
              false,
            configuration:
              ["tsconfig.json"],
            packageFiles:
              ["package.json"],
            infrastructure:
              []
          }
      },
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
    findings,
    warnings
  };
}

test(
  "explains TypeScript root cause with evidence labels",
  () => {
    const analysis =
      createAiRootCauseAnalysis(
        createInput([
          {
            id:
              "cs_ts",
            severity:
              "high",
            category:
              "type-check",
            code:
              "TS2322",
            title:
              "TypeScript error",
            message:
              "Type 'number' is not assignable to type 'string'.",
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
          }
        ])
      );

    const result =
      analysis.analyses[0];

    assert.equal(
      result?.rootCause.label,
      "confirmed"
    );

    assert.equal(
      result?.whyItHappened.label,
      "inferred"
    );

    assert.equal(
      result?.codeCausedIt.text,
      "The relevant code is in app.ts:1:7."
    );

    assert.equal(
      result?.howToFix.text,
      "Assign a string value."
    );
  }
);

test(
  "explains validation warnings as AI activity",
  () => {
    const analysis =
      createAiRootCauseAnalysis(
        createInput(
          [],
          [
            {
              id:
                "cs_engine",
              severity:
                "medium",
              category:
                "engine",
              code:
                "EBADENGINE",
              title:
                "Node.js engine warning",
              message:
                "Package engine requirement does not match the current Node.js environment.",
              source:
                "validation-engine",
              suggestion:
                "Use a Node.js version compatible with package engine requirements.",
              confidence:
                0.95,
              evidence:
                "npm reported EBADENGINE"
            }
          ]
        )
      );

    assert.equal(
      analysis.analyses.length,
      1
    );

    assert.equal(
      analysis.analyses[0]?.code,
      "EBADENGINE"
    );

    assert.equal(
      analysis.skipped.count,
      0
    );

    assert.equal(
      analysis.skipped.reason,
      "All active findings and warnings are analyzed"
    );
  }
);

test(
  "explains secret findings without exposing full secret values",
  () => {
    const analysis =
      createAiRootCauseAnalysis(
        createInput([
          {
            id:
              "cs_secret",
            severity:
              "critical",
            category:
              "secret",
            code:
              "SECRET_AWS_ACCESS_KEY_ID",
            title:
              "AWS access key detected",
            message:
              "AWS access key detected in app.js.",
            file:
              "app.js",
            line:
              2,
            column:
              10,
            source:
              "validation-engine",
            confidence:
              0.95,
            evidence:
              "AKIA...[redacted]...CDEF"
          }
        ])
      );

    const result =
      analysis.analyses[0];

    assert.equal(
      result?.rootCause.label,
      "confirmed"
    );

    assert.match(
      result?.howToFix.text ?? "",
      /secret manager/
    );

    assert.doesNotMatch(
      JSON.stringify(
        result
      ),
      /1234567890/
    );
  }
);

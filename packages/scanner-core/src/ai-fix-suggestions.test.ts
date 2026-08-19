import assert from "node:assert/strict";
import test from "node:test";

import {
  createAiFixSuggestions
} from "./index.js";

import type {
  AiRootCauseAnalysis
} from "./index.js";

const rootCauseAnalysis: AiRootCauseAnalysis = {
  schemaVersion:
    "1.0.0",
  generatedAt:
    "2026-08-19T00:00:00.000Z",
  purpose:
    "ai-root-cause-analysis",
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
  analyses:
    [
      {
        findingId:
          "cs_ts",
        severity:
          "high",
        category:
          "type-check",
        code:
          "TS2322",
        title:
          "TypeScript error",
        location:
          {
            file:
              "app.ts",
            line:
              1,
            column:
              7
          },
        rootCause:
          {
            label:
              "confirmed",
            text:
              "TypeScript reported TS2322 at app.ts:1:7.",
            evidence:
              ["Code: TS2322"]
          },
        whyItHappened:
          {
            label:
              "inferred",
            text:
              "The value does not match the expected type.",
            evidence:
              ["Code: TS2322"]
          },
        codeCausedIt:
          {
            label:
              "confirmed",
            text:
              "The relevant code is in app.ts:1:7.",
            evidence:
              ["Location: app.ts:1:7"]
          },
        howToFix:
          {
            label:
              "confirmed",
            text:
              "Assign a string value.",
            evidence:
              ["Code: TS2322"]
          },
        potentialSideEffects:
          {
            label:
              "inferred",
            text:
              "Re-run type-check and tests.",
            evidence:
              ["Code: TS2322"]
          }
      }
    ],
  skipped:
    {
      reason:
        "Only active findings are analyzed; warnings remain in the AI analysis input",
      count:
        0
    }
};

test(
  "creates suggestion-only fix output without applying patches",
  () => {
    const suggestions =
      createAiFixSuggestions({
        rootCauseAnalysis,
        mode:
          "dry-run"
      });

    assert.equal(
      suggestions.mode,
      "dry-run"
    );

    assert.equal(
      suggestions.guardrails.automaticPatchApplied,
      false
    );

    assert.equal(
      suggestions.guardrails.requireExplicitConfirmation,
      true
    );

    assert.equal(
      suggestions.suggestions[0]?.automaticPatchApplied,
      false
    );

    assert.deepEqual(
      suggestions.suggestions[0]?.affectedFiles,
      ["app.ts"]
    );

    assert.match(
      suggestions.suggestions[0]?.diffPreview ?? "",
      /suggestion-only/
    );
  }
);

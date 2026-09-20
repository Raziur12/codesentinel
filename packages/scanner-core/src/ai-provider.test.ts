import assert from "node:assert/strict";
import test from "node:test";

import {
  createAiProvider
} from "./index.js";

import type {
  AiAnalysisInput,
  AiFindingInput
} from "./index.js";

const finding: AiFindingInput = {
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
};

const input: AiAnalysisInput = {
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
  findings:
    [finding],
  warnings:
    []
};

test(
  "local deterministic AI provider implements the AIProvider contract",
  async () => {
    const provider =
      createAiProvider(
        "local-deterministic"
      );

    const rootCause =
      await provider.analyzeFindings(
        input
      );

    const explanation =
      await provider.explainFinding(
        finding,
        input
      );

    const suggestions =
      await provider.suggestFix(
        rootCause,
        "dry-run"
      );

    const patchPlan =
      await provider.generatePatch(
        suggestions
      );

    assert.equal(
      provider.capabilities.generatePatch,
      true
    );

    assert.equal(
      rootCause.analyses.length,
      1
    );

    assert.equal(
      explanation.findingId,
      finding.id
    );

    assert.equal(
      suggestions.suggestions[0]?.automaticPatchApplied,
      false
    );

    assert.equal(
      patchPlan.patches.length,
      1
    );

    assert.equal(
      patchPlan.guardrails.automaticPatchApplied,
      false
    );

    assert.equal(
      patchPlan.patches[0]?.automaticPatchApplied,
      false
    );
  }
);

test(
  "no-op AI provider keeps scanner usable without AI",
  async () => {
    const provider =
      createAiProvider(
        "none"
      );

    const rootCause =
      await provider.analyzeFindings(
        input
      );

    const suggestions =
      await provider.suggestFix(
        rootCause
      );

    assert.equal(
      provider.id,
      "none"
    );

    assert.equal(
      rootCause.analyses.length,
      0
    );

    assert.equal(
      suggestions.suggestions.length,
      0
    );
  }
);

test(
  "createAiProvider defaults to local-deterministic even when an Anthropic API key is present",
  async () => {
    const previousKey =
      process.env.ANTHROPIC_API_KEY;

    process.env.ANTHROPIC_API_KEY =
      "test-key-should-not-change-default";

    try {
      const provider =
        createAiProvider();

      assert.equal(
        provider.id,
        "local-deterministic"
      );
    } finally {
      if (
        previousKey === undefined
      ) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY =
          previousKey;
      }
    }
  }
);

test(
  "anthropic provider falls back to local-deterministic analysis without a configured API key",
  async () => {
    const previousKey =
      process.env.ANTHROPIC_API_KEY;

    delete process.env.ANTHROPIC_API_KEY;

    try {
      const provider =
        createAiProvider(
          "anthropic"
        );

      assert.equal(
        provider.id,
        "anthropic"
      );

      const rootCause =
        await provider.analyzeFindings(
          input
        );

      assert.equal(
        rootCause.analyses.length,
        1
      );

      assert.match(
        rootCause.skipped.reason,
        /ANTHROPIC_API_KEY/
      );
    } finally {
      if (
        previousKey !== undefined
      ) {
        process.env.ANTHROPIC_API_KEY =
          previousKey;
      }
    }
  }
);

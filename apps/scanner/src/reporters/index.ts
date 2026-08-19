import type {
  ValidationReport
} from "@codesentinel/validation-engine";

import type {
  ScanResult
} from "@codesentinel/scanner-core";

export interface ScanExecution {
  result: ScanResult;

  validationReport: ValidationReport;
}

export interface ReporterContext {
  displayInput: string;

  projectPath: string;

  workspacePath?: string;
}

export interface JsonScanOutput {
  scan: {
    metadata: {
      schemaVersion: string;

      generatedAt: string;

      format: "json";
    };

    project: {
      path: string;

      filesScanned: number;

      structure: ScanResult["projectStructure"];
    };

    technologyProfile: ScanResult["technologyProfile"];

    dependencyAnalysis: NonNullable<ScanResult["dependencyAnalysis"]>;

    health: NonNullable<ScanResult["health"]>;

    ai: NonNullable<ScanResult["ai"]>;

    aiRootCause: NonNullable<ScanResult["aiRootCause"]>;

    aiFixSuggestions: NonNullable<ScanResult["aiFixSuggestions"]>;

    validation: ValidationReport;

    findings: ValidationReport["findings"];

    summary: NonNullable<ScanResult["validation"]>;
  };
}

export class ConsoleReporter {
  start(
    context: ReporterContext
  ): void {
    console.log(
      "🔎 CodeSentinel Scanner"
    );

    console.log(
      "======================"
    );

    console.log(
      `Input: ${context.displayInput}`
    );

    if (
      context.workspacePath
    ) {
      console.log(
        `Workspace: ${context.workspacePath}`
      );
    }

    console.log(
      `Resolved Project: ${context.projectPath}`
    );

    console.log("");
  }

  complete(
    execution: ScanExecution
  ): void {
    const summary =
      execution.result.validation;

    const dependencies =
      execution.result.dependencyAnalysis;

    const health =
      execution.result.health;

    const ai =
      execution.result.ai;

    const aiRootCause =
      execution.result.aiRootCause;

    const aiFixSuggestions =
      execution.result.aiFixSuggestions;

    if (
      health
    ) {
      console.log(
        `CodeSentinel Health Score: ${health.score}/${health.maxScore} (${health.grade})`
      );

      console.log(
        [
          `Build: ${health.factors.find(factor => factor.name === "build")?.status ?? "unknown"}`,
          `Tests: ${health.factors.find(factor => factor.name === "tests")?.status ?? "unknown"}`,
          `Type Safety: ${health.factors.find(factor => factor.name === "type-safety")?.status ?? "unknown"}`,
          `Lint: ${health.factors.find(factor => factor.name === "lint")?.status ?? "unknown"}`,
          `Dependencies: ${health.factors.find(factor => factor.name === "dependencies")?.status ?? "unknown"}`,
          `Security: ${health.factors.find(factor => factor.name === "security")?.status ?? "unknown"}`
        ].join(" | ")
      );
    }

    if (
      ai
    ) {
      console.log(
        `AI Analysis Input: ${ai.findings.length} finding(s), ${ai.warnings.length} warning(s), structured context ready`
      );
    }

    if (
      aiRootCause
    ) {
      console.log(
        `AI Root-Cause Analysis: ${aiRootCause.analyses.length} finding(s) explained`
      );
    }

    if (
      aiFixSuggestions
    ) {
      console.log(
        `AI Fix Suggestions: ${aiFixSuggestions.suggestions.length} suggestion(s), mode ${aiFixSuggestions.mode}, no files modified`
      );
    }

    if (
      dependencies
    ) {
      console.log(
        [
          `Dependencies: direct ${dependencies.directDependencies.length}`,
          `dev ${dependencies.devDependencies.length}`,
          `peer ${dependencies.peerDependencies.length}`,
          `optional ${dependencies.optionalDependencies.length}`,
          `tree ${dependencies.dependencyTree.length}`,
          `outdated ${dependencies.outdatedDependencies.length}`,
          `engines ${dependencies.engineRequirements.length}`
        ].join(" | ")
      );
    }

    console.log(
      `Summary: ${summary?.passed ? "passed" : "failed"}`
    );

    if (
      summary
    ) {
      console.log(
        [
          `Passed: ${summary.passedCount}`,
          `Failed: ${summary.failedCount}`,
          `Warnings: ${summary.warningCount}`,
          `Skipped: ${summary.skippedCount}`
        ].join(" | ")
      );
    }
  }
}

export class JsonReporter {
  createOutput(
    execution: ScanExecution
  ): JsonScanOutput {
    return {
      scan: {
        metadata: {
          schemaVersion:
            "1.0.0",
          generatedAt:
            execution.result.completedAt,
          format:
            "json"
        },
        project: {
          path:
            execution.result.projectPath,
          filesScanned:
            execution.result.filesScanned,
          structure:
            execution.result.projectStructure
        },
        technologyProfile:
          execution.result.technologyProfile,
        dependencyAnalysis:
          execution.result.dependencyAnalysis ?? {
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
          execution.result.health ?? {
            score:
              0,
            maxScore:
              100,
            grade:
              "F",
            summary:
              "Health score was not calculated",
            factors:
              []
          },
        ai:
          execution.result.ai ?? {
            schemaVersion:
              "1.0.0",
            generatedAt:
              execution.result.completedAt,
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
                  execution.result.projectPath,
                filesScanned:
                  execution.result.filesScanned,
                structure:
                  execution.result.projectStructure
              },
            technologyProfile:
              execution.result.technologyProfile,
            dependencyAnalysis:
              execution.result.dependencyAnalysis,
            health:
              execution.result.health,
            validation:
              execution.result.validation,
            findings:
              [],
            warnings:
              []
          },
        aiRootCause:
          execution.result.aiRootCause ?? {
            schemaVersion:
              "1.0.0",
            generatedAt:
              execution.result.completedAt,
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
              [],
            skipped:
              {
                reason:
                  "Root-cause analysis was not calculated",
                count:
                  0
              }
          },
        aiFixSuggestions:
          execution.result.aiFixSuggestions ?? {
            schemaVersion:
              "1.0.0",
            generatedAt:
              execution.result.completedAt,
            purpose:
              "ai-fix-suggestions",
            mode:
              "suggestion-only",
            guardrails:
              {
                suggestionOnly:
                  true,
                automaticPatchApplied:
                  false,
                showAffectedFilesBeforePatch:
                  true,
                showDiffBeforePatch:
                  true,
                requireExplicitConfirmation:
                  true,
                runValidationAfterPatch:
                  true,
                rollbackIfValidationWorsens:
                  true
              },
            suggestions:
              [],
            skipped:
              {
                reason:
                  "Fix suggestions were not calculated",
                count:
                  0
              }
          },
        validation:
          execution.validationReport,
        findings:
          execution.validationReport.findings,
        summary:
          execution.result.validation ?? {
            passed:
              false,
            total:
              0,
            passedCount:
              0,
            failedCount:
              0,
            warningCount:
              0,
            skippedCount:
              0
          }
      }
    };
  }

  write(
    execution: ScanExecution
  ): void {
    console.log(
      JSON.stringify(
        this.createOutput(
          execution
        ),
        null,
        2
      )
    );
  }
}

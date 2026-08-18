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
    console.log(
      `Summary: ${execution.result.validation?.passed ? "passed" : "failed"}`
    );
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

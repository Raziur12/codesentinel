export type DetectionCategory =
  | "language"
  | "framework"
  | "database"
  | "runtime"
  | "build-tool"
  | "package-manager"
  | "infrastructure"
  | "unknown";

export interface ScanContext {
  projectPath: string;
  files: string[];
}

export interface DetectionResult {
  technology: string;
  category: DetectionCategory;
  confidence: number;
  evidence: string[];
}

export interface TechnologyProfileItem {
  name: string;
  confidence: number;
  evidence: string[];
}

export interface TechnologyProfile {
  languages: TechnologyProfileItem[];
  runtimes: TechnologyProfileItem[];
  frameworks: TechnologyProfileItem[];
  databases: TechnologyProfileItem[];
  buildTools: TechnologyProfileItem[];
  packageManagers: TechnologyProfileItem[];
  infrastructure: TechnologyProfileItem[];
  unknown: TechnologyProfileItem[];
}

export type PackageManagerName =
  | "npm"
  | "yarn"
  | "pnpm"
  | "bun";

export interface PackageManagerDetection {
  name: PackageManagerName;
  confidence: number;
  evidence: string[];
}

export interface PackageManagerPackageJson {
  packageManager?: string;
}

export interface ScannerPlugin {
  id: string;
  name: string;

  detect(
    context: ScanContext
  ): Promise<DetectionResult[]>;
}

function getDeclaredPackageManager(
  packageJson: PackageManagerPackageJson | null
): PackageManagerName | null {
  const declaredName =
    packageJson?.packageManager
      ?.split("@")[0]
      ?.toLowerCase();

  if (
    declaredName === "npm" ||
    declaredName === "yarn" ||
    declaredName === "pnpm" ||
    declaredName === "bun"
  ) {
    return declaredName;
  }

  return null;
}

function hasFile(
  files: string[],
  fileName: string
): boolean {
  return files.some(
    file =>
      file.replace(/\\/g, "/") === fileName
  );
}

export function detectPackageManager(
  files: string[],
  packageJson: PackageManagerPackageJson | null
): PackageManagerDetection {
  const evidence: string[] = [];

  const declaredPackageManager =
    getDeclaredPackageManager(
      packageJson
    );

  if (
    declaredPackageManager
  ) {
    evidence.push(
      `packageManager field declares ${declaredPackageManager}`
    );
  }

  const lockfileManagers:
    PackageManagerName[] = [];

  if (
    hasFile(files, "package-lock.json")
  ) {
    lockfileManagers.push("npm");
    evidence.push("package-lock.json detected");
  }

  if (
    hasFile(files, "yarn.lock")
  ) {
    lockfileManagers.push("yarn");
    evidence.push("yarn.lock detected");
  }

  if (
    hasFile(files, "pnpm-lock.yaml")
  ) {
    lockfileManagers.push("pnpm");
    evidence.push("pnpm-lock.yaml detected");
  }

  if (
    hasFile(files, "bun.lock") ||
    hasFile(files, "bun.lockb")
  ) {
    lockfileManagers.push("bun");
    evidence.push("bun lockfile detected");
  }

  const name =
    declaredPackageManager ??
    lockfileManagers[0] ??
    "npm";

  const confidence =
    declaredPackageManager
      ? 0.99
      : lockfileManagers.length > 0
        ? 0.95
        : 0.5;

  if (
    evidence.length === 0
  ) {
    evidence.push(
      "No package manager metadata found; defaulting to npm"
    );
  }

  return {
    name,
    confidence,
    evidence
  };
}

export interface ProjectStructure {
  rootFiles: string[];
  directories: string[];
  frontend: boolean;
  backend: boolean;
  tests: boolean;
  configuration: string[];
  packageFiles: string[];
  infrastructure: string[];
}

export type DependencyScope =
  | "direct"
  | "dev"
  | "peer"
  | "optional";

export interface DependencyEntry {
  name: string;
  specifier: string;
  scope: DependencyScope;
  installedVersion?: string;
}

export interface DependencyTreeNode {
  name: string;
  version?: string;
  path: string;
  dependencies: string[];
  dev: boolean;
  optional: boolean;
  peer: boolean;
  engines?: Record<string, string>;
}

export interface DependencyIssue {
  code: string;
  title: string;
  message: string;
  packageName?: string;
  severity: FindingSeverity;
  metadata?: Record<string, unknown>;
}

export interface DependencyAnalysis {
  packageManager: PackageManagerName;
  packageFile?: string;
  lockfile?: string;
  directDependencies: DependencyEntry[];
  devDependencies: DependencyEntry[];
  peerDependencies: DependencyEntry[];
  optionalDependencies: DependencyEntry[];
  dependencyTree: DependencyTreeNode[];
  outdatedDependencies: DependencyIssue[];
  engineRequirements: DependencyIssue[];
  dependencyConflicts: DependencyIssue[];
  peerDependencyConflicts: DependencyIssue[];
}

export type HealthFactorName =
  | "build"
  | "tests"
  | "type-safety"
  | "lint"
  | "dependencies"
  | "security"
  | "configuration"
  | "architecture"
  | "runtime";

export type HealthFactorStatus =
  | "passed"
  | "warning"
  | "failed"
  | "skipped";

export interface HealthFactor {
  name: HealthFactorName;
  label: string;
  status: HealthFactorStatus;
  score: number;
  maxScore: number;
  deductions: number;
  summary: string;
  evidence: string[];
}

export interface ProjectHealthScore {
  score: number;
  maxScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  factors: HealthFactor[];
}

export interface AiFindingInput {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  code?: string;
  title: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  source: string;
  suggestion?: string;
  documentation?: string;
  confidence: number;
  evidence?: string;
  metadata?: Record<string, unknown>;
}

export interface AiAnalysisInput {
  schemaVersion: "1.0.0";
  generatedAt: string;
  purpose: "ai-analysis-input";
  guardrails: {
    deterministicValidationIsAuthoritative: true;
    doNotReplaceValidation: true;
    useStructuredFindingsBeforeTerminalOutput: true;
    requireEvidenceLabels: Array<"confirmed" | "inferred" | "uncertain">;
  };
  project: {
    path: string;
    filesScanned: number;
    structure: ProjectStructure;
  };
  health?: ProjectHealthScore;
  technologyProfile: TechnologyProfile;
  dependencyAnalysis?: DependencyAnalysis;
  validation?: ValidationSummary;
  findings: AiFindingInput[];
  warnings: AiFindingInput[];
}

export type AiEvidenceLabel =
  | "confirmed"
  | "inferred"
  | "uncertain";

export interface AiExplanationSection {
  label: AiEvidenceLabel;
  text: string;
  evidence: string[];
}

export interface AiFindingRootCauseAnalysis {
  findingId: string;
  severity: FindingSeverity;
  category: FindingCategory;
  code?: string;
  title: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  rootCause: AiExplanationSection;
  whyItHappened: AiExplanationSection;
  codeCausedIt: AiExplanationSection;
  howToFix: AiExplanationSection;
  potentialSideEffects: AiExplanationSection;
}

export interface AiRootCauseAnalysis {
  schemaVersion: "1.0.0";
  generatedAt: string;
  purpose: "ai-root-cause-analysis";
  guardrails: AiAnalysisInput["guardrails"];
  analyses: AiFindingRootCauseAnalysis[];
  skipped: {
    reason: string;
    count: number;
  };
}

export type AiFixMode =
  | "suggestion-only"
  | "dry-run"
  | "interactive";

export interface AiFixSuggestion {
  findingId: string;
  severity: FindingSeverity;
  category: FindingCategory;
  code?: string;
  title: string;
  affectedFiles: string[];
  recommendedFix: AiExplanationSection;
  suggestedAction: string;
  diffPreview?: string;
  requiresConfirmation: true;
  validationRequiredAfterChange: true;
  rollbackRequiredIfValidationWorsens: true;
  automaticPatchApplied: false;
}

export interface AiFixSuggestions {
  schemaVersion: "1.0.0";
  generatedAt: string;
  purpose: "ai-fix-suggestions";
  mode: AiFixMode;
  guardrails: {
    suggestionOnly: true;
    automaticPatchApplied: false;
    showAffectedFilesBeforePatch: true;
    showDiffBeforePatch: true;
    requireExplicitConfirmation: true;
    runValidationAfterPatch: true;
    rollbackIfValidationWorsens: true;
  };
  suggestions: AiFixSuggestion[];
  skipped: {
    reason: string;
    count: number;
  };
}

export interface AiPatchProposal {
  id: string;
  findingId: string;
  title: string;
  affectedFiles: string[];
  diffPreview: string;
  validationCommands: string[];
  status: "proposed";
  automaticPatchApplied: false;
  requiresConfirmation: true;
}

export interface AiPatchPlan {
  schemaVersion: "1.0.0";
  generatedAt: string;
  purpose: "ai-patch-plan";
  provider: string;
  patches: AiPatchProposal[];
  skipped: {
    reason: string;
  };
  guardrails: {
    automaticPatchApplied: false;
    requireExplicitConfirmation: true;
    runValidationAfterPatch: true;
    rollbackIfValidationWorsens: true;
  };
}

export interface AiAnalysisBundle {
  provider: string;
  input: AiAnalysisInput;
  rootCause: AiRootCauseAnalysis;
  fixSuggestions: AiFixSuggestions;
  patchPlan: AiPatchPlan;
}

export interface AiProvider {
  id: string;
  name: string;
  capabilities: {
    analyzeFindings: boolean;
    explainFinding: boolean;
    suggestFix: boolean;
    generatePatch: boolean;
  };
  analyzeFindings(
    input: AiAnalysisInput
  ): Promise<AiRootCauseAnalysis>;
  explainFinding(
    finding: AiFindingInput,
    context: AiAnalysisInput
  ): Promise<AiFindingRootCauseAnalysis>;
  suggestFix(
    rootCauseAnalysis: AiRootCauseAnalysis,
    mode?: AiFixMode
  ): Promise<AiFixSuggestions>;
  generatePatch(
    fixSuggestions: AiFixSuggestions
  ): Promise<AiPatchPlan>;
}

export interface HealthValidationResult {
  name: string;
  status: HealthFactorStatus;
  category: FindingCategory;
  skipReason?: string;
}

export interface HealthValidationReport {
  results: HealthValidationResult[];
  findings: CommonFinding[];
  warnings: CommonFinding[];
}

export interface ValidationSummary {
  passed: boolean;
  total: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
}

export type FindingSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type FindingCategory =
  | "build"
  | "test"
  | "lint"
  | "type-check"
  | "dependency"
  | "engine"
  | "security"
  | "secret"
  | "architecture"
  | "technology"
  | "configuration"
  | "runtime";

export interface CommonFinding {
  id: string;

  key: string;

  severity: FindingSeverity;

  category: FindingCategory;

  code?: string;

  title: string;

  message: string;

  file?: string;

  line?: number;

  column?: number;

  source: string;

  command?: string;

  suggestion?: string;

  documentation?: string;

  confidence: number;

  metadata?: Record<string, unknown>;
}

export interface ScannerFinding extends CommonFinding {
  evidence?: string;
}

export interface SecurityReport {
  schemaVersion: "1.0.0";
  generatedAt: string;
  status: "passed" | "failed";
  summary: {
    totalFindings: number;
    securityFindings: number;
    secretFindings: number;
    dependencyRiskSignals: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  checks: {
    audit: HealthFactorStatus;
    secrets: HealthFactorStatus;
  };
  findings: CommonFinding[];
  recommendations: string[];
}

function hashFindingKey(
  key: string
): string {
  let hash =
    5381;

  for (
    let index = 0;
    index < key.length;
    index += 1
  ) {
    hash =
      (hash * 33) ^
      key.charCodeAt(index);
  }

  return (
    hash >>> 0
  ).toString(36);
}

export function createFindingKey(
  finding: Pick<
    CommonFinding,
    "category" | "message" | "source"
  > &
    Partial<
      Pick<
        CommonFinding,
        "code" | "file" | "line" | "column"
      >
    >
): string {
  return [
    finding.source,
    finding.category,
    finding.code ?? "",
    finding.file ?? "",
    finding.line ?? "",
    finding.column ?? "",
    finding.message.trim()
  ].join("|");
}

export function createFindingId(
  key: string
): string {
  return `cs_${hashFindingKey(key)}`;
}

function countSeverity(
  findings: CommonFinding[],
  severity: FindingSeverity
): number {
  return findings.filter(
    finding => finding.severity === severity
  ).length;
}

function getValidationStatus(
  validation: {
    results: Array<{
      category: FindingCategory;
      status: HealthFactorStatus;
    }>;
  },
  category: FindingCategory
): HealthFactorStatus {
  return validation.results.find(
    result => result.category === category
  )?.status ?? "skipped";
}

export function createSecurityReport(
  input: {
    generatedAt: string;
    validation: {
      results: Array<{
        category: FindingCategory;
        status: HealthFactorStatus;
      }>;
      findings: CommonFinding[];
      warnings: CommonFinding[];
    };
    dependencyAnalysis?: DependencyAnalysis;
  }
): SecurityReport {
  const securityFindings =
    [
      ...input.validation.findings,
      ...input.validation.warnings
    ].filter(
      finding =>
        finding.category === "security" ||
        finding.category === "secret"
    );

  const dependencyRiskSignals =
    [
      ...(input.dependencyAnalysis?.outdatedDependencies ?? []),
      ...(input.dependencyAnalysis?.engineRequirements ?? []),
      ...(input.dependencyAnalysis?.dependencyConflicts ?? []),
      ...(input.dependencyAnalysis?.peerDependencyConflicts ?? [])
    ];

  const recommendations =
    securityFindings.length === 0
      ? [
          "No active security or secret findings were detected.",
          "Keep dependency, audit, and secret checks enabled in CI."
        ]
      : [
          "Fix critical and high security findings before release.",
          "Rotate any exposed secrets and move credentials to a secret manager.",
          "Re-run CodeSentinel after remediation to confirm the security status."
        ];

  return {
    schemaVersion:
      "1.0.0",
    generatedAt:
      input.generatedAt,
    status:
      securityFindings.some(
        finding =>
          finding.severity === "critical" ||
          finding.severity === "high"
      )
        ? "failed"
        : "passed",
    summary:
      {
        totalFindings:
          securityFindings.length,
        securityFindings:
          securityFindings.filter(
            finding => finding.category === "security"
          ).length,
        secretFindings:
          securityFindings.filter(
            finding => finding.category === "secret"
          ).length,
        dependencyRiskSignals:
          dependencyRiskSignals.length,
        critical:
          countSeverity(
            securityFindings,
            "critical"
          ),
        high:
          countSeverity(
            securityFindings,
            "high"
          ),
        medium:
          countSeverity(
            securityFindings,
            "medium"
          ),
        low:
          countSeverity(
            securityFindings,
            "low"
          ),
        info:
          countSeverity(
            securityFindings,
            "info"
          )
      },
    checks:
      {
        audit:
          getValidationStatus(
            input.validation,
            "security"
          ),
        secrets:
          getValidationStatus(
            input.validation,
            "secret"
          )
      },
    findings:
      securityFindings,
    recommendations
  };
}

export interface ScanResult {
  projectPath: string;
  filesScanned: number;

  projectStructure: ProjectStructure;

  technologies: DetectionResult[];

  technologyProfile: TechnologyProfile;

  dependencyAnalysis?: DependencyAnalysis;

  health?: ProjectHealthScore;

  securityReport?: SecurityReport;

  ai?: AiAnalysisInput;

  aiRootCause?: AiRootCauseAnalysis;

  aiFixSuggestions?: AiFixSuggestions;

  aiPatchPlan?: AiPatchPlan;

  aiProvider?: {
    id: string;
    name: string;
  };

  validation?: ValidationSummary;

  startedAt: string;
  completedAt: string;
}

function normalizeAiFinding(
  finding: CommonFinding & {
    evidence?: string;
  }
): AiFindingInput {
  return {
    id:
      finding.id,
    severity:
      finding.severity,
    category:
      finding.category,
    code:
      finding.code,
    title:
      finding.title,
    message:
      finding.message,
    file:
      finding.file,
    line:
      finding.line,
    column:
      finding.column,
    source:
      finding.source,
    suggestion:
      finding.suggestion,
    documentation:
      finding.documentation,
    confidence:
      finding.confidence,
    evidence:
      finding.evidence,
    metadata:
      finding.metadata
  };
}

export function createAiAnalysisInput(
  input: {
    projectPath: string;
    filesScanned: number;
    projectStructure: ProjectStructure;
    technologyProfile: TechnologyProfile;
    dependencyAnalysis?: DependencyAnalysis;
    health?: ProjectHealthScore;
    validation?: ValidationSummary;
    findings: Array<CommonFinding & {
      evidence?: string;
    }>;
    warnings: Array<CommonFinding & {
      evidence?: string;
    }>;
    generatedAt?: string;
  }
): AiAnalysisInput {
  return {
    schemaVersion:
      "1.0.0",
    generatedAt:
      input.generatedAt ?? new Date().toISOString(),
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
          input.projectPath,
        filesScanned:
          input.filesScanned,
        structure:
          input.projectStructure
      },
    health:
      input.health,
    technologyProfile:
      input.technologyProfile,
    dependencyAnalysis:
      input.dependencyAnalysis,
    validation:
      input.validation,
    findings:
      input.findings.map(
        normalizeAiFinding
      ),
    warnings:
      input.warnings.map(
        normalizeAiFinding
      )
  };
}

function createExplanationSection(
  label: AiEvidenceLabel,
  text: string,
  evidence: string[]
): AiExplanationSection {
  return {
    label,
    text,
    evidence
  };
}

function getFindingLocationText(
  finding: AiFindingInput
): string | undefined {
  if (
    !finding.file
  ) {
    return undefined;
  }

  if (
    finding.line === undefined
  ) {
    return finding.file;
  }

  if (
    finding.column === undefined
  ) {
    return `${finding.file}:${finding.line}`;
  }

  return `${finding.file}:${finding.line}:${finding.column}`;
}

function getFindingEvidence(
  finding: AiFindingInput
): string[] {
  return [
    finding.code
      ? `Code: ${finding.code}`
      : undefined,
    getFindingLocationText(
      finding
    )
      ? `Location: ${getFindingLocationText(finding)}`
      : undefined,
    finding.evidence
      ? `Evidence: ${finding.evidence}`
      : undefined,
    `Message: ${finding.message}`,
    `Source: ${finding.source}`,
    `Confidence: ${finding.confidence}`
  ].filter(
    (item): item is string =>
      Boolean(
        item
      )
  );
}

function explainTypeScriptFinding(
  finding: AiFindingInput,
  evidence: string[]
): Omit<
  AiFindingRootCauseAnalysis,
  "findingId" | "severity" | "category" | "code" | "title" | "location"
> {
  const location =
    getFindingLocationText(
      finding
    ) ?? "the reported TypeScript location";

  return {
    rootCause:
      createExplanationSection(
        "confirmed",
        `TypeScript reported ${finding.code ?? "a type-check error"} at ${location}.`,
        evidence
      ),
    whyItHappened:
      createExplanationSection(
        "inferred",
        "The code shape does not match the type contract expected by the TypeScript compiler.",
        evidence
      ),
    codeCausedIt:
      createExplanationSection(
        finding.file
          ? "confirmed"
          : "uncertain",
        finding.file
          ? `The relevant code is in ${location}.`
          : "The validation output did not include a concrete source file.",
        evidence
      ),
    howToFix:
      createExplanationSection(
        finding.suggestion
          ? "confirmed"
          : "inferred",
        finding.suggestion ??
          "Update the value, type annotation, or API usage so the assigned value matches the expected type.",
        evidence
      ),
    potentialSideEffects:
      createExplanationSection(
        "inferred",
        "Changing a type or value can affect callers that rely on the current shape. Re-run type-check, tests, and build after the fix.",
        evidence
      )
  };
}

function explainSecretFinding(
  finding: AiFindingInput,
  evidence: string[]
): Omit<
  AiFindingRootCauseAnalysis,
  "findingId" | "severity" | "category" | "code" | "title" | "location"
> {
  const location =
    getFindingLocationText(
      finding
    ) ?? "the reported source location";

  return {
    rootCause:
      createExplanationSection(
        "confirmed",
        `A high-confidence secret pattern was detected at ${location}.`,
        evidence
      ),
    whyItHappened:
      createExplanationSection(
        "inferred",
        "A credential-like value appears to have been committed or generated into source-controlled project files.",
        evidence
      ),
    codeCausedIt:
      createExplanationSection(
        finding.file
          ? "confirmed"
          : "uncertain",
        finding.file
          ? `The exposed value is in ${location}.`
          : "The detector did not provide a concrete file location.",
        evidence
      ),
    howToFix:
      createExplanationSection(
        "confirmed",
        finding.suggestion ??
          "Remove the credential from source control, move it to a secret manager or environment variable, and rotate the exposed value.",
        evidence
      ),
    potentialSideEffects:
      createExplanationSection(
        "inferred",
        "Rotating the credential may require updating deployment, CI, or runtime secret configuration before the old value is revoked.",
        evidence
      )
  };
}

function explainSecurityFinding(
  finding: AiFindingInput,
  evidence: string[]
): Omit<
  AiFindingRootCauseAnalysis,
  "findingId" | "severity" | "category" | "code" | "title" | "location"
> {
  const packageName =
    typeof finding.metadata?.packageName === "string"
      ? finding.metadata.packageName
      : "the affected package";

  return {
    rootCause:
      createExplanationSection(
        "confirmed",
        `A security issue was reported for ${packageName}.`,
        evidence
      ),
    whyItHappened:
      createExplanationSection(
        "inferred",
        "The dependency graph includes a package version that matches a known vulnerable range.",
        evidence
      ),
    codeCausedIt:
      createExplanationSection(
        "inferred",
        "The dependency declaration or lockfile selection brought the vulnerable package into the project.",
        evidence
      ),
    howToFix:
      createExplanationSection(
        finding.suggestion
          ? "confirmed"
          : "inferred",
        finding.suggestion ??
          "Upgrade, patch, or replace the vulnerable dependency and re-run security validation.",
        evidence
      ),
    potentialSideEffects:
      createExplanationSection(
        "inferred",
        "Dependency upgrades can change runtime behavior or transitive package versions. Re-run tests, build, and audit after updating.",
        evidence
      )
  };
}

function explainGenericFinding(
  finding: AiFindingInput,
  evidence: string[]
): Omit<
  AiFindingRootCauseAnalysis,
  "findingId" | "severity" | "category" | "code" | "title" | "location"
> {
  const location =
    getFindingLocationText(
      finding
    );

  return {
    rootCause:
      createExplanationSection(
        "confirmed",
        finding.message,
        evidence
      ),
    whyItHappened:
      createExplanationSection(
        "uncertain",
        "The structured finding does not contain enough category-specific context to prove the deeper cause.",
        evidence
      ),
    codeCausedIt:
      createExplanationSection(
        location
          ? "confirmed"
          : "uncertain",
        location
          ? `The finding points to ${location}.`
          : "No exact source location was provided.",
        evidence
      ),
    howToFix:
      createExplanationSection(
        finding.suggestion
          ? "confirmed"
          : "uncertain",
        finding.suggestion ??
          "Use the finding message and validation output to identify the smallest safe change, then re-run validation.",
        evidence
      ),
    potentialSideEffects:
      createExplanationSection(
        "uncertain",
        "Side effects depend on the code path changed. Re-run the relevant validator and tests after editing.",
        evidence
      )
  };
}

function explainFinding(
  finding: AiFindingInput
): AiFindingRootCauseAnalysis {
  const evidence =
    getFindingEvidence(
      finding
    );

  const sections =
    finding.category === "type-check" ||
    finding.code?.startsWith("TS")
      ? explainTypeScriptFinding(
          finding,
          evidence
        )
      : finding.category === "secret"
        ? explainSecretFinding(
            finding,
            evidence
          )
        : finding.category === "security"
          ? explainSecurityFinding(
              finding,
              evidence
            )
          : explainGenericFinding(
              finding,
              evidence
            );

  return {
    findingId:
      finding.id,
    severity:
      finding.severity,
    category:
      finding.category,
    code:
      finding.code,
    title:
      finding.title,
    location:
      finding.file ||
      finding.line !== undefined ||
      finding.column !== undefined
        ? {
            file:
              finding.file,
            line:
              finding.line,
            column:
              finding.column
          }
        : undefined,
    ...sections
  };
}

export function createAiRootCauseAnalysis(
  input: AiAnalysisInput
): AiRootCauseAnalysis {
  const explainableIssues =
    [
      ...input.findings,
      ...input.warnings
    ];

  return {
    schemaVersion:
      "1.0.0",
    generatedAt:
      input.generatedAt,
    purpose:
      "ai-root-cause-analysis",
    guardrails:
      input.guardrails,
    analyses:
      explainableIssues.map(
        explainFinding
      ),
    skipped:
      {
        reason:
          explainableIssues.length === 0
            ? "No findings or warnings available for root-cause analysis"
            : "All active findings and warnings are analyzed",
        count:
          0
      }
  };
}

function getSuggestedAction(
  analysis: AiFindingRootCauseAnalysis
): string {
  if (
    analysis.category === "secret"
  ) {
    return "Remove the secret from source, move it to a secure runtime secret store, and rotate the exposed credential.";
  }

  if (
    analysis.category === "security"
  ) {
    return analysis.howToFix.text;
  }

  if (
    analysis.category === "type-check" ||
    analysis.code?.startsWith("TS")
  ) {
    return analysis.howToFix.text;
  }

  return analysis.howToFix.text;
}

function getDiffPreview(
  analysis: AiFindingRootCauseAnalysis
): string | undefined {
  const file =
    analysis.location?.file;

  if (
    !file
  ) {
    return undefined;
  }

  if (
    analysis.category === "secret"
  ) {
    return [
      `--- ${file}`,
      `+++ ${file}`,
      "@@ suggestion-only @@",
      "- <hard-coded secret>",
      "+ process.env.<SECRET_NAME>"
    ].join("\n");
  }

  if (
    analysis.category === "type-check" ||
    analysis.code?.startsWith("TS")
  ) {
    return [
      `--- ${file}`,
      `+++ ${file}`,
      "@@ suggestion-only @@",
      "- <code that violates the reported type contract>",
      "+ <code updated to match the expected type contract>"
    ].join("\n");
  }

  return undefined;
}

export function createAiFixSuggestions(
  input: {
    rootCauseAnalysis: AiRootCauseAnalysis;
    mode?: AiFixMode;
  }
): AiFixSuggestions {
  const suggestions =
    input.rootCauseAnalysis.analyses.map(
      analysis => ({
        findingId:
          analysis.findingId,
        severity:
          analysis.severity,
        category:
          analysis.category,
        code:
          analysis.code,
        title:
          analysis.title,
        affectedFiles:
          analysis.location?.file
            ? [analysis.location.file]
            : [],
        recommendedFix:
          analysis.howToFix,
        suggestedAction:
          getSuggestedAction(
            analysis
          ),
        diffPreview:
          getDiffPreview(
            analysis
          ),
        requiresConfirmation:
          true as const,
        validationRequiredAfterChange:
          true as const,
        rollbackRequiredIfValidationWorsens:
          true as const,
        automaticPatchApplied:
          false as const
      })
    );

  return {
    schemaVersion:
      "1.0.0",
    generatedAt:
      input.rootCauseAnalysis.generatedAt,
    purpose:
      "ai-fix-suggestions",
    mode:
      input.mode ?? "suggestion-only",
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
    suggestions,
    skipped:
      {
        reason:
          suggestions.length === 0
            ? "No active findings available for fix suggestions"
            : "Automatic patch generation is disabled in this version",
        count:
          input.rootCauseAnalysis.skipped.count
      }
  };
}

export function createEmptyPatchPlan(
  input: {
    generatedAt: string;
    provider: string;
    reason?: string;
  }
): AiPatchPlan {
  return {
    schemaVersion:
      "1.0.0",
    generatedAt:
      input.generatedAt,
    purpose:
      "ai-patch-plan",
    provider:
      input.provider,
    patches:
      [],
    skipped:
      {
        reason:
          input.reason ??
          "Patch generation is disabled until interactive confirmation and validation rollback are implemented"
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
  };
}

export function createAiPatchPlan(
  input: {
    fixSuggestions: AiFixSuggestions;
    provider: string;
  }
): AiPatchPlan {
  const patches =
    input.fixSuggestions.suggestions.map(
      suggestion => ({
        id:
          `${suggestion.findingId}_patch`,
        findingId:
          suggestion.findingId,
        title:
          suggestion.title,
        affectedFiles:
          suggestion.affectedFiles,
        diffPreview:
          suggestion.diffPreview ??
          "No diff preview is available for this suggestion.",
        validationCommands:
          [
            "npm test",
            "npm run build",
            "npm run lint"
          ],
        status:
          "proposed" as const,
        automaticPatchApplied:
          false as const,
        requiresConfirmation:
          true as const
      })
    );

  return {
    schemaVersion:
      "1.0.0",
    generatedAt:
      input.fixSuggestions.generatedAt,
    purpose:
      "ai-patch-plan",
    provider:
      input.provider,
    patches,
    skipped:
      {
        reason:
          patches.length === 0
            ? "No active fix suggestions available for patch planning"
            : "Patch plan generated; no files were modified"
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
  };
}

export class LocalDeterministicAiProvider implements AiProvider {
  id =
    "local-deterministic";

  name =
    "Local deterministic AI provider";

  capabilities = {
    analyzeFindings:
      true,
    explainFinding:
      true,
    suggestFix:
      true,
    generatePatch:
      true
  };

  async analyzeFindings(
    input: AiAnalysisInput
  ): Promise<AiRootCauseAnalysis> {
    return createAiRootCauseAnalysis(
      input
    );
  }

  async explainFinding(
    finding: AiFindingInput,
    context: AiAnalysisInput
  ): Promise<AiFindingRootCauseAnalysis> {
    const analysis =
      createAiRootCauseAnalysis({
        ...context,
        findings:
          [finding],
        warnings:
          []
      });

    const result =
      analysis.analyses[0];

    if (
      !result
    ) {
      throw new Error(
        "Unable to explain finding"
      );
    }

    return result;
  }

  async suggestFix(
    rootCauseAnalysis: AiRootCauseAnalysis,
    mode?: AiFixMode
  ): Promise<AiFixSuggestions> {
    return createAiFixSuggestions({
      rootCauseAnalysis,
      mode
    });
  }

  async generatePatch(
    fixSuggestions: AiFixSuggestions
  ): Promise<AiPatchPlan> {
    return createAiPatchPlan({
      fixSuggestions,
      provider:
        this.id
    });
  }
}

export class NoopAiProvider implements AiProvider {
  id =
    "none";

  name =
    "No AI provider";

  capabilities = {
    analyzeFindings:
      false,
    explainFinding:
      false,
    suggestFix:
      false,
    generatePatch:
      false
  };

  async analyzeFindings(
    input: AiAnalysisInput
  ): Promise<AiRootCauseAnalysis> {
    return {
      schemaVersion:
        "1.0.0",
      generatedAt:
        input.generatedAt,
      purpose:
        "ai-root-cause-analysis",
      guardrails:
        input.guardrails,
      analyses:
        [],
      skipped:
        {
          reason:
            "No AI provider is configured",
          count:
            input.findings.length + input.warnings.length
        }
    };
  }

  async explainFinding(
    finding: AiFindingInput,
    context: AiAnalysisInput
  ): Promise<AiFindingRootCauseAnalysis> {
    const analysis =
      await this.analyzeFindings({
        ...context,
        findings:
          [finding],
        warnings:
          []
      });

    const result =
      analysis.analyses[0];

    if (
      !result
    ) {
      throw new Error(
        "No AI provider is configured"
      );
    }

    return result;
  }

  async suggestFix(
    rootCauseAnalysis: AiRootCauseAnalysis
  ): Promise<AiFixSuggestions> {
    return {
      schemaVersion:
        "1.0.0",
      generatedAt:
        rootCauseAnalysis.generatedAt,
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
            "No AI provider is configured",
          count:
            rootCauseAnalysis.analyses.length
        }
    };
  }

  async generatePatch(
    fixSuggestions: AiFixSuggestions
  ): Promise<AiPatchPlan> {
    return createEmptyPatchPlan({
      generatedAt:
        fixSuggestions.generatedAt,
      provider:
        this.id,
      reason:
        "No AI provider is configured"
    });
  }
}

const anthropicApiUrl =
  "https://api.anthropic.com/v1/messages";

const defaultAnthropicModel =
  "claude-haiku-4-5-20251001";

const anthropicRequestTimeoutMs =
  15_000;

const anthropicMaxFindingsPerRequest =
  20;

const anthropicExplanationSectionSchema = {
  type: "object",
  properties: {
    label: {
      type: "string",
      enum: ["confirmed", "inferred", "uncertain"]
    },
    text: {
      type: "string"
    },
    evidence: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["label", "text", "evidence"]
} as const;

const anthropicRootCauseToolSchema = {
  name: "report_root_cause_analyses",
  description:
    "Report a root-cause analysis for each supplied finding or warning.",
  input_schema: {
    type: "object",
    properties: {
      analyses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            findingId: { type: "string" },
            severity: {
              type: "string",
              enum: ["critical", "high", "medium", "low", "info"]
            },
            category: { type: "string" },
            code: { type: "string" },
            title: { type: "string" },
            location: {
              type: "object",
              properties: {
                file: { type: "string" },
                line: { type: "number" },
                column: { type: "number" }
              }
            },
            rootCause: anthropicExplanationSectionSchema,
            whyItHappened: anthropicExplanationSectionSchema,
            codeCausedIt: anthropicExplanationSectionSchema,
            howToFix: anthropicExplanationSectionSchema,
            potentialSideEffects: anthropicExplanationSectionSchema
          },
          required: [
            "findingId",
            "severity",
            "category",
            "title",
            "rootCause",
            "whyItHappened",
            "codeCausedIt",
            "howToFix",
            "potentialSideEffects"
          ]
        }
      }
    },
    required: ["analyses"]
  }
} as const;

function isPlausibleRootCauseAnalysis(
  value: unknown
): value is AiFindingRootCauseAnalysis {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.findingId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.rootCause === "object" &&
    typeof candidate.whyItHappened === "object" &&
    typeof candidate.codeCausedIt === "object" &&
    typeof candidate.howToFix === "object" &&
    typeof candidate.potentialSideEffects === "object"
  );
}

function buildAnthropicRootCausePrompt(
  input: AiAnalysisInput
): string {
  const issues =
    [
      ...input.findings,
      ...input.warnings
    ].slice(
      0,
      anthropicMaxFindingsPerRequest
    );

  const issuesJson =
    JSON.stringify(
      issues.map(
        issue => ({
          id: issue.id,
          severity: issue.severity,
          category: issue.category,
          code: issue.code,
          title: issue.title,
          message: issue.message,
          file: issue.file,
          line: issue.line,
          column: issue.column,
          suggestion: issue.suggestion
        })
      ),
      null,
      2
    );

  return [
    "You are analyzing findings from a deterministic software validation scan.",
    "The findings themselves are already confirmed by real tooling (build/test/lint/type-check/security/secret scanners) - do not second-guess whether they occurred.",
    "For each finding below, call the report_root_cause_analyses tool with one analysis per finding, explaining: rootCause, whyItHappened, codeCausedIt, howToFix, and potentialSideEffects.",
    "Every explanation section must carry a label of \"confirmed\" (directly supported by the evidence given), \"inferred\" (a reasonable deduction beyond the given evidence), or \"uncertain\" (a guess that should be verified). Do not fabricate certainty.",
    "",
    `Findings and warnings (${issues.length} of ${input.findings.length + input.warnings.length}):`,
    issuesJson
  ].join("\n");
}

/**
 * Calls the Anthropic Messages API with a tool-use request forcing
 * schema-constrained JSON output, so the response is parsed directly
 * rather than extracted from free-text.
 */
async function callAnthropicForRootCause(
  input: AiAnalysisInput,
  apiKey: string,
  model: string
): Promise<AiFindingRootCauseAnalysis[]> {
  const controller =
    new AbortController();

  const timeoutHandle =
    setTimeout(
      () => controller.abort(),
      anthropicRequestTimeoutMs
    );

  try {
    const response =
      await fetch(
        anthropicApiUrl,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            tools: [anthropicRootCauseToolSchema],
            tool_choice: {
              type: "tool",
              name: "report_root_cause_analyses"
            },
            messages: [
              {
                role: "user",
                content: buildAnthropicRootCausePrompt(input)
              }
            ]
          })
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Anthropic API responded with status ${response.status}`
      );
    }

    const payload =
      await response.json() as {
        content?: Array<{
          type: string;
          name?: string;
          input?: unknown;
        }>;
      };

    const toolUseBlock =
      payload.content?.find(
        block =>
          block.type === "tool_use" &&
          block.name === "report_root_cause_analyses"
      );

    const analyses =
      (toolUseBlock?.input as { analyses?: unknown[] } | undefined)?.analyses;

    if (
      !Array.isArray(analyses) ||
      analyses.length === 0 ||
      !analyses.every(isPlausibleRootCauseAnalysis)
    ) {
      throw new Error(
        "Anthropic response did not contain a well-formed root-cause analysis"
      );
    }

    return analyses;
  } finally {
    clearTimeout(
      timeoutHandle
    );
  }
}

/**
 * AI provider backed by a real call to the Anthropic Messages API.
 *
 * Explicitly opt-in only (selected via createAiProvider("anthropic"));
 * it is never the default provider, so existing callers and tests keep
 * using LocalDeterministicAiProvider unless they ask for this one.
 *
 * Every method fails open to LocalDeterministicAiProvider - no API key,
 * a network error, a timeout, or a malformed response all fall back to
 * the deterministic template output (with a skipped.reason explaining
 * why) rather than crashing the scan or returning nothing.
 */
export class AnthropicAiProvider implements AiProvider {
  id =
    "anthropic";

  name =
    "Anthropic AI provider";

  capabilities = {
    analyzeFindings:
      true,
    explainFinding:
      true,
    suggestFix:
      true,
    generatePatch:
      true
  };

  private readonly fallback =
    new LocalDeterministicAiProvider();

  private getModel(): string {
    return process.env.ANTHROPIC_MODEL?.trim() || defaultAnthropicModel;
  }

  async analyzeFindings(
    input: AiAnalysisInput
  ): Promise<AiRootCauseAnalysis> {
    const apiKey =
      process.env.ANTHROPIC_API_KEY?.trim();

    const issues =
      [
        ...input.findings,
        ...input.warnings
      ];

    if (
      !apiKey
    ) {
      const fallbackResult =
        await this.fallback.analyzeFindings(
          input
        );

      return {
        ...fallbackResult,
        skipped: {
          reason:
            "ANTHROPIC_API_KEY not set; used local-deterministic fallback",
          count:
            fallbackResult.skipped.count
        }
      };
    }

    if (
      issues.length === 0
    ) {
      return this.fallback.analyzeFindings(
        input
      );
    }

    try {
      const analyses =
        await callAnthropicForRootCause(
          input,
          apiKey,
          this.getModel()
        );

      return {
        schemaVersion:
          "1.0.0",
        generatedAt:
          input.generatedAt,
        purpose:
          "ai-root-cause-analysis",
        guardrails:
          input.guardrails,
        analyses,
        skipped:
          {
            reason:
              issues.length > analyses.length
                ? `Only the first ${analyses.length} of ${issues.length} findings/warnings were sent to Anthropic`
                : "All active findings and warnings are analyzed",
            count:
              Math.max(
                0,
                issues.length - analyses.length
              )
          }
      };
    } catch (error) {
      const fallbackResult =
        await this.fallback.analyzeFindings(
          input
        );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      return {
        ...fallbackResult,
        skipped: {
          reason:
            `Anthropic call failed (${message}); used local-deterministic fallback`,
          count:
            fallbackResult.skipped.count
        }
      };
    }
  }

  async explainFinding(
    finding: AiFindingInput,
    context: AiAnalysisInput
  ): Promise<AiFindingRootCauseAnalysis> {
    const analysis =
      await this.analyzeFindings({
        ...context,
        findings:
          [finding],
        warnings:
          []
      });

    const result =
      analysis.analyses[0];

    if (
      !result
    ) {
      return this.fallback.explainFinding(
        finding,
        context
      );
    }

    return result;
  }

  async suggestFix(
    rootCauseAnalysis: AiRootCauseAnalysis,
    mode?: AiFixMode
  ): Promise<AiFixSuggestions> {
    // Fix suggestions are template-derived scaffolding around an
    // already-computed root-cause analysis, with guardrails
    // (suggestion-only, no automatic patch application) that are fixed
    // safety properties rather than something an LLM should decide -
    // so this reuses the same deterministic logic regardless of which
    // provider produced the root-cause analysis above.
    return createAiFixSuggestions({
      rootCauseAnalysis,
      mode
    });
  }

  async generatePatch(
    fixSuggestions: AiFixSuggestions
  ): Promise<AiPatchPlan> {
    return createAiPatchPlan({
      fixSuggestions,
      provider:
        this.id
    });
  }
}

export function createAiProvider(
  providerId = "local-deterministic"
): AiProvider {
  if (
    providerId === "none"
  ) {
    return new NoopAiProvider();
  }

  if (
    providerId === "anthropic"
  ) {
    return new AnthropicAiProvider();
  }

  return new LocalDeterministicAiProvider();
}

function clampScore(
  value: number,
  max = 100
): number {
  return Math.max(
    0,
    Math.min(
      max,
      Math.round(
        value
      )
    )
  );
}

function getHealthGrade(
  score: number
): ProjectHealthScore["grade"] {
  if (
    score >= 90
  ) {
    return "A";
  }

  if (
    score >= 80
  ) {
    return "B";
  }

  if (
    score >= 70
  ) {
    return "C";
  }

  if (
    score >= 60
  ) {
    return "D";
  }

  return "F";
}

function createHealthFactor(
  input: Omit<HealthFactor, "score" | "deductions">
): HealthFactor {
  const ratioByStatus:
    Record<HealthFactorStatus, number> = {
    passed:
      1,
    warning:
      0.65,
    skipped:
      0.5,
    failed:
      0
  };

  const score =
    Math.round(
      input.maxScore *
      ratioByStatus[input.status]
    );

  return {
    ...input,
    score,
    deductions:
      input.maxScore - score
  };
}

function getValidationResult(
  validation: HealthValidationReport,
  category: FindingCategory
): HealthValidationResult | undefined {
  return validation.results.find(
    result =>
      result.category === category
  );
}

function createValidationHealthFactor(
  validation: HealthValidationReport,
  category: FindingCategory,
  name: HealthFactorName,
  label: string,
  maxScore: number
): HealthFactor {
  const result =
    getValidationResult(
      validation,
      category
    );

  const status =
    result?.status ?? "skipped";

  const evidence =
    result
      ? [
          `${result.name}: ${result.status}`,
          ...(result.skipReason
            ? [result.skipReason]
            : [])
        ]
      : [`No ${label.toLowerCase()} validation result found`];

  return createHealthFactor({
    name,
    label,
    status,
    maxScore,
    summary:
      status === "passed"
        ? `${label} passed`
        : status === "skipped"
          ? `${label} was skipped`
          : `${label} has ${status} status`,
    evidence
  });
}

function hasFindingsForCategories(
  findings: CommonFinding[],
  categories: FindingCategory[]
): boolean {
  return findings.some(
    finding =>
      categories.includes(
        finding.category
      )
  );
}

function hasWarningsForCategories(
  warnings: CommonFinding[],
  categories: FindingCategory[]
): boolean {
  return warnings.some(
    warning =>
      categories.includes(
        warning.category
      )
  );
}

function getDependencyHealthFactor(
  dependencyAnalysis: DependencyAnalysis,
  validation: HealthValidationReport
): HealthFactor {
  const dependencyIssues = [
    ...dependencyAnalysis.outdatedDependencies,
    ...dependencyAnalysis.dependencyConflicts,
    ...dependencyAnalysis.peerDependencyConflicts
  ];

  const dependencyFailed =
    hasFindingsForCategories(
      validation.findings,
      ["dependency", "engine"]
    );

  const dependencyWarnings =
    dependencyIssues.length > 0 ||
    dependencyAnalysis.engineRequirements.length > 0 ||
    hasWarningsForCategories(
      validation.warnings,
      ["dependency", "engine"]
    );

  const status:
    HealthFactorStatus =
    dependencyFailed
      ? "failed"
      : dependencyWarnings
        ? "warning"
        : "passed";

  return createHealthFactor({
    name:
      "dependencies",
    label:
      "Dependencies",
    status,
    maxScore:
      15,
    summary:
      dependencyIssues.length > 0
        ? `${dependencyIssues.length} dependency issue(s) detected`
        : "Dependency analysis completed",
    evidence: [
      `Direct dependencies: ${dependencyAnalysis.directDependencies.length}`,
      `Dev dependencies: ${dependencyAnalysis.devDependencies.length}`,
      `Peer dependencies: ${dependencyAnalysis.peerDependencies.length}`,
      `Optional dependencies: ${dependencyAnalysis.optionalDependencies.length}`,
      `Dependency tree nodes: ${dependencyAnalysis.dependencyTree.length}`,
      `Outdated/version drift signals: ${dependencyAnalysis.outdatedDependencies.length}`,
      `Engine requirements: ${dependencyAnalysis.engineRequirements.length}`,
      `Dependency conflicts: ${dependencyAnalysis.dependencyConflicts.length}`,
      `Peer dependency conflicts: ${dependencyAnalysis.peerDependencyConflicts.length}`
    ]
  });
}

function getSecurityHealthFactor(
  validation: HealthValidationReport
): HealthFactor {
  const securityCategories:
    FindingCategory[] = [
      "security",
      "secret"
    ];

  const hasSecurityFindings =
    hasFindingsForCategories(
      validation.findings,
      securityCategories
    );

  const hasSecurityWarnings =
    hasWarningsForCategories(
      validation.warnings,
      securityCategories
    );

  const securityResult =
    getValidationResult(
      validation,
      "security"
    );

  const secretResult =
    getValidationResult(
      validation,
      "secret"
    );

  const status:
    HealthFactorStatus =
    hasSecurityFindings
      ? "failed"
      : hasSecurityWarnings
        ? "warning"
        : securityResult?.status === "skipped" &&
            secretResult?.status === "skipped"
          ? "skipped"
          : "passed";

  return createHealthFactor({
    name:
      "security",
    label:
      "Security",
    status,
    maxScore:
      20,
    summary:
      status === "passed"
        ? "Security checks passed"
        : status === "skipped"
          ? "Security checks were skipped"
          : "Security findings detected",
    evidence: [
      `Security audit: ${securityResult?.status ?? "missing"}`,
      `Secret detection: ${secretResult?.status ?? "missing"}`
    ]
  });
}

function getConfigurationHealthFactor(
  projectStructure: ProjectStructure,
  validation: HealthValidationReport
): HealthFactor {
  const hasConfigurationFindings =
    hasFindingsForCategories(
      validation.findings,
      ["configuration"]
    );

  const hasConfigurationWarnings =
    hasWarningsForCategories(
      validation.warnings,
      ["configuration"]
    );

  const hasConfigFiles =
    projectStructure.configuration.length > 0;

  const status:
    HealthFactorStatus =
    hasConfigurationFindings
      ? "failed"
      : hasConfigurationWarnings || !hasConfigFiles
        ? "warning"
        : "passed";

  return createHealthFactor({
    name:
      "configuration",
    label:
      "Configuration",
    status,
    maxScore:
      10,
    summary:
      hasConfigFiles
        ? "Project configuration files detected"
        : "No configuration files detected",
    evidence:
      hasConfigFiles
        ? projectStructure.configuration.slice(
            0,
            10
          )
        : ["No configuration files detected"]
  });
}

function getArchitectureHealthFactor(
  projectStructure: ProjectStructure
): HealthFactor {
  const evidence: string[] = [
    `Frontend detected: ${projectStructure.frontend}`,
    `Backend detected: ${projectStructure.backend}`,
    `Tests detected: ${projectStructure.tests}`,
    `Package files: ${projectStructure.packageFiles.length}`,
    `Infrastructure files: ${projectStructure.infrastructure.length}`
  ];

  const hasApplicationShape =
    projectStructure.frontend ||
    projectStructure.backend;

  const status:
    HealthFactorStatus =
    hasApplicationShape &&
    projectStructure.tests &&
    projectStructure.packageFiles.length > 0
      ? "passed"
      : hasApplicationShape ||
          projectStructure.packageFiles.length > 0
        ? "warning"
        : "skipped";

  return createHealthFactor({
    name:
      "architecture",
    label:
      "Architecture",
    status,
    maxScore:
      5,
    summary:
      status === "passed"
        ? "Project structure has application, package, and test signals"
        : status === "warning"
          ? "Project structure has partial architecture signals"
          : "No architecture signals detected",
    evidence
  });
}

export function calculateProjectHealthScore(
  input: {
    projectStructure: ProjectStructure;
    dependencyAnalysis: DependencyAnalysis;
    validation: HealthValidationReport;
  }
): ProjectHealthScore {
  // Unlike build/test/lint (always scored, even at half credit when no
  // script exists), runtime is only scored when a start/dev script was
  // actually found - discoverValidationPlan always registers a runtime
  // command (skipped when inapplicable), so most existing projects would
  // otherwise silently pick up an extra, always-skipped factor and see
  // their maxScore/score shift even though nothing about them changed.
  const runtimeResult =
    getValidationResult(
      input.validation,
      "runtime"
    );

  const isRuntimeApplicable =
    Boolean(
      runtimeResult &&
      runtimeResult.status !== "skipped"
    );

  const factors: HealthFactor[] = [
    createValidationHealthFactor(
      input.validation,
      "build",
      "build",
      "Build",
      15
    ),
    createValidationHealthFactor(
      input.validation,
      "test",
      "tests",
      "Tests",
      15
    ),
    createValidationHealthFactor(
      input.validation,
      "type-check",
      "type-safety",
      "Type Safety",
      10
    ),
    createValidationHealthFactor(
      input.validation,
      "lint",
      "lint",
      "Lint",
      10
    ),
    getDependencyHealthFactor(
      input.dependencyAnalysis,
      input.validation
    ),
    getSecurityHealthFactor(
      input.validation
    ),
    getConfigurationHealthFactor(
      input.projectStructure,
      input.validation
    ),
    getArchitectureHealthFactor(
      input.projectStructure
    ),
    ...(isRuntimeApplicable
      ? [
          createValidationHealthFactor(
            input.validation,
            "runtime",
            "runtime",
            "Runtime",
            10
          )
        ]
      : [])
  ];

  const maxScore =
    factors.reduce(
      (total, factor) =>
        total + factor.maxScore,
      0
    );

  const score =
    clampScore(
      factors.reduce(
        (total, factor) =>
          total + factor.score,
        0
      ),
      maxScore
    );

  const failedFactors =
    factors.filter(
      factor =>
        factor.status === "failed"
    ).length;

  const warningFactors =
    factors.filter(
      factor =>
        factor.status === "warning"
    ).length;

  return {
    score,
    maxScore,
    grade:
      getHealthGrade(
        maxScore > 0
          ? (score / maxScore) * 100
          : 100
      ),
    summary:
      failedFactors > 0
        ? `${failedFactors} failed factor(s), ${warningFactors} warning factor(s)`
        : warningFactors > 0
          ? `${warningFactors} warning factor(s)`
          : "All health factors passed",
    factors
  };
}

/**
 * Remove duplicate technology detections.
 *
 * Example:
 *
 * React detected by:
 * - package.json
 * - source code
 *
 * Instead of returning two React entries,
 * CodeSentinel creates one entry and merges
 * the evidence.
 */
export function deduplicateDetections(
  detections: DetectionResult[]
): DetectionResult[] {
  const map =
    new Map<string, DetectionResult>();

  for (const detection of detections) {
    const key =
      `${detection.category}:${detection.technology}`
        .toLowerCase();

    const existing =
      map.get(key);

    if (!existing) {
      map.set(key, {
        ...detection,
        evidence: [
          ...detection.evidence
        ]
      });

      continue;
    }

    existing.confidence =
      Math.max(
        existing.confidence,
        detection.confidence
      );

    existing.evidence = [
      ...new Set([
        ...existing.evidence,
        ...detection.evidence
      ])
    ];
  }

  return Array.from(
    map.values()
  );
}

/**
 * Convert raw detections into a structured
 * technology profile.
 */
export function createTechnologyProfile(
  detections: DetectionResult[]
): TechnologyProfile {
  const profile: TechnologyProfile = {
    languages: [],
    runtimes: [],
    frameworks: [],
    databases: [],
    buildTools: [],
    packageManagers: [],
    infrastructure: [],
    unknown: []
  };

  for (const detection of detections) {
    const item: TechnologyProfileItem = {
      name: detection.technology,
      confidence: detection.confidence,
      evidence: [
        ...detection.evidence
      ]
    };

    switch (detection.category) {
      case "language":
        profile.languages.push(item);
        break;

      case "runtime":
        profile.runtimes.push(item);
        break;

      case "framework":
        profile.frameworks.push(item);
        break;

      case "database":
        profile.databases.push(item);
        break;

      case "build-tool":
        profile.buildTools.push(item);
        break;

      case "package-manager":
        profile.packageManagers.push(item);
        break;

      case "infrastructure":
        profile.infrastructure.push(item);
        break;

      default:
        profile.unknown.push(item);
        break;
    }
  }

  return profile;
}

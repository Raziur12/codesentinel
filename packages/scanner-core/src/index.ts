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
  | "architecture";

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
  | "configuration";

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

export interface ScanResult {
  projectPath: string;
  filesScanned: number;

  projectStructure: ProjectStructure;

  technologies: DetectionResult[];

  technologyProfile: TechnologyProfile;

  dependencyAnalysis?: DependencyAnalysis;

  health?: ProjectHealthScore;

  validation?: ValidationSummary;

  startedAt: string;
  completedAt: string;
}

function clampScore(
  value: number
): number {
  return Math.max(
    0,
    Math.min(
      100,
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
    )
  ];

  const score =
    clampScore(
      factors.reduce(
        (total, factor) =>
          total + factor.score,
        0
      )
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
    maxScore:
      100,
    grade:
      getHealthGrade(
        score
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

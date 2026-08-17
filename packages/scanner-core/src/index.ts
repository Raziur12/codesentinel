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


export interface ValidationSummary {
  passed: boolean;
  total: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
}

export type FindingSeverity =
  | "error"
  | "warning"
  | "info";

export type FindingCategory =
  | "build"
  | "test"
  | "lint"
  | "type-check"
  | "dependency"
  | "configuration"
  | "technology"
  | "security";

export interface ScannerFinding {
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  message: string;
  command?: string;
  evidence?: string;
}

export interface ScanResult {
  projectPath: string;
  filesScanned: number;

  projectStructure: ProjectStructure;

  technologies: DetectionResult[];

  technologyProfile: TechnologyProfile;

  validation?: ValidationSummary;

  startedAt: string;
  completedAt: string;
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

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

export interface ScannerPlugin {
  id: string;
  name: string;

  detect(
    context: ScanContext
  ): Promise<DetectionResult[]>;
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

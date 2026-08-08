import type {
  DetectionResult,
  TechnologyProfile,
  TechnologyProfileItem
} from "./index.js";

function mergeEvidence(
  existing: string[],
  incoming: string[]
): string[] {
  return [
    ...new Set([
      ...existing,
      ...incoming
    ])
  ];
}

function mergeConfidence(
  existing: number,
  incoming: number
): number {
  return Math.max(existing, incoming);
}

export function deduplicateDetections(
  detections: DetectionResult[]
): DetectionResult[] {
  const map = new Map<string, DetectionResult>();

  for (const detection of detections) {
    const key =
      `${detection.category}:${detection.technology.toLowerCase()}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...detection,
        evidence: [...detection.evidence]
      });

      continue;
    }

    existing.confidence =
      mergeConfidence(
        existing.confidence,
        detection.confidence
      );

    existing.evidence =
      mergeEvidence(
        existing.evidence,
        detection.evidence
      );
  }

  return [...map.values()];
}

function addToCategory(
  profile: TechnologyProfile,
  detection: DetectionResult
): void {
  const item: TechnologyProfileItem = {
    name: detection.technology,
    confidence: detection.confidence,
    evidence: detection.evidence
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
    addToCategory(profile, detection);
  }

  return profile;
}
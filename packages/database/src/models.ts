export type ScanStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "error";

export interface ScanRecord {
  id: string;
  status: ScanStatus;
  projectId?: string;
  teamId?: string;
  projectPath: string;
  createdAt: string;
  updatedAt: string;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  report?: unknown;
  error?: string;
}

export interface ProjectRecord {
  id: string;
  path: string;
  teamId?: string;
  name?: string;
  lastScanId?: string;
  lastStatus?: ScanStatus;
  lastHealthScore?: number;
  /**
   * Ties this project to sibling projects that were scanned together as
   * one linked group (e.g. a frontend and backend repo that depend on
   * each other). Projects in the same group share a groupId; groupLabel
   * is the human-readable name for the group, duplicated onto every
   * member so no separate group collection/lookup is needed.
   */
  groupId?: string;
  groupLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FindingRecord {
  id: string;
  scanId: string;
  projectId?: string;
  teamId?: string;
  type?: "finding" | "warning";
  severity: string;
  category: string;
  code?: string;
  title: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  createdAt: string;
}

export interface ValidationRunRecord {
  id: string;
  scanId: string;
  status: string;
  category: string;
  command: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TechnologyProfileRecord {
  id: string;
  scanId: string;
  profile: unknown;
  createdAt: string;
}

export interface AiAnalysisRecord {
  id: string;
  scanId: string;
  projectId?: string;
  teamId?: string;
  analysis: unknown;
  createdAt: string;
}

export interface FixRecord {
  id: string;
  scanId: string;
  projectId?: string;
  teamId?: string;
  suggestion: unknown;
  createdAt: string;
}

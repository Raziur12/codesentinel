export type ScanStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "error";

export interface ScanRecord {
  id: string;
  status: ScanStatus;
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
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FindingRecord {
  id: string;
  scanId: string;
  severity: string;
  category: string;
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
  analysis: unknown;
  createdAt: string;
}

export interface FixRecord {
  id: string;
  scanId: string;
  suggestion: unknown;
  createdAt: string;
}

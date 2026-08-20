import type {
  Collection,
  Db
} from "mongodb";

import type {
  AiAnalysisRecord,
  FindingRecord,
  FixRecord
} from "../models.js";

export interface ScanArtifactSet {
  findings: FindingRecord[];
  aiAnalyses: AiAnalysisRecord[];
  fixes: FixRecord[];
}

export interface ScanArtifactRepository {
  replaceForScan(
    scanId: string,
    artifacts: ScanArtifactSet
  ): Promise<void>;
}

export class MongoScanArtifactRepository implements ScanArtifactRepository {
  private readonly findings:
    Collection<FindingRecord>;

  private readonly aiAnalyses:
    Collection<AiAnalysisRecord>;

  private readonly fixes:
    Collection<FixRecord>;

  constructor(
    database: Db
  ) {
    this.findings =
      database.collection<FindingRecord>(
        "findings"
      );

    this.aiAnalyses =
      database.collection<AiAnalysisRecord>(
        "ai_analyses"
      );

    this.fixes =
      database.collection<FixRecord>(
        "fix_suggestions"
      );
  }

  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.findings.createIndex(
        {
          id:
            1
        },
        {
          unique:
            true
        }
      ),
      this.findings.createIndex({
        scanId:
          1
      }),
      this.findings.createIndex({
        projectId:
          1,
        severity:
          1
      }),
      this.aiAnalyses.createIndex(
        {
          id:
            1
        },
        {
          unique:
            true
        }
      ),
      this.aiAnalyses.createIndex({
        scanId:
          1
      }),
      this.fixes.createIndex(
        {
          id:
            1
        },
        {
          unique:
            true
        }
      ),
      this.fixes.createIndex({
        scanId:
          1
      })
    ]);
  }

  async replaceForScan(
    scanId: string,
    artifacts: ScanArtifactSet
  ): Promise<void> {
    await this.ensureIndexes();

    await Promise.all([
      this.findings.deleteMany({
        scanId
      }),
      this.aiAnalyses.deleteMany({
        scanId
      }),
      this.fixes.deleteMany({
        scanId
      })
    ]);

    await Promise.all([
      artifacts.findings.length > 0
        ? this.findings.insertMany(
            artifacts.findings
          )
        : Promise.resolve(),
      artifacts.aiAnalyses.length > 0
        ? this.aiAnalyses.insertMany(
            artifacts.aiAnalyses
          )
        : Promise.resolve(),
      artifacts.fixes.length > 0
        ? this.fixes.insertMany(
            artifacts.fixes
          )
        : Promise.resolve()
    ]);
  }
}

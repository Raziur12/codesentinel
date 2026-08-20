import type {
  Collection,
  Db
} from "mongodb";

import type {
  ScanRecord
} from "../models.js";

export interface ScanRepository {
  save(
    record: ScanRecord
  ): Promise<void>;

  read(
    scanId: string
  ): Promise<ScanRecord | undefined>;

  list(
    limit?: number
  ): Promise<ScanRecord[]>;

  listByProject(
    projectId: string,
    limit?: number
  ): Promise<ScanRecord[]>;
}

export class MongoScanRepository implements ScanRepository {
  private readonly collection:
    Collection<ScanRecord>;

  constructor(
    database: Db
  ) {
    this.collection =
      database.collection<ScanRecord>(
        "scans"
      );
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex(
      {
        id:
          1
      },
      {
        unique:
          true
      }
    );

    await this.collection.createIndex({
      createdAt:
        -1
    });

    await this.collection.createIndex({
      projectId:
        1,
      createdAt:
        -1
    });
  }

  async save(
    record: ScanRecord
  ): Promise<void> {
    await this.ensureIndexes();

    await this.collection.updateOne(
      {
        id:
          record.id
      },
      {
        $set:
          record
      },
      {
        upsert:
          true
      }
    );
  }

  async read(
    scanId: string
  ): Promise<ScanRecord | undefined> {
    await this.ensureIndexes();

    const record =
      await this.collection.findOne(
        {
          id:
            scanId
        },
        {
          projection:
            {
              _id:
                0
            }
        }
      );

    return record ?? undefined;
  }

  async list(
    limit = 50
  ): Promise<ScanRecord[]> {
    await this.ensureIndexes();

    return this.collection
      .find(
        {},
        {
          projection:
            {
              _id:
                0,
              stdout:
                0,
              stderr:
                0
            }
        }
      )
      .sort({
        createdAt:
          -1
      })
      .limit(
        limit
      )
      .toArray();
  }

  async listByProject(
    projectId: string,
    limit = 50
  ): Promise<ScanRecord[]> {
    await this.ensureIndexes();

    return this.collection
      .find(
        {
          projectId
        },
        {
          projection:
            {
              _id:
                0,
              stdout:
                0,
              stderr:
                0
            }
        }
      )
      .sort({
        createdAt:
          -1
      })
      .limit(
        limit
      )
      .toArray();
  }
}

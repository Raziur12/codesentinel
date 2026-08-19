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
}

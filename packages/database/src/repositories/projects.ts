import type {
  Collection,
  Db
} from "mongodb";

import type {
  ProjectRecord
} from "../models.js";

export interface ProjectRepository {
  save(
    record: ProjectRecord
  ): Promise<void>;

  read(
    projectId: string
  ): Promise<ProjectRecord | undefined>;

  list(
    limit?: number
  ): Promise<ProjectRecord[]>;
}

export class MongoProjectRepository implements ProjectRepository {
  private readonly collection:
    Collection<ProjectRecord>;

  constructor(
    database: Db
  ) {
    this.collection =
      database.collection<ProjectRecord>(
        "projects"
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
      teamId:
        1,
      updatedAt:
        -1
    });

    await this.collection.createIndex({
      path:
        1
    });
  }

  async save(
    record: ProjectRecord
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
    projectId: string
  ): Promise<ProjectRecord | undefined> {
    await this.ensureIndexes();

    const record =
      await this.collection.findOne(
        {
          id:
            projectId
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
  ): Promise<ProjectRecord[]> {
    await this.ensureIndexes();

    return this.collection
      .find(
        {},
        {
          projection:
            {
              _id:
                0
            }
        }
      )
      .sort({
        updatedAt:
          -1
      })
      .limit(
        limit
      )
      .toArray();
  }
}

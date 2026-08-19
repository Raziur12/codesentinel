import {
  Db,
  MongoClient
} from "mongodb";

export interface MongoDatabaseConfig {
  uri: string;
  databaseName: string;
}

let client:
  MongoClient |
  undefined;

export function readMongoDatabaseConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): MongoDatabaseConfig | undefined {
  const uri =
    env.MONGODB_URI;

  if (
    !uri
  ) {
    return undefined;
  }

  return {
    uri,
    databaseName:
      env.MONGODB_DB ?? "codesentinel"
  };
}

export async function getMongoClient(
  config: MongoDatabaseConfig
): Promise<MongoClient> {
  if (
    !client
  ) {
    client =
      new MongoClient(
        config.uri
      );

    await client.connect();
  }

  return client;
}

export async function getMongoDatabase(
  config: MongoDatabaseConfig
): Promise<Db> {
  const mongoClient =
    await getMongoClient(
      config
    );

  return mongoClient.db(
    config.databaseName
  );
}

export async function closeMongoClient(): Promise<void> {
  if (
    !client
  ) {
    return;
  }

  await client.close();

  client =
    undefined;
}

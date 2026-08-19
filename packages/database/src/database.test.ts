import assert from "node:assert/strict";
import test from "node:test";

import {
  readMongoDatabaseConfigFromEnv
} from "./index.js";

test(
  "returns undefined when MongoDB URI is not configured",
  () => {
    const config =
      readMongoDatabaseConfigFromEnv({});

    assert.equal(
      config,
      undefined
    );
  }
);

test(
  "reads MongoDB Atlas connection config from environment",
  () => {
    const config =
      readMongoDatabaseConfigFromEnv({
        MONGODB_URI:
          "mongodb+srv://user:pass@example.mongodb.net/?retryWrites=true&w=majority",
        MONGODB_DB:
          "codesentinel_test"
      });

    assert.equal(
      config?.uri,
      "mongodb+srv://user:pass@example.mongodb.net/?retryWrites=true&w=majority"
    );

    assert.equal(
      config?.databaseName,
      "codesentinel_test"
    );
  }
);

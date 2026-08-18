import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateValidationRules
} from "./index.js";

test(
  "applies the TS2322 type mismatch rule",
  () => {
    const result =
      evaluateValidationRules({
        category:
          "type-check",
        code:
          "TS2322",
        message:
          "Type 'number' is not assignable to type 'string'."
      });

    assert.equal(
      result?.ruleId,
      "typescript/TS2322"
    );

    assert.match(
      result?.suggestion ?? "",
      /assigned value matches/
    );
  }
);

test(
  "applies the TS2339 property missing rule",
  () => {
    const result =
      evaluateValidationRules({
        category:
          "build",
        code:
          "TS2339",
        message:
          "Property 'name' does not exist on type '{}'."
      });

    assert.equal(
      result?.ruleId,
      "typescript/TS2339"
    );

    assert.match(
      result?.suggestion ?? "",
      /property or method exists/
    );
  }
);

test(
  "applies the EBADENGINE Node version rule",
  () => {
    const result =
      evaluateValidationRules({
        category:
          "engine",
        code:
          "EBADENGINE",
        message:
          "Unsupported engine",
        metadata:
          {
            requiredNode:
              "^20.19.0 || >=22.12.0"
          }
      });

    assert.equal(
      result?.ruleId,
      "npm/EBADENGINE"
    );

    assert.match(
      result?.suggestion ?? "",
      /\^20\.19\.0/
    );
  }
);

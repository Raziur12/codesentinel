import assert from "node:assert/strict";
import test from "node:test";

import {
  createSecurityReport
} from "./index.js";

test(
  "creates a failed security report for high-risk security and secret findings",
  () => {
    const report =
      createSecurityReport({
        generatedAt:
          "2026-08-20T00:00:00.000Z",
        validation:
          {
            results:
              [
                {
                  category:
                    "security",
                  status:
                    "failed"
                },
                {
                  category:
                    "secret",
                  status:
                    "failed"
                }
              ],
            findings:
              [
                {
                  id:
                    "cs_security",
                  key:
                    "security-key",
                  severity:
                    "high",
                  category:
                    "security",
                  code:
                    "NPM_AUDIT_VULNERABILITY",
                  title:
                    "Dependency vulnerability",
                  message:
                    "lodash has a high vulnerability.",
                  source:
                    "validation-engine",
                  confidence:
                    0.95
                },
                {
                  id:
                    "cs_secret",
                  key:
                    "secret-key",
                  severity:
                    "critical",
                  category:
                    "secret",
                  code:
                    "SECRET_AWS_ACCESS_KEY_ID",
                  title:
                    "AWS access key detected",
                  message:
                    "Rotate the exposed secret.",
                  source:
                    "validation-engine",
                  confidence:
                    0.99
                }
              ],
            warnings:
              []
          },
        dependencyAnalysis:
          {
            packageManager:
              "npm",
            directDependencies:
              [],
            devDependencies:
              [],
            peerDependencies:
              [],
            optionalDependencies:
              [],
            dependencyTree:
              [],
            outdatedDependencies:
              [],
            engineRequirements:
              [],
            dependencyConflicts:
              [],
            peerDependencyConflicts:
              [
                {
                  code:
                    "PEER_CONFLICT",
                  title:
                    "Peer conflict",
                  message:
                    "React peer mismatch.",
                  severity:
                    "medium"
                }
              ]
          }
      });

    assert.equal(
      report.status,
      "failed"
    );

    assert.equal(
      report.summary.securityFindings,
      1
    );

    assert.equal(
      report.summary.secretFindings,
      1
    );

    assert.equal(
      report.summary.critical,
      1
    );

    assert.equal(
      report.summary.dependencyRiskSignals,
      1
    );
  }
);

test(
  "creates a passed security report when no security findings exist",
  () => {
    const report =
      createSecurityReport({
        generatedAt:
          "2026-08-20T00:00:00.000Z",
        validation:
          {
            results:
              [
                {
                  category:
                    "security",
                  status:
                    "passed"
                },
                {
                  category:
                    "secret",
                  status:
                    "passed"
                }
              ],
            findings:
              [],
            warnings:
              []
          }
      });

    assert.equal(
      report.status,
      "passed"
    );

    assert.equal(
      report.summary.totalFindings,
      0
    );

    assert.match(
      report.recommendations[0] ?? "",
      /No active security/
    );
  }
);

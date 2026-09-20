import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  discoverValidationPlan
} from "./index.js";

async function createTemporaryProject(): Promise<string> {
  return fs.mkdtemp(
    path.join(
      os.tmpdir(),
      "codesentinel-runtime-"
    )
  );
}

function findRuntimeCommand(
  plan: Awaited<ReturnType<typeof discoverValidationPlan>>
) {
  const runtimeCommand =
    plan.commands.find(
      command => command.category === "runtime"
    );

  assert.ok(
    runtimeCommand,
    "expected a runtime validation command to be registered"
  );

  return runtimeCommand;
}

test(
  "marks runtime unavailable when no start or dev script exists",
  async () => {
    const projectPath =
      await createTemporaryProject();

    try {
      await fs.writeFile(
        path.join(
          projectPath,
          "package.json"
        ),
        JSON.stringify({
          name: "no-start-script",
          scripts: {
            build: "echo build"
          }
        }),
        "utf8"
      );

      const plan =
        await discoverValidationPlan(
          projectPath
        );

      const runtimeCommand =
        findRuntimeCommand(plan);

      assert.equal(
        runtimeCommand.available,
        false
      );
      assert.equal(
        runtimeCommand.skipReason,
        "No start or dev script found"
      );
    } finally {
      await fs.rm(
        projectPath,
        { recursive: true, force: true }
      );
    }
  }
);

test(
  "detects a plain start script and defaults to port 3000",
  async () => {
    const projectPath =
      await createTemporaryProject();

    try {
      await fs.writeFile(
        path.join(
          projectPath,
          "package.json"
        ),
        JSON.stringify({
          name: "has-start-script",
          scripts: {
            start: "node server.js"
          }
        }),
        "utf8"
      );

      const plan =
        await discoverValidationPlan(
          projectPath
        );

      const runtimeCommand =
        findRuntimeCommand(plan);

      assert.equal(
        runtimeCommand.available,
        true
      );
      assert.equal(
        runtimeCommand.metadata?.port,
        3000
      );
    } finally {
      await fs.rm(
        projectPath,
        { recursive: true, force: true }
      );
    }
  }
);

test(
  "prefers start over dev, and infers vite preview's default port",
  async () => {
    const projectPath =
      await createTemporaryProject();

    try {
      await fs.writeFile(
        path.join(
          projectPath,
          "package.json"
        ),
        JSON.stringify({
          name: "vite-preview-project",
          scripts: {
            start: "vite preview",
            dev: "vite"
          }
        }),
        "utf8"
      );

      const plan =
        await discoverValidationPlan(
          projectPath
        );

      const runtimeCommand =
        findRuntimeCommand(plan);

      assert.equal(
        runtimeCommand.available,
        true
      );
      assert.equal(
        runtimeCommand.metadata?.port,
        4173
      );
    } finally {
      await fs.rm(
        projectPath,
        { recursive: true, force: true }
      );
    }
  }
);

test(
  "falls back to the dev script's vite dev-server port when there is no start script",
  async () => {
    const projectPath =
      await createTemporaryProject();

    try {
      await fs.writeFile(
        path.join(
          projectPath,
          "package.json"
        ),
        JSON.stringify({
          name: "vite-dev-project",
          scripts: {
            dev: "vite"
          }
        }),
        "utf8"
      );

      const plan =
        await discoverValidationPlan(
          projectPath
        );

      const runtimeCommand =
        findRuntimeCommand(plan);

      assert.equal(
        runtimeCommand.available,
        true
      );
      assert.equal(
        runtimeCommand.metadata?.port,
        5173
      );
    } finally {
      await fs.rm(
        projectPath,
        { recursive: true, force: true }
      );
    }
  }
);

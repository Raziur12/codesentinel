import fs from "node:fs/promises";
import path from "node:path";

import {
  deduplicateDetections,
  createTechnologyProfile
} from "@codesentinel/scanner-core";

import type {
  ScanContext,
  ScanResult,
  ScannerPlugin
} from "@codesentinel/scanner-core";

import {
  universalTechnologyPlugin
} from "@codesentinel/technology-detectors";

import {
  resolveProjectPath
} from "./path-resolver.js";

async function getFiles(
  directory: string,
  root = directory
): Promise<string[]> {
  const entries = await fs.readdir(directory, {
    withFileTypes: true
  });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      if (
        [
          "node_modules",
          ".git",
          "dist",
          "build",
          ".next",
          ".codesentinel"
        ].includes(entry.name)
      ) {
        continue;
      }

      files.push(
        ...(await getFiles(
          fullPath,
          root
        ))
      );
    } else {
      files.push(
        path.relative(
          root,
          fullPath
        )
      );
    }
  }

  return files;
}

async function scanProject(
  projectPath: string,
  plugins: ScannerPlugin[]
): Promise<ScanResult> {
  const startedAt =
    new Date().toISOString();

  const files =
    await getFiles(projectPath);

  const context: ScanContext = {
    projectPath,
    files
  };

  /*
   * Run every detector exactly once.
   */
  const rawTechnologies = [];

  for (const plugin of plugins) {
    const results =
      await plugin.detect(context);

    rawTechnologies.push(
      ...results
    );
  }

  /*
   * Remove duplicate technologies
   * and merge their evidence.
   */
  const technologies =
    deduplicateDetections(
      rawTechnologies
    );

  /*
   * Create structured technology profile.
   */
  const technologyProfile =
    createTechnologyProfile(
      technologies
    );

  /*
   * Save CodeSentinel artifact.
   */
  const outputDirectory =
    path.join(
      projectPath,
      ".codesentinel"
    );

  await fs.mkdir(
    outputDirectory,
    {
      recursive: true
    }
  );

  await fs.writeFile(
    path.join(
      outputDirectory,
      "technology-profile.json"
    ),
    JSON.stringify(
      technologyProfile,
      null,
      2
    ),
    "utf8"
  );

  const completedAt =
    new Date().toISOString();

  return {
    projectPath,
    filesScanned: files.length,
    technologies,
    technologyProfile,
    startedAt,
    completedAt
  };
}

async function main(): Promise<void> {
  const inputPath =
    process.argv[2] ?? ".";

  /*
   * IMPORTANT:
   * Resolve the path from the repository root,
   * not from apps/scanner.
   */
  const projectPath =
    await resolveProjectPath(
      inputPath
    );

  console.log(
    "🔎 CodeSentinel Scanner"
  );

  console.log(
    "======================"
  );

  console.log(
    `Input: ${inputPath}`
  );

  console.log(
    `Resolved Project: ${projectPath}`
  );

  console.log("");

  const result =
    await scanProject(
      projectPath,
      [
        universalTechnologyPlugin
      ]
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    "Scanner failed:"
  );

  console.error(error);

  process.exit(1);
});
import { spawn } from "node:child_process";
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import {
  detectPackageManager
} from "@codesentinel/scanner-core";

import type {
  PackageManagerName
} from "@codesentinel/scanner-core";

/**
 * Validation status.
 */
export type ValidationStatus =
  | "passed"
  | "warning"
  | "failed"
  | "skipped";

/**
 * Validation severity.
 */
export type ValidationSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

/**
 * Validation category.
 */
export type ValidationCategory =
  | "build"
  | "test"
  | "lint"
  | "type-check"
  | "dependency"
  | "configuration";

/**
 * Validation command definition.
 */
export interface ValidationCommand {
  name: string;

  command: string;

  args: string[];

  executable: string;

  available: boolean;

  category: ValidationCategory;

  priority: number;

  skipReason?: string;

  metadata?: Record<string, unknown>;
}

/**
 * Structured validation finding.
 */
export interface ValidationFinding {
  type: "validation";

  severity: ValidationSeverity;

  category: ValidationCategory;

  title: string;

  message: string;

  command: string;

  exitCode: number | null;

  evidence?: string;

  file?: string;

  line?: number;

  column?: number;

  code?: string;

  suggestion?: string;
}

/**
 * Result of one validation command.
 *
 * A command can produce multiple findings.
 */
export interface ValidationResult {
  name: string;

  command: string;

  status: ValidationStatus;

  category: ValidationCategory;

  exitCode: number | null;

  stdout: string;

  stderr: string;

  durationMs: number;

  findings?: ValidationFinding[];

  warnings?: ValidationFinding[];

  skipReason?: string;
}

interface PackageJson {
  name?: string;

  scripts?: Record<string, string>;

  dependencies?: Record<string, string>;

  devDependencies?: Record<string, string>;

  packageManager?: string;

  workspaces?: string[] | {
    packages?: string[];
  };
}

interface PackageManagerCommands {
  install: string[];

  run: (scriptName: string) => string[];

  exec: (binaryName: string, args: string[]) => {
    command: string;
    args: string[];
  };
}

interface TypeScriptProjectInfo {
  configFiles: string[];

  selectedConfig?: string;

  hasTypeScriptDependency: boolean;

  hasTypeScriptFiles: boolean;

  shouldTypeCheck: boolean;

  skipReason?: string;
}

type BuildSystemName =
  | "vite"
  | "next"
  | "angular"
  | "generic-node"
  | "unknown";

interface BuildSystemInfo {
  name: BuildSystemName;

  confidence: number;

  evidence: string[];

  hasBuildScript: boolean;

  skipReason?: string;
}

type TestFrameworkName =
  | "jest"
  | "vitest"
  | "mocha"
  | "cypress"
  | "playwright"
  | "jasmine"
  | "generic-node"
  | "unknown";

interface TestFrameworkInfo {
  name: TestFrameworkName;

  confidence: number;

  evidence: string[];

  hasTestScript: boolean;

  skipReason?: string;
}

export interface ValidationWorkspace {
  name?: string;

  path: string;

  relativePath: string;

  scripts: string[];
}

export interface ValidationPlan {
  packageManager: string;

  commands: ValidationCommand[];

  workspacePatterns: string[];

  workspaces: ValidationWorkspace[];
}

/**
 * Complete validation report.
 */
export interface ValidationReport {
  projectPath: string;

  packageManager: string;

  results: ValidationResult[];

  findings: ValidationFinding[];

  warnings: ValidationFinding[];

  passed: boolean;

  startedAt: string;

  completedAt: string;
}

/**
 * Parsed TypeScript compiler error.
 *
 * Example:
 *
 * app.ts(1,7): error TS2322:
 * Type 'number' is not assignable to type 'string'.
 */
interface ParsedTypeScriptError {
  file: string;

  line: number;

  column: number;

  code: string;

  message: string;
}

/**
 * Parsed warning coming from the
 * package manager / runtime / engine.
 *
 * Example:
 *
 * npm warn EBADENGINE Unsupported engine {
 *   package: 'vite@7.3.6',
 *   required: { node: '^20.19.0 || >=22.12.0' },
 *   current: { node: 'v18.20.8', npm: '10.8.2' }
 * }
 */
interface ParsedEngineWarning {
  packageName?: string;

  packageVersion?: string;

  requiredNode?: string;

  currentNode?: string;

  currentNpm?: string;

  message: string;
}

/**
 * Create an actionable suggestion
 * for a parsed engine warning.
 */
function createEngineWarningSuggestion(
  warning: ParsedEngineWarning
): string {
  if (
    warning.requiredNode
  ) {
    return (
      `Upgrade Node.js to a supported version: ${warning.requiredNode}.`
    );
  }

  return (
    "Check the package engine requirements and use a compatible Node.js version."
  );
}

/**
 * Convert command + arguments into
 * a human-readable command string.
 *
 * Example:
 *
 * npm + ["run", "build"]
 *
 * becomes:
 *
 * npm run build
 */
function getCommandText(
  validationCommand: ValidationCommand
): string {
  return [
    validationCommand.command,
    ...validationCommand.args
  ].join(" ");
}

async function fileExists(
  filePath: string
): Promise<boolean> {
  try {
    const stats =
      await fs.stat(filePath);

    return stats.isFile();
  } catch {
    return false;
  }
}

async function readPackageJson(
  projectPath: string
): Promise<PackageJson | null> {
  const packageJsonPath =
    path.join(
      projectPath,
      "package.json"
    );

  if (
    !(await fileExists(packageJsonPath))
  ) {
    return null;
  }

  try {
    const content =
      await fs.readFile(
        packageJsonPath,
        "utf8"
      );

    return JSON.parse(
      content
    ) as PackageJson;
  } catch {
    return null;
  }
}

function getWorkspacePatterns(
  packageJson: PackageJson | null
): string[] {
  if (
    !packageJson?.workspaces
  ) {
    return [];
  }

  if (
    Array.isArray(
      packageJson.workspaces
    )
  ) {
    return packageJson.workspaces;
  }

  return packageJson.workspaces.packages ?? [];
}

async function getRootFiles(
  projectPath: string
): Promise<string[]> {
  const entries =
    await fs.readdir(
      projectPath,
      {
        withFileTypes: true
      }
    );

  return entries
    .filter(
      entry =>
        entry.isFile()
    )
    .map(
      entry =>
        entry.name
    );
}

async function getProjectFiles(
  directory: string,
  root = directory
): Promise<string[]> {
  const entries =
    await fs.readdir(
      directory,
      {
        withFileTypes: true
      }
    );

  const files: string[] = [];

  for (
    const entry
    of entries
  ) {
    const fullPath =
      path.join(
        directory,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {
      if (
        [
          "node_modules",
          ".git",
          "dist",
          "build",
          ".next",
          ".codesentinel",
          "coverage"
        ].includes(entry.name)
      ) {
        continue;
      }

      files.push(
        ...(await getProjectFiles(
          fullPath,
          root
        ))
      );

      continue;
    }

    files.push(
      path
        .relative(
          root,
          fullPath
        )
        .replace(/\\/g, "/")
    );
  }

  return files;
}

function getPackageManagerCommands(
  packageManager: PackageManagerName
): PackageManagerCommands {
  switch (
    packageManager
  ) {
    case "yarn":
      return {
        install:
          ["install"],

        run:
          scriptName =>
            ["run", scriptName],

        exec:
          (binaryName, args) => ({
            command:
              "yarn",

            args: [
              "exec",
              binaryName,
              ...args
            ]
          })
      };

    case "pnpm":
      return {
        install:
          ["install"],

        run:
          scriptName =>
            ["run", scriptName],

        exec:
          (binaryName, args) => ({
            command:
              "pnpm",

            args: [
              "exec",
              binaryName,
              ...args
            ]
          })
      };

    case "bun":
      return {
        install:
          ["install"],

        run:
          scriptName =>
            ["run", scriptName],

        exec:
          (binaryName, args) => ({
            command:
              "bunx",

            args: [
              binaryName,
              ...args
            ]
          })
      };

    case "npm":
    default:
      return {
        install:
          ["install"],

        run:
          scriptName =>
            ["run", scriptName],

        exec:
          (binaryName, args) => ({
            command:
              "npx",

            args: [
              binaryName,
              ...args
            ]
          })
      };
  }
}

function createCommand(
  name: string,
  category: ValidationCategory,
  priority: number,
  command: string,
  args: string[],
  available = true,
  skipReason?: string,
  metadata?: Record<string, unknown>
): ValidationCommand {
  return {
    name,
    command,
    args,
    executable:
      command,
    available,
    category,
    priority,
    skipReason,
    metadata
  };
}

async function discoverWorkspaces(
  projectPath: string,
  workspacePatterns: string[]
): Promise<ValidationWorkspace[]> {
  const workspaces:
    ValidationWorkspace[] = [];

  for (
    const workspacePattern
    of workspacePatterns
  ) {
    const normalizedPattern =
      workspacePattern.replace(/\\/g, "/");

    if (
      !normalizedPattern.endsWith("/*")
    ) {
      continue;
    }

    const parentDirectory =
      path.join(
        projectPath,
        normalizedPattern.slice(0, -2)
      );

    let entries:
      | Dirent[];

    try {
      entries =
        await fs.readdir(
          parentDirectory,
          {
            withFileTypes: true
          }
        );
    } catch {
      continue;
    }

    for (
      const entry
      of entries
    ) {
      if (
        !entry.isDirectory()
      ) {
        continue;
      }

      const workspacePath =
        path.join(
          parentDirectory,
          entry.name
        );

      const workspacePackageJson =
        await readPackageJson(
          workspacePath
        );

      if (
        !workspacePackageJson
      ) {
        continue;
      }

      workspaces.push({
        name:
          workspacePackageJson.name,

        path:
          workspacePath,

        relativePath:
          path.relative(
            projectPath,
            workspacePath
          ),

        scripts:
          Object.keys(
            workspacePackageJson.scripts ?? {}
          ).sort()
      });
    }
  }

  return workspaces.sort(
    (left, right) =>
      left.relativePath.localeCompare(
        right.relativePath
      )
  );
}

function hasWorkspaceScript(
  workspaces: ValidationWorkspace[],
  scriptName: string
): boolean {
  return workspaces.some(
    workspace =>
      workspace.scripts.includes(
        scriptName
      )
  );
}

function getDependencies(
  packageJson: PackageJson | null
): Set<string> {
  return new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {})
  ]);
}

function hasDependency(
  dependencies: Set<string>,
  dependencyName: string
): boolean {
  return dependencies.has(
    dependencyName
  );
}

function hasConfigFile(
  files: string[],
  pattern: RegExp
): boolean {
  return files.some(
    file =>
      pattern.test(file)
  );
}

function detectBuildSystem(
  files: string[],
  packageJson: PackageJson | null
): BuildSystemInfo {
  const scripts =
    packageJson?.scripts;

  const hasBuildScript =
    Boolean(
      scripts?.build
    );

  const dependencies =
    getDependencies(
      packageJson
    );

  const evidence: string[] = [];

  if (
    hasConfigFile(
      files,
      /^vite\.config\.(ts|js|mts|mjs|cts|cjs)$/i
    )
  ) {
    evidence.push(
      "vite config detected"
    );
  }

  if (
    hasDependency(
      dependencies,
      "vite"
    )
  ) {
    evidence.push(
      "vite dependency detected"
    );
  }

  if (
    evidence.length > 0
  ) {
    return {
      name:
        "vite",
      confidence:
        evidence.length > 1 ? 0.99 : 0.9,
      evidence,
      hasBuildScript,
      skipReason:
        hasBuildScript
          ? undefined
          : "Vite project detected but no build script found"
    };
  }

  if (
    hasConfigFile(
      files,
      /^next\.config\.(ts|js|mts|mjs|cts|cjs)$/i
    )
  ) {
    evidence.push(
      "next config detected"
    );
  }

  if (
    hasDependency(
      dependencies,
      "next"
    )
  ) {
    evidence.push(
      "next dependency detected"
    );
  }

  if (
    evidence.length > 0
  ) {
    return {
      name:
        "next",
      confidence:
        evidence.length > 1 ? 0.99 : 0.9,
      evidence,
      hasBuildScript,
      skipReason:
        hasBuildScript
          ? undefined
          : "Next.js project detected but no build script found"
    };
  }

  if (
    hasConfigFile(
      files,
      /^angular\.json$/i
    )
  ) {
    evidence.push(
      "angular.json detected"
    );
  }

  if (
    hasDependency(
      dependencies,
      "@angular/core"
    )
  ) {
    evidence.push(
      "@angular/core dependency detected"
    );
  }

  if (
    evidence.length > 0
  ) {
    return {
      name:
        "angular",
      confidence:
        evidence.length > 1 ? 0.99 : 0.9,
      evidence,
      hasBuildScript,
      skipReason:
        hasBuildScript
          ? undefined
          : "Angular project detected but no build script found"
    };
  }

  if (
    hasBuildScript
  ) {
    return {
      name:
        "generic-node",
      confidence:
        0.75,
      evidence:
        ["package.json build script detected"],
      hasBuildScript
    };
  }

  return {
    name:
      "unknown",
    confidence:
      0,
    evidence:
      [],
    hasBuildScript:
      false,
    skipReason:
      "No build script found"
  };
}

function createTestFrameworkInfo(
  name: Exclude<TestFrameworkName, "generic-node" | "unknown">,
  label: string,
  evidence: string[],
  hasTestScript: boolean
): TestFrameworkInfo {
  return {
    name,
    confidence:
      evidence.length > 1 ? 0.99 : 0.9,
    evidence,
    hasTestScript,
    skipReason:
      hasTestScript
        ? undefined
        : `${label} project detected but no test script found`
  };
}

function detectTestFramework(
  files: string[],
  packageJson: PackageJson | null
): TestFrameworkInfo {
  const scripts =
    packageJson?.scripts;

  const hasTestScript =
    Boolean(
      scripts?.test
    );

  const dependencies =
    getDependencies(
      packageJson
    );

  const frameworkChecks: Array<{
    name: Exclude<TestFrameworkName, "generic-node" | "unknown">;
    label: string;
    evidence: string[];
  }> = [
    {
      name:
        "vitest",
      label:
        "Vitest",
      evidence: [
        hasConfigFile(
          files,
          /^vitest\.config\.(ts|js|mts|mjs|cts|cjs)$/i
        )
          ? "vitest config detected"
          : undefined,
        hasDependency(
          dependencies,
          "vitest"
        )
          ? "vitest dependency detected"
          : undefined
      ].filter(Boolean) as string[]
    },
    {
      name:
        "jest",
      label:
        "Jest",
      evidence: [
        hasConfigFile(
          files,
          /^jest\.config\.(ts|js|mts|mjs|cts|cjs|json)$/i
        )
          ? "jest config detected"
          : undefined,
        hasDependency(
          dependencies,
          "jest"
        )
          ? "jest dependency detected"
          : undefined
      ].filter(Boolean) as string[]
    },
    {
      name:
        "playwright",
      label:
        "Playwright",
      evidence: [
        hasConfigFile(
          files,
          /^playwright\.config\.(ts|js|mts|mjs|cts|cjs)$/i
        )
          ? "playwright config detected"
          : undefined,
        hasDependency(
          dependencies,
          "@playwright/test"
        ) ||
        hasDependency(
          dependencies,
          "playwright"
        )
          ? "playwright dependency detected"
          : undefined
      ].filter(Boolean) as string[]
    },
    {
      name:
        "cypress",
      label:
        "Cypress",
      evidence: [
        hasConfigFile(
          files,
          /^cypress\.config\.(ts|js|mts|mjs|cts|cjs)$/i
        )
          ? "cypress config detected"
          : undefined,
        hasDependency(
          dependencies,
          "cypress"
        )
          ? "cypress dependency detected"
          : undefined
      ].filter(Boolean) as string[]
    },
    {
      name:
        "mocha",
      label:
        "Mocha",
      evidence: [
        hasConfigFile(
          files,
          /^\.mocharc(?:\.(js|cjs|json|yaml|yml))?$/i
        ) ||
        hasConfigFile(
          files,
          /^mocha\.opts$/i
        )
          ? "mocha config detected"
          : undefined,
        hasDependency(
          dependencies,
          "mocha"
        )
          ? "mocha dependency detected"
          : undefined
      ].filter(Boolean) as string[]
    },
    {
      name:
        "jasmine",
      label:
        "Jasmine",
      evidence: [
        hasConfigFile(
          files,
          /^jasmine\.(json|js)$/i
        ) ||
        hasConfigFile(
          files,
          /^spec\/support\/jasmine\.json$/i
        )
          ? "jasmine config detected"
          : undefined,
        hasDependency(
          dependencies,
          "jasmine"
        ) ||
        hasDependency(
          dependencies,
          "jasmine-core"
        )
          ? "jasmine dependency detected"
          : undefined
      ].filter(Boolean) as string[]
    }
  ];

  const detectedFramework =
    frameworkChecks.find(
      framework =>
        framework.evidence.length > 0
    );

  if (
    detectedFramework
  ) {
    return createTestFrameworkInfo(
      detectedFramework.name,
      detectedFramework.label,
      detectedFramework.evidence,
      hasTestScript
    );
  }

  if (
    hasTestScript
  ) {
    return {
      name:
        "generic-node",
      confidence:
        0.75,
      evidence:
        ["package.json test script detected"],
      hasTestScript
    };
  }

  return {
    name:
      "unknown",
    confidence:
      0,
    evidence:
      [],
    hasTestScript:
      false,
    skipReason:
      "No test script found"
  };
}

async function createScriptCommand(
  name: string,
  category: ValidationCategory,
  priority: number,
  packageManager: string,
  packageManagerCommands: PackageManagerCommands,
  scriptName: string,
  scripts: Record<string, string> | undefined,
  workspaces: ValidationWorkspace[]
): Promise<ValidationCommand> {
  if (
    scripts?.[scriptName]
  ) {
    const isWorkspaceFanOut =
      scripts[scriptName].includes("--workspaces") ||
      scripts[scriptName].includes("-ws");

    if (
      isWorkspaceFanOut &&
      !hasWorkspaceScript(
        workspaces,
        scriptName
      )
    ) {
      return createCommand(
        name,
        category,
        priority,
        packageManager,
        packageManagerCommands.run(
          scriptName
        ),
        false,
        `No workspace ${scriptName} script found`
      );
    }

    return createCommand(
      name,
      category,
      priority,
      packageManager,
      packageManagerCommands.run(
        scriptName
      )
    );
  }

  return createCommand(
    name,
    category,
    priority,
    packageManager,
    packageManagerCommands.run(
      scriptName
    ),
    false,
    `No ${scriptName} script found`
  );
}

function createBuildCommand(
  packageManager: string,
  packageManagerCommands: PackageManagerCommands,
  buildSystem: BuildSystemInfo
): ValidationCommand {
  return createCommand(
    "Build",
    "build",
    20,
    packageManager,
    packageManagerCommands.run(
      "build"
    ),
    buildSystem.hasBuildScript,
    buildSystem.hasBuildScript
      ? undefined
      : buildSystem.skipReason ?? "No build script found",
    {
      buildSystem:
        buildSystem.name,
      confidence:
        buildSystem.confidence,
      evidence:
        buildSystem.evidence
    }
  );
}

function createTestCommand(
  packageManager: string,
  packageManagerCommands: PackageManagerCommands,
  testFramework: TestFrameworkInfo
): ValidationCommand {
  return createCommand(
    "Test",
    "test",
    30,
    packageManager,
    packageManagerCommands.run(
      "test"
    ),
    testFramework.hasTestScript,
    testFramework.hasTestScript
      ? undefined
      : testFramework.skipReason ?? "No test script found",
    {
      testFramework:
        testFramework.name,
      confidence:
        testFramework.confidence,
      evidence:
        testFramework.evidence
    }
  );
}

function hasTypeScriptDependency(
  packageJson: PackageJson | null
): boolean {
  return Boolean(
    packageJson?.dependencies?.typescript ||
    packageJson?.devDependencies?.typescript
  );
}

function hasTypeScriptFiles(
  files: string[]
): boolean {
  return files.some(
    file =>
      /\.(ts|tsx)$/i.test(file) &&
      !/\.d\.ts$/i.test(file)
  );
}

function getTypeScriptConfigPriority(
  configFile: string
): number {
  const normalizedConfig =
    configFile.toLowerCase();

  if (
    normalizedConfig === "tsconfig.json"
  ) {
    return 0;
  }

  if (
    normalizedConfig === "tsconfig.app.json"
  ) {
    return 1;
  }

  if (
    normalizedConfig === "tsconfig.build.json"
  ) {
    return 2;
  }

  return 10;
}

function detectTypeScriptProject(
  files: string[],
  packageJson: PackageJson | null
): TypeScriptProjectInfo {
  const configFiles =
    files
      .filter(
        file =>
          !file.includes("/") &&
          /^tsconfig(?:\..+)?\.json$/i.test(file)
      )
      .sort(
        (left, right) =>
          getTypeScriptConfigPriority(left) -
            getTypeScriptConfigPriority(right) ||
          left.localeCompare(right)
      );

  const selectedConfig =
    configFiles[0];

  const typeScriptDependency =
    hasTypeScriptDependency(
      packageJson
    );

  const typeScriptFiles =
    hasTypeScriptFiles(
      files
    );

  const hasTypeScriptEvidence =
    typeScriptDependency ||
    typeScriptFiles ||
    configFiles.length > 0;

  if (
    !hasTypeScriptEvidence
  ) {
    return {
      configFiles,
      selectedConfig,
      hasTypeScriptDependency:
        typeScriptDependency,
      hasTypeScriptFiles:
        typeScriptFiles,
      shouldTypeCheck:
        false,
      skipReason:
        "No TypeScript files, dependency, or config found"
    };
  }

  if (
    !selectedConfig
  ) {
    return {
      configFiles,
      selectedConfig,
      hasTypeScriptDependency:
        typeScriptDependency,
      hasTypeScriptFiles:
        typeScriptFiles,
      shouldTypeCheck:
        false,
      skipReason:
        "No TypeScript config found"
    };
  }

  return {
    configFiles,
    selectedConfig,
    hasTypeScriptDependency:
      typeScriptDependency,
    hasTypeScriptFiles:
      typeScriptFiles,
    shouldTypeCheck:
      true
  };
}

export async function discoverValidationPlan(
  projectPath: string
): Promise<ValidationPlan> {
  const packageJson =
    await readPackageJson(
      projectPath
    );

  const rootFiles =
    await getRootFiles(
      projectPath
    );

  const projectFiles =
    await getProjectFiles(
      projectPath
    );

  const packageManagerDetection =
    detectPackageManager(
      rootFiles,
      packageJson
    );

  const packageManager =
    packageManagerDetection.name;

  const packageManagerCommands =
    getPackageManagerCommands(
      packageManager
    );

  const scripts =
    packageJson?.scripts;

  const workspacePatterns =
    getWorkspacePatterns(
      packageJson
    );

  const workspaces =
    await discoverWorkspaces(
      projectPath,
      workspacePatterns
    );

  const typeScriptProject =
    detectTypeScriptProject(
      projectFiles,
      packageJson
    );

  const buildSystem =
    detectBuildSystem(
      projectFiles,
      packageJson
    );

  const testFramework =
    detectTestFramework(
      projectFiles,
      packageJson
    );

  const installCommand =
    packageJson
      ? createCommand(
          "Install dependencies",
          "dependency",
          10,
          packageManager,
          packageManagerCommands.install
        )
      : createCommand(
          "Install dependencies",
          "dependency",
          10,
          packageManager,
          packageManagerCommands.install,
          false,
          "No package.json found"
        );

  const typeCheckExec =
    packageManagerCommands.exec(
      "tsc",
      [
        "--noEmit",
        "-p",
        typeScriptProject.selectedConfig ?? "tsconfig.json"
      ]
    );

  const typeCheckCommand =
    typeScriptProject.shouldTypeCheck &&
    typeScriptProject.selectedConfig
      ? createCommand(
          "Type Check",
          "type-check",
          50,
          typeCheckExec.command,
          typeCheckExec.args
        )
      : createCommand(
          "Type Check",
          "type-check",
          50,
          typeCheckExec.command,
          typeCheckExec.args,
          false,
          typeScriptProject.skipReason ??
            "TypeScript type check is not applicable"
        );

  return {
    packageManager,
    workspacePatterns,
    workspaces,
    commands: [
      installCommand,
      createBuildCommand(
        packageManager,
        packageManagerCommands,
        buildSystem
      ),
      createTestCommand(
        packageManager,
        packageManagerCommands,
        testFramework
      ),
      await createScriptCommand(
        "Lint",
        "lint",
        40,
        packageManager,
        packageManagerCommands,
        "lint",
        scripts,
        workspaces
      ),
      typeCheckCommand
    ]
  };
}

/**
 * Detect the validation category
 * from the command name.
 */
function getValidationCategory(
  commandName: string
): ValidationCategory {
  const name =
    commandName.toLowerCase();

  if (
    name.includes("install") ||
    name.includes("dependency")
  ) {
    return "dependency";
  }

  if (
    name.includes("type") ||
    name.includes("typecheck") ||
    name.includes("type-check")
  ) {
    return "type-check";
  }

  if (
    name.includes("build")
  ) {
    return "build";
  }

  if (
    name.includes("test")
  ) {
    return "test";
  }

  if (
    name.includes("lint")
  ) {
    return "lint";
  }

  return "configuration";
}

/**
 * Decide severity based on
 * validation category.
 */
function getValidationSeverity(
  category: ValidationCategory
): ValidationSeverity {
  switch (
    category
  ) {
    case "dependency":
      return "high";

    case "build":
      return "high";

    case "type-check":
      return "high";

    case "test":
      return "medium";

    case "lint":
      return "low";

    case "configuration":
      return "medium";

    default:
      return "medium";
  }
}

function parseTypeScriptErrors(
  output: string
): ParsedTypeScriptError[] {
  const errors: ParsedTypeScriptError[] = [];

  const regex =
    /(?:^|\r?\n)(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+?)(?=\r?\n|$)/g;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(output)) !== null
  ) {
    errors.push({
      file: match[1].trim(),

      line:
        Number(match[2]),

      column:
        Number(match[3]),

      code:
        match[4],

      message:
        match[5].trim()
    });
  }

  return errors;
}



function createTypeScriptSuggestion(
  error: ParsedTypeScriptError
): string {
  if (
    error.code === "TS2322"
  ) {
    return (
      "Check the value type and variable type. " +
      "Make sure the assigned value matches the expected TypeScript type."
    );
  }

  if (
    error.code === "TS2339"
  ) {
    return (
      "Check whether the property or method exists on the current type. " +
      "Verify the object type and property name."
    );
  }

  if (
    error.code === "TS2304"
  ) {
    return (
      "Check whether the referenced name is declared, imported, or spelled correctly."
    );
  }

  return (
    "Review the TypeScript error and update the code so the types and declarations match."
  );
}

/**
 * Parse Node/npm engine warnings.
 *
 * Example:
 *
 * npm warn EBADENGINE Unsupported engine {
 *   package: 'vite@7.3.6',
 *   required: { node: '^20.19.0 || >=22.12.0' },
 *   current: { node: 'v18.20.8', npm: '10.8.2' }
 * }
 */
function parseEngineWarning(
  output: string
): ParsedEngineWarning | null {
  if (
    !output.includes("EBADENGINE") &&
    !output
      .toLowerCase()
      .includes("unsupported engine")
  ) {
    return null;
  }

  const packageMatch =
    output.match(
      /package:\s*['"]([^'"]+)['"]/i
    );

  const requiredNodeMatch =
    output.match(
      /required:\s*\{\s*node:\s*['"]([^'"]+)['"]/i
    );

  const currentNodeMatch =
    output.match(
      /current:\s*\{\s*node:\s*['"]([^'"]+)['"],\s*npm:\s*['"]([^'"]+)['"]\s*\}/i
    );

  const packageNameAndVersion =
    packageMatch?.[1];

  let packageName:
    | string
    | undefined;

  let packageVersion:
    | string
    | undefined;

  if (
    packageNameAndVersion
  ) {
    const packageParts =
      packageNameAndVersion.match(
        /^(.+?)@([^@]+)$/
      );

    if (
      packageParts
    ) {
      packageName =
        packageParts[1];

      packageVersion =
        packageParts[2];
    } else {
      packageName =
        packageNameAndVersion;
    }
  }

  return {
    packageName,

    packageVersion,

    requiredNode:
      requiredNodeMatch?.[1],

    currentNode:
      currentNodeMatch?.[1],

    currentNpm:
      currentNodeMatch?.[2],

    message:
      "Package engine requirement does not match the current Node.js environment."
  };
}

/**
 * Create structured findings
 * whenever a validation command fails.
 *
 * One command may produce multiple findings.
 */
function createFailureFindings(
  validationCommand: ValidationCommand,
  exitCode: number | null,
  stdout: string,
  stderr: string
): ValidationFinding[] {
  const command =
    getCommandText(
      validationCommand
    );

  const category =
    validationCommand.category;

  const severity =
    getValidationSeverity(
      category
    );

  /**
   * Prefer stderr because compiler,
   * lint and runtime errors usually
   * appear there.
   *
   * If stderr is empty, use stdout.
   */
  const output =
    stderr.trim() ||
    stdout.trim() ||
    "Command failed without output.";

  /**
   * Parse ALL TypeScript errors.
   */
  const parsedTypeScriptErrors =
    parseTypeScriptErrors(
      output
    );

  /**
   * Build/type-check commands
   * can contain multiple TypeScript errors.
   */
  if (
    (
      category === "build" ||
      category === "type-check"
    ) &&
    parsedTypeScriptErrors.length > 0
  ) {
    return parsedTypeScriptErrors.map(
      (
        error
      ): ValidationFinding => ({
        type:
          "validation",

        severity,

        category,

        title:
          "TypeScript error",

        message:
          error.message,

        command,

        exitCode,

        evidence:
          `${error.file}(${error.line},${error.column}) [${error.code}]`,

        file:
          error.file,

        line:
          error.line,

        column:
          error.column,

        code:
          error.code,

        suggestion:
          createTypeScriptSuggestion(
            error
          )
      })
    );
  }

  /**
   * Check for Node/npm engine
   * compatibility warnings.
   */
  const parsedEngineWarning =
    parseEngineWarning(
      output
    );

  if (
    parsedEngineWarning
  ) {
    let engineMessage =
      parsedEngineWarning.message;

    if (
      parsedEngineWarning.packageName
    ) {
      engineMessage +=
        ` Package: ${parsedEngineWarning.packageName}`;

      if (
        parsedEngineWarning.packageVersion
      ) {
        engineMessage +=
          `@${parsedEngineWarning.packageVersion}`;
      }
    }

    if (
      parsedEngineWarning.requiredNode
    ) {
      engineMessage +=
        ` requires Node.js ${parsedEngineWarning.requiredNode}.`;
    }

    if (
      parsedEngineWarning.currentNode
    ) {
      engineMessage +=
        ` Current Node.js version is ${parsedEngineWarning.currentNode}.`;
    }

    return [
      {
        type:
          "validation",

        severity:
          "medium",

        category,

        title:
          "Node.js engine warning",

        message:
          engineMessage,

        command,

        exitCode,

        evidence:
          output,

        code:
          "EBADENGINE",

        suggestion:
          createEngineWarningSuggestion(
            parsedEngineWarning
          )
      }
    ];
  }

  /**
   * Generic validation failure.
   */
  return [
    {
      type:
        "validation",

      severity,

      category,

      title:
        `${validationCommand.name} failed`,

      message:
        `The ${validationCommand.name.toLowerCase()} command failed.`,

      command,

      exitCode,

      evidence:
        output
    }
  ];
}

/**
 * Create a stable key for a validation finding.
 *
 * The command is intentionally excluded.
 *
 * This allows:
 *
 * npm run build
 *
 * and:
 *
 * npx tsc --noEmit
 *
 * to be treated as the same logical finding.
 */
function getFindingKey(
  finding: ValidationFinding
): string {
  return [
    finding.code ?? "",
    finding.file ?? "",
    finding.line ?? "",
    finding.column ?? "",
    finding.message.trim()
  ].join("|");
}

/**
 * Remove duplicate validation findings.
 */
function deduplicateFindings(
  findings: ValidationFinding[]
): ValidationFinding[] {
  const uniqueFindings =
    new Map<
      string,
      ValidationFinding
    >();

  for (
    const finding
    of findings
  ) {
    const key =
      getFindingKey(
        finding
      );

    console.log(
      `🔑 Finding Key: ${key}`
    );

    if (
      !uniqueFindings.has(
        key
      )
    ) {
      uniqueFindings.set(
        key,
        finding
      );
    }
  }

  const result =
    Array.from(
      uniqueFindings.values()
    );

  console.log(
    `🔎 Deduplication: ${findings.length} → ${result.length}`
  );

  return result;
}

/**
 * Create a skipped validation result.
 */
function createSkippedResult(
  validationCommand: ValidationCommand
): ValidationResult {
  const skipReason =
    validationCommand.skipReason ??
    "Validation command is not available";

  return {
    name:
      validationCommand.name,

    command:
      getCommandText(
        validationCommand
      ),

    status:
      "skipped",

    category:
      validationCommand.category,

    exitCode:
      null,

    stdout:
      "",

    stderr:
      "",

    durationMs:
      0,

    findings:
      [],

    warnings:
      [],

    skipReason
  };
}

/**
 * Execute one validation command.
 */
function runCommand(
  projectPath: string,
  validationCommand: ValidationCommand
): Promise<ValidationResult> {
  return new Promise(
    (resolve) => {
      const started =
        Date.now();

      const isWindows =
        process.platform ===
        "win32";

      /**
       * On Windows npm is executed
       * through npm.cmd.
       */
      const executable =
        isWindows
          ? `${validationCommand.command}.cmd`
          : validationCommand.command;

      console.log(
        `Executable: ${executable}`
      );

      /**
       * shell:true is important for
       * Windows/Git Bash compatibility.
       */
      const child =
        spawn(
          executable,

          validationCommand.args,

          {
            cwd:
              projectPath,

            shell:
              isWindows,

            windowsHide:
              true,

            stdio: [
              "ignore",
              "pipe",
              "pipe"
            ]
          }
        );

      let stdout =
        "";

      let stderr =
        "";

      /**
       * Capture stdout.
       */
      child.stdout?.on(
        "data",
        (data) => {
          stdout +=
            data.toString();
        }
      );

      /**
       * Capture stderr.
       */
      child.stderr?.on(
        "data",
        (data) => {
          stderr +=
            data.toString();
        }
      );

      /**
       * Command completed.
       */
      child.on(
        "close",
        (exitCode) => {
          const status:
            ValidationStatus =
            exitCode === 0
              ? "passed"
              : "failed";

          const result:
            ValidationResult = {
            name:
              validationCommand.name,

            command:
              getCommandText(
                validationCommand
              ),

            status,

            category:
              validationCommand.category,

            exitCode,

            stdout,

            stderr,

            durationMs:
              Date.now() -
              started,

            findings:
              [],

            warnings:
              []
          };

          /**
           * Combine stdout and stderr
           * because warnings may appear
           * in either stream.
           */
          const combinedOutput =
            `${stdout}\n${stderr}`;

          /**
           * Detect Node/npm engine warning
           * even when command succeeds.
           */
          const parsedEngineWarning =
            parseEngineWarning(
              combinedOutput
            );

          if (
            parsedEngineWarning
          ) {
            let engineMessage =
              parsedEngineWarning.message;

            if (
              parsedEngineWarning.packageName
            ) {
              engineMessage +=
                ` Package: ${parsedEngineWarning.packageName}`;

              if (
                parsedEngineWarning.packageVersion
              ) {
                engineMessage +=
                  `@${parsedEngineWarning.packageVersion}`;
              }
            }

            if (
              parsedEngineWarning.requiredNode
            ) {
              engineMessage +=
                ` Required Node.js: ${parsedEngineWarning.requiredNode}.`;
            }

            if (
              parsedEngineWarning.currentNode
            ) {
              engineMessage +=
                ` Current Node.js: ${parsedEngineWarning.currentNode}.`;
            }

            const warningFinding:
              ValidationFinding = {
              type:
                "validation",

              severity:
                "medium",

              category:
                validationCommand.category,

              title:
                "Node.js engine warning",

              message:
                engineMessage,

              command:
                getCommandText(
                  validationCommand
                ),

              exitCode,

              evidence:
                combinedOutput.trim(),

              code:
                "EBADENGINE",

              suggestion:
                createEngineWarningSuggestion(
                  parsedEngineWarning
                )
            };

            result.warnings?.push(
              warningFinding
            );
          }

          if (
            status === "passed" &&
            result.warnings &&
            result.warnings.length > 0
          ) {
            result.status =
              "warning";
          }

          /**
           * If command failed,
           * attach structured findings.
           */
          if (
            status ===
            "failed"
          ) {
            result.findings =
              createFailureFindings(
                validationCommand,
                exitCode,
                stdout,
                stderr
              );
          }

          resolve(
            result
          );
        }
      );

      /**
       * Process could not start.
       */
      child.on(
        "error",
        (error) => {
          const errorOutput =
            stderr +
            "\n" +
            error.message;

          const result:
            ValidationResult = {
            name:
              validationCommand.name,

            command:
              getCommandText(
                validationCommand
              ),

            status:
              "failed",

            category:
              validationCommand.category,

            exitCode:
              null,

            stdout,

            stderr:
              errorOutput,

            durationMs:
              Date.now() -
              started,

            findings:
              [],

            warnings:
              []
          };

          result.findings =
            createFailureFindings(
              validationCommand,
              null,
              stdout,
              errorOutput
            );

          resolve(
            result
          );
        }
      );
    }
  );
}

/**
 * Run all validations for a project.
 */
export async function validateProject(
  projectPath: string,
  commands: ValidationCommand[],
  packageManager = "npm"
): Promise<ValidationReport> {
  const startedAt =
    new Date().toISOString();

  const results:
    ValidationResult[] = [];

  const findings:
    ValidationFinding[] = [];

  const warnings:
    ValidationFinding[] = [];

  /**
   * Run every validation command.
   */
  for (
    const validationCommand
    of commands
  ) {
    console.log("");

    if (
      validationCommand.available ===
      false
    ) {
      const result =
        createSkippedResult(
          validationCommand
        );

      results.push(
        result
      );

      console.log(
        `⏭️ Skipped ${result.name}: ${result.skipReason}`
      );

      continue;
    }

    console.log(
      `▶ Running command: ${getCommandText(validationCommand)}`
    );

    /**
     * Run command.
     */
    const result =
      await runCommand(
        projectPath,
        validationCommand
      );

    /**
     * Store result.
     */
    results.push(
      result
    );

    /**
     * Collect findings.
     */
    if (
      result.findings &&
      result.findings.length > 0
    ) {
      findings.push(
        ...result.findings
      );
    }

    /**
     * Collect warnings.
     */
    if (
      result.warnings &&
      result.warnings.length > 0
    ) {
      warnings.push(
        ...result.warnings
      );
    }

    /**
     * Print status.
     */
    if (
      result.status ===
      "passed"
    ) {
      console.log(
        `✅ ${result.name}`
      );
    }

    if (
      result.status ===
      "warning"
    ) {
      console.log(
        `⚠️ ${result.name}`
      );
    }

    if (
      result.status ===
      "failed"
    ) {
      console.log(
        `❌ ${result.name}`
      );

      /**
       * Print every finding
       * generated by this command.
       */
      if (
        result.findings &&
        result.findings.length > 0
      ) {
        for (
          const finding
          of result.findings
        ) {
          console.log("");

          console.log(
            `Severity: ${finding.severity}`
          );

          console.log(
            `Category: ${finding.category}`
          );

          console.log(
            `Finding: ${finding.title}`
          );

          console.log(
            `Message: ${finding.message}`
          );

          if (
            finding.file
          ) {
            console.log(
              `File: ${finding.file}`
            );
          }

          if (
            finding.line !==
            undefined
          ) {
            console.log(
              `Line: ${finding.line}`
            );
          }

          if (
            finding.column !==
            undefined
          ) {
            console.log(
              `Column: ${finding.column}`
            );
          }

          if (
            finding.code
          ) {
            console.log(
              `Code: ${finding.code}`
            );
          }

          if (
            finding.suggestion
          ) {
            console.log(
              `💡 Suggested Fix: ${finding.suggestion}`
            );
          }
        }
      }
    }

    /**
     * Print warnings.
     */
    if (
      result.warnings &&
      result.warnings.length > 0
    ) {
      for (
        const warning
        of result.warnings
      ) {
        console.log("");

        console.log(
          `⚠️ ${warning.title}`
        );

        console.log(
          warning.message
        );

        if (
          warning.suggestion
        ) {
          console.log(
            `💡 Suggested Fix: ${warning.suggestion}`
          );
        }
      }
    }

    /**
     * Print stdout.
     */
    if (
      result.stdout.trim()
    ) {
      console.log("");

      console.log(
        "STDOUT:"
      );

      console.log(
        result.stdout.trim()
      );
    }

    /**
     * Print stderr.
     */
    if (
      result.stderr.trim()
    ) {
      console.log("");

      console.log(
        "STDERR:"
      );

      console.log(
        result.stderr.trim()
      );
    }
  }

  /**
   * Remove duplicate findings.
   */
  const uniqueFindings =
    deduplicateFindings(
      findings
    );

  /**
   * Remove duplicate warnings.
   */
  const uniqueWarnings =
    deduplicateFindings(
      warnings
    );

  /**
   * Project is valid only when
   * there are no validation findings.
   */
  const passed =
    uniqueFindings.length ===
    0;

  const completedAt =
    new Date().toISOString();

  return {
    projectPath,

    packageManager,

    results,

    findings:
      uniqueFindings,

    warnings:
      uniqueWarnings,

    passed,

    startedAt,

    completedAt
  };
}

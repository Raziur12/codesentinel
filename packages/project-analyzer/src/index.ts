import fs from "node:fs/promises";
import path from "node:path";

import {
  detectPackageManager
} from "@codesentinel/scanner-core";

import type {
  DependencyAnalysis,
  DependencyEntry,
  DependencyIssue,
  DependencyScope,
  DependencyTreeNode,
  PackageManagerName
} from "@codesentinel/scanner-core";

export interface ProjectStructure {
  rootFiles: string[];

  directories: string[];

  frontend: boolean;

  backend: boolean;

  tests: boolean;

  configuration: string[];

  packageFiles: string[];

  infrastructure: string[];
}

interface PackageJson {
  dependencies?: Record<string, string>;

  devDependencies?: Record<string, string>;

  peerDependencies?: Record<string, string>;

  optionalDependencies?: Record<string, string>;

  engines?: Record<string, string>;

  packageManager?: string;
}

interface PackageLockPackage {
  version?: string;

  dependencies?: Record<string, string>;

  peerDependencies?: Record<string, string>;

  optionalDependencies?: Record<string, string>;

  engines?: Record<string, string>;

  dev?: boolean;

  optional?: boolean;

  peer?: boolean;
}

interface PackageLockJson {
  lockfileVersion?: number;

  packages?: Record<string, PackageLockPackage>;
}

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".codesentinel",
  "coverage"
]);

async function walkProject(
  directory: string,
  root: string,
  files: string[],
  directories: string[]
): Promise<void> {
  const entries = await fs.readdir(directory, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      directories.push(
        path.relative(root, fullPath)
      );

      await walkProject(
        fullPath,
        root,
        files,
        directories
      );

      continue;
    }

    files.push(
      path.relative(root, fullPath)
    );
  }
}

function hasFile(
  files: string[],
  fileName: string
): boolean {
  return files.some(
    file =>
      path.basename(file).toLowerCase() ===
      fileName.toLowerCase()
  );
}

function hasDirectory(
  directories: string[],
  directoryName: string
): boolean {
  return directories.some(
    directory =>
      path.basename(directory).toLowerCase() ===
      directoryName.toLowerCase()
  );
}

function detectFrontend(
  files: string[],
  directories: string[]
): boolean {
  return (
    hasDirectory(directories, "src") ||
    hasDirectory(directories, "frontend") ||
    files.some(file =>
      /\.(tsx|jsx|vue|svelte)$/i.test(file)
    )
  );
}

function detectBackend(
  files: string[],
  directories: string[]
): boolean {
  return (
    hasDirectory(directories, "backend") ||
    hasDirectory(directories, "server") ||
    hasDirectory(directories, "api") ||
    files.some(file =>
      /(^|\/)(server|app|api)\.(ts|js|py|cs|java)$/i.test(
        file
      )
    )
  );
}

function detectTests(
  files: string[],
  directories: string[]
): boolean {
  return (
    hasDirectory(directories, "test") ||
    hasDirectory(directories, "tests") ||
    files.some(file =>
      /\.(test|spec)\./i.test(file)
    )
  );
}

function detectConfiguration(
  files: string[]
): string[] {
  return files.filter(file => {
    const basename =
      path.basename(file);

    return (
      /^tsconfig(?:\..+)?\.json$/i.test(basename) ||
      /^jest\.config\.(ts|js|mts|mjs|cts|cjs|json)$/i.test(basename) ||
      /^vitest\.config\.(ts|js|mts|mjs|cts|cjs)$/i.test(basename) ||
      /^playwright\.config\.(ts|js|mts|mjs|cts|cjs)$/i.test(basename) ||
      /^cypress\.config\.(ts|js|mts|mjs|cts|cjs)$/i.test(basename) ||
      /^\.mocharc(?:\.(js|cjs|json|yaml|yml))?$/i.test(basename) ||
      /^jasmine\.(json|js)$/i.test(basename) ||
      /^eslint\.config\.(ts|js|mts|mjs|cts|cjs)$/i.test(basename) ||
      /^\.eslintrc(?:\.(js|cjs|json|yaml|yml))?$/i.test(basename) ||
      /^biome\.jsonc?$/i.test(basename) ||
      /^\.prettierrc(?:\.(js|cjs|mjs|json|yaml|yml|toml))?$/i.test(basename) ||
      /^prettier\.config\.(ts|js|mts|mjs|cts|cjs)$/i.test(basename) ||
      /^\.prettierignore$/i.test(basename) ||
      /^stylelint\.config\.(ts|js|mts|mjs|cts|cjs)$/i.test(basename) ||
      /^\.stylelintrc(?:\.(js|cjs|json|yaml|yml))?$/i.test(basename) ||
      [
        "package.json",
        ".codesentinel.json",
        ".codesentinelignore",
        ".env",
        ".env.example",
        "vite.config.ts",
        "vite.config.js",
        "angular.json",
        "webpack.config.js",
        "next.config.js",
        "next.config.ts",
        "docker-compose.yml",
        "docker-compose.yaml"
      ].includes(basename)
    );
  });
}

function detectPackageFiles(
  files: string[]
): string[] {
  const packageFileNames = new Set([
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lock",
    "bun.lockb",
    "requirements.txt",
    "pyproject.toml",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "go.mod",
    "Cargo.toml",
    "*.csproj"
  ]);

  return files.filter(file => {
    const name = path.basename(file);

    if (packageFileNames.has(name)) {
      return true;
    }

    return /\.csproj$/i.test(name);
  });
}

function detectInfrastructure(
  files: string[]
): string[] {
  return files.filter(file => {
    const normalized = file.replace(/\\/g, "/");

    return (
      normalized.includes(".github/workflows/") ||
      normalized.includes("terraform") ||
      normalized.includes("kubernetes") ||
      normalized.includes("k8s") ||
      path.basename(file).toLowerCase() ===
        "dockerfile"
    );
  });
}

async function fileExists(
  filePath: string
): Promise<boolean> {
  try {
    const stats =
      await fs.stat(
        filePath
      );

    return stats.isFile();
  } catch {
    return false;
  }
}

async function readJsonFile<T>(
  filePath: string
): Promise<T | null> {
  if (
    !(await fileExists(filePath))
  ) {
    return null;
  }

  try {
    return JSON.parse(
      await fs.readFile(
        filePath,
        "utf8"
      )
    ) as T;
  } catch {
    return null;
  }
}

function normalizeDependencyEntries(
  dependencies: Record<string, string> | undefined,
  scope: DependencyScope,
  installedVersions: Map<string, string>
): DependencyEntry[] {
  return Object
    .entries(
      dependencies ?? {}
    )
    .sort(
      ([left], [right]) =>
        left.localeCompare(
          right
        )
    )
    .map(
      ([name, specifier]) => ({
        name,
        specifier,
        scope,
        installedVersion:
          installedVersions.get(
            name
          )
      })
    );
}

function getInstalledVersions(
  packageLock: PackageLockJson | null
): Map<string, string> {
  const versions =
    new Map<string, string>();

  for (
    const [
      packagePath,
      packageInfo
    ]
    of Object.entries(
      packageLock?.packages ?? {}
    )
  ) {
    if (
      !packagePath.startsWith("node_modules/")
    ) {
      continue;
    }

    const packageName =
      packagePath.replace(
        /^node_modules\//,
        ""
      );

    if (
      packageInfo.version
    ) {
      versions.set(
        packageName,
        packageInfo.version
      );
    }
  }

  return versions;
}

function createDependencyTree(
  packageLock: PackageLockJson | null
): DependencyTreeNode[] {
  return Object
    .entries(
      packageLock?.packages ?? {}
    )
    .filter(
      ([packagePath]) =>
        packagePath.startsWith(
          "node_modules/"
        )
    )
    .map(
      ([packagePath, packageInfo]) => ({
        name:
          packagePath.replace(
            /^node_modules\//,
            ""
          ),
        version:
          packageInfo.version,
        path:
          packagePath,
        dependencies:
          Object.keys(
            packageInfo.dependencies ?? {}
          ).sort(),
        dev:
          packageInfo.dev === true,
        optional:
          packageInfo.optional === true,
        peer:
          packageInfo.peer === true,
        engines:
          packageInfo.engines
      })
    )
    .sort(
      (left, right) =>
        left.name.localeCompare(
          right.name
        )
    );
}

function compareDeclaredDependencyGroups(
  groups: Array<{
    scope: DependencyScope;
    dependencies: Record<string, string> | undefined;
  }>
): DependencyIssue[] {
  const declared =
    new Map<string, Array<{
      scope: DependencyScope;
      specifier: string;
    }>>();

  for (
    const group
    of groups
  ) {
    for (
      const [
        name,
        specifier
      ]
      of Object.entries(
        group.dependencies ?? {}
      )
    ) {
      const entries =
        declared.get(
          name
        ) ?? [];

      entries.push({
        scope:
          group.scope,
        specifier
      });

      declared.set(
        name,
        entries
      );
    }
  }

  return Array
    .from(
      declared.entries()
    )
    .filter(
      ([, entries]) =>
        new Set(
          entries.map(
            entry =>
              entry.specifier
          )
        ).size > 1
    )
    .map(
      ([packageName, entries]) => ({
        code:
          "DEPENDENCY_CONFLICTING_DECLARATIONS",
        title:
          "Dependency has conflicting declared versions",
        message:
          `${packageName} is declared with different version ranges across dependency groups.`,
        packageName,
        severity:
          "medium",
        metadata:
          {
            declarations:
              entries
          }
      })
    );
}

function createPeerDependencyConflicts(
  packageJson: PackageJson | null
): DependencyIssue[] {
  const declaredRuntime =
    new Set([
      ...Object.keys(
        packageJson?.dependencies ?? {}
      ),
      ...Object.keys(
        packageJson?.devDependencies ?? {}
      ),
      ...Object.keys(
        packageJson?.optionalDependencies ?? {}
      )
    ]);

  return Object
    .entries(
      packageJson?.peerDependencies ?? {}
    )
    .filter(
      ([name]) =>
        !declaredRuntime.has(
          name
        )
    )
    .map(
      ([packageName, specifier]) => ({
        code:
          "PEER_DEPENDENCY_NOT_INSTALLED",
        title:
          "Peer dependency is not installed by this project",
        message:
          `${packageName}@${specifier} is declared as a peer dependency but is not installed as a direct, dev, or optional dependency.`,
        packageName,
        severity:
          "low",
        metadata:
          {
            specifier
          }
      })
    );
}

function createEngineRequirements(
  packageJson: PackageJson | null,
  dependencyTree: DependencyTreeNode[]
): DependencyIssue[] {
  const rootRequirements =
    Object
      .entries(
        packageJson?.engines ?? {}
      )
      .map(
        ([engineName, requirement]) => ({
          code:
            "PROJECT_ENGINE_REQUIREMENT",
          title:
            "Project engine requirement",
          message:
            `Project requires ${engineName} ${requirement}.`,
          severity:
            "info" as const,
          metadata:
            {
              engineName,
              requirement,
              source:
                "package.json"
            }
        })
      );

  const dependencyRequirements =
    dependencyTree.flatMap(
      dependency =>
        Object
          .entries(
            dependency.engines ?? {}
          )
          .map(
            ([engineName, requirement]) => ({
              code:
                "DEPENDENCY_ENGINE_REQUIREMENT",
              title:
                "Dependency engine requirement",
              message:
                `${dependency.name} requires ${engineName} ${requirement}.`,
              packageName:
                dependency.name,
              severity:
                "info" as const,
              metadata:
                {
                  engineName,
                  requirement,
                  version:
                    dependency.version,
                  source:
                    dependency.path
                }
            })
          )
    );

  return [
    ...rootRequirements,
    ...dependencyRequirements
  ];
}

function createOutdatedSignals(
  entries: DependencyEntry[]
): DependencyIssue[] {
  return entries
    .filter(
      entry =>
        entry.installedVersion &&
        /^[0-9]+\.[0-9]+\.[0-9]+$/.test(
          entry.specifier
        ) &&
        entry.installedVersion !== entry.specifier
    )
    .map(
      entry => ({
        code:
          "DEPENDENCY_LOCK_VERSION_DRIFT",
        title:
          "Declared dependency version differs from lockfile",
        message:
          `${entry.name} is declared as ${entry.specifier} but the lockfile installs ${entry.installedVersion}.`,
        packageName:
          entry.name,
        severity:
          "medium",
        metadata:
          {
            scope:
              entry.scope,
            declaredVersion:
              entry.specifier,
            installedVersion:
              entry.installedVersion
          }
      })
    );
}

function getLockfile(
  rootFiles: string[]
): string | undefined {
  return [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lock",
    "bun.lockb"
  ].find(
    file =>
      rootFiles.includes(
        file
      )
  );
}

export async function analyzeDependencies(
  projectPath: string
): Promise<DependencyAnalysis> {
  const files: string[] = [];
  const directories: string[] = [];

  await walkProject(
    projectPath,
    projectPath,
    files,
    directories
  );

  const rootFiles =
    files
      .filter(
        file =>
          !file.includes(
            path.sep
          )
      )
      .sort();

  const packageJson =
    await readJsonFile<PackageJson>(
      path.join(
        projectPath,
        "package.json"
      )
    );

  const packageLock =
    await readJsonFile<PackageLockJson>(
      path.join(
        projectPath,
        "package-lock.json"
      )
    );

  const packageManagerDetection =
    detectPackageManager(
      rootFiles,
      packageJson
    );

  const packageManager:
    PackageManagerName =
    packageManagerDetection.name;

  const installedVersions =
    getInstalledVersions(
      packageLock
    );

  const directDependencies =
    normalizeDependencyEntries(
      packageJson?.dependencies,
      "direct",
      installedVersions
    );

  const devDependencies =
    normalizeDependencyEntries(
      packageJson?.devDependencies,
      "dev",
      installedVersions
    );

  const peerDependencies =
    normalizeDependencyEntries(
      packageJson?.peerDependencies,
      "peer",
      installedVersions
    );

  const optionalDependencies =
    normalizeDependencyEntries(
      packageJson?.optionalDependencies,
      "optional",
      installedVersions
    );

  const dependencyTree =
    createDependencyTree(
      packageLock
    );

  const allEntries = [
    ...directDependencies,
    ...devDependencies,
    ...peerDependencies,
    ...optionalDependencies
  ];

  return {
    packageManager,
    packageFile:
      packageJson
        ? "package.json"
        : undefined,
    lockfile:
      getLockfile(
        rootFiles
      ),
    directDependencies,
    devDependencies,
    peerDependencies,
    optionalDependencies,
    dependencyTree,
    outdatedDependencies:
      createOutdatedSignals(
        allEntries
      ),
    engineRequirements:
      createEngineRequirements(
        packageJson,
        dependencyTree
      ),
    dependencyConflicts:
      compareDeclaredDependencyGroups([
        {
          scope:
            "direct",
          dependencies:
            packageJson?.dependencies
        },
        {
          scope:
            "dev",
          dependencies:
            packageJson?.devDependencies
        },
        {
          scope:
            "optional",
          dependencies:
            packageJson?.optionalDependencies
        }
      ]),
    peerDependencyConflicts:
      createPeerDependencyConflicts(
        packageJson
      )
  };
}

export async function analyzeProject(
  projectPath: string
): Promise<ProjectStructure> {
  const files: string[] = [];
  const directories: string[] = [];

  await walkProject(
    projectPath,
    projectPath,
    files,
    directories
  );

  return {
    rootFiles: files
      .filter(file => !file.includes(path.sep))
      .sort(),

    directories: directories.sort(),

    frontend: detectFrontend(
      files,
      directories
    ),

    backend: detectBackend(
      files,
      directories
    ),

    tests: detectTests(
      files,
      directories
    ),

    configuration:
      detectConfiguration(files),

    packageFiles:
      detectPackageFiles(files),

    infrastructure:
      detectInfrastructure(files)
  };
}

export {
  walkProject
};

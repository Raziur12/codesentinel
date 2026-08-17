import fs from "node:fs/promises";
import path from "node:path";

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
  return files.filter(file =>
    /^tsconfig(?:\..+)?\.json$/i.test(path.basename(file)) ||
    [
      "package.json",
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
    ].includes(path.basename(file))
  );
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

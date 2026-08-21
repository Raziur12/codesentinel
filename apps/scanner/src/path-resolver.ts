import fs from "node:fs/promises";
import path from "node:path";

async function fileExists(
  filePath: string
): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function findWorkspaceRoot(
  startDirectory: string
): Promise<string> {
  let currentDirectory =
    path.resolve(startDirectory);

  while (true) {
    const packageJsonPath =
      path.join(
        currentDirectory,
        "package.json"
      );

    if (await fileExists(packageJsonPath)) {
      try {
        const packageJsonContent =
          await fs.readFile(
            packageJsonPath,
            "utf8"
          );

        const packageJson =
          JSON.parse(packageJsonContent);

        /*
         * CodeSentinel root package.json
         * should contain workspaces.
         */
        if (
          Array.isArray(
            packageJson.workspaces
          )
        ) {
          return currentDirectory;
        }
      } catch {
        // Continue searching parent directories.
      }
    }

    const parentDirectory =
      path.dirname(currentDirectory);

    if (
      parentDirectory === currentDirectory
    ) {
      break;
    }

    currentDirectory =
      parentDirectory;
  }

  throw new Error(
    "Could not find CodeSentinel workspace root."
  );
}

async function validateProjectPath(
  projectPath: string
): Promise<string> {
  try {
    const stats =
      await fs.stat(projectPath);

    if (!stats.isDirectory()) {
      throw new Error(
        `Project path is not a directory: ${projectPath}`
      );
    }

    return projectPath;
  } catch {
    throw new Error(
      `Project directory does not exist: ${projectPath}`
    );
  }
}

async function existingDirectoryPath(
  projectPath: string
): Promise<string | undefined> {
  try {
    const stats =
      await fs.stat(
        projectPath
      );

    return stats.isDirectory()
      ? projectPath
      : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveWorkspaceProjectPath(
  rootProjectPath: string,
  workspacePath: string
): Promise<string> {
  const resolvedWorkspacePath =
    path.isAbsolute(workspacePath)
      ? path.normalize(workspacePath)
      : path.resolve(
          rootProjectPath,
          workspacePath
        );

  const relativeWorkspacePath =
    path.relative(
      rootProjectPath,
      resolvedWorkspacePath
    );

  if (
    relativeWorkspacePath.startsWith("..") ||
    path.isAbsolute(relativeWorkspacePath)
  ) {
    throw new Error(
      `Workspace path must be inside project root: ${workspacePath}`
    );
  }

  return validateProjectPath(
    resolvedWorkspacePath
  );
}

export async function resolveProjectPath(
  inputPath: string
): Promise<string> {
  /*
   * Absolute path:
   *
   * C:/projects/my-project
   * D:/projects/my-project
   */
  if (path.isAbsolute(inputPath)) {
    return validateProjectPath(
      path.normalize(inputPath)
    );
  }

  const cwdRelativePath =
    path.resolve(
      process.cwd(),
      inputPath
    );

  const existingCwdRelativePath =
    await existingDirectoryPath(
      cwdRelativePath
    );

  if (
    existingCwdRelativePath
  ) {
    return existingCwdRelativePath;
  }

  /*
   * Fallback for running the scanner from inside this monorepo
   * while passing a path relative to the repository root.
   */
  const workspaceRoot =
    await findWorkspaceRoot(
      process.cwd()
    );

  const resolvedPath =
    path.resolve(
      workspaceRoot,
      inputPath
    );

  return validateProjectPath(
    resolvedPath
  );
}

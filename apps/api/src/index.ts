import { spawn } from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getMongoDatabase,
  MongoProjectRepository,
  MongoScanArtifactRepository,
  MongoScanRepository,
  readMongoDatabaseConfigFromEnv
} from "@codesentinel/database";

import type {
  AiAnalysisRecord,
  FindingRecord,
  FixRecord,
  ProjectRecord,
  ProjectRepository,
  ScanArtifactRepository,
  ScanArtifactSet,
  ScanRecord,
  ScanRepository
} from "@codesentinel/database";

interface CreateScanRequest {
  projectId?: string;
  projectPath?: string;
  name?: string;
  groupId?: string;
  groupLabel?: string;
}

interface CreateGithubScanRequest {
  repositoryUrl?: string;
  ref?: string;
}

interface CreateGithubGroupScanRequest {
  groupLabel?: string;
  repositories?: Array<{
    repositoryUrl?: string;
    ref?: string;
    label?: string;
  }>;
}

interface CreateProjectRequest {
  name?: string;
  path?: string;
}

interface UploadedFilePart {
  fieldName: string;
  fileName: string;
  body: Buffer;
}

interface ApiResponse {
  status: number;
  body: unknown;
}

const apiSourceFile =
  fileURLToPath(
    import.meta.url
  );

const defaultRepositoryRoot =
  path.resolve(
    path.dirname(
      apiSourceFile
    ),
    "..",
    "..",
    ".."
  );

function loadEnvFile(
  filePath: string
): void {
  if (
    !fsSync.existsSync(
      filePath
    )
  ) {
    return;
  }

  const content =
    fsSync.readFileSync(
      filePath,
      "utf8"
    );

  for (
    const line
    of content.split(/\r?\n/)
  ) {
    const trimmedLine =
      line.trim();

    if (
      trimmedLine.length === 0 ||
      trimmedLine.startsWith("#")
    ) {
      continue;
    }

    const separatorIndex =
      trimmedLine.indexOf("=");

    if (
      separatorIndex === -1
    ) {
      continue;
    }

    const key =
      trimmedLine
        .slice(
          0,
          separatorIndex
        )
        .trim();

    const rawValue =
      trimmedLine
        .slice(
          separatorIndex + 1
        )
        .trim();

    const value =
      rawValue.replace(
        /^["']|["']$/g,
        ""
      );

    if (
      key &&
      process.env[key] === undefined
    ) {
      process.env[key] =
        value;
    }
  }
}

loadEnvFile(
  path.join(
    defaultRepositoryRoot,
    ".env"
  )
);

const repositoryRoot =
  process.env.CODESENTINEL_ROOT
    ? path.resolve(
        defaultRepositoryRoot,
        process.env.CODESENTINEL_ROOT
      )
    : defaultRepositoryRoot;

const storageDirectory =
  path.join(
    repositoryRoot,
    ".codesentinel-api",
    "scans"
  );

const projectStorageDirectory =
  path.join(
    repositoryRoot,
    ".codesentinel-api",
    "projects"
  );

const artifactStorageDirectory =
  path.join(
    repositoryRoot,
    ".codesentinel-api",
    "artifacts"
  );

const uploadStorageDirectory =
  path.join(
    repositoryRoot,
    ".codesentinel-api",
    "uploads"
  );

let scanRepository:
  ScanRepository |
  undefined;

let projectRepository:
  ProjectRepository |
  undefined;

let artifactRepository:
  ScanArtifactRepository |
  undefined;

function createScanId(): string {
  return `scan_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createUploadId(): string {
  return `upload_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createGroupId(): string {
  return `group_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeIdentifierValue(
  value: string
): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(
      0,
      48
    );
}

function createProjectId(
  projectPath: string,
  teamId: string | undefined
): string {
  const base =
    normalizeIdentifierValue(
      path.basename(
        projectPath
      ) || "project"
    ) || "project";

  // A hash of the raw text (rather than a real digest) only reflects
  // its first few bytes once truncated - two paths sharing a long
  // common prefix (e.g. every upload under the same
  // .codesentinel-api/uploads/<id>/workspace root, which also share the
  // same basename) would otherwise collide onto the same project id.
  const hash =
    crypto
      .createHash("sha256")
      .update(`${teamId ?? "default"}:${projectPath}`)
      .digest("base64url")
      .slice(
        0,
        16
      );

  return `project_${base}_${hash}`;
}

function getScanRecordPath(
  scanId: string
): string {
  return path.join(
    storageDirectory,
    `${scanId}.json`
  );
}

async function ensureStorage(): Promise<void> {
  await fs.mkdir(
    storageDirectory,
    {
      recursive:
        true
    }
  );
}

async function ensureProjectStorage(): Promise<void> {
  await fs.mkdir(
    projectStorageDirectory,
    {
      recursive:
        true
    }
  );
}

async function ensureArtifactStorage(): Promise<void> {
  await fs.mkdir(
    artifactStorageDirectory,
    {
      recursive:
        true
    }
  );
}

async function saveScanRecord(
  record: ScanRecord
): Promise<void> {
  await ensureStorage();

  await fs.writeFile(
    getScanRecordPath(
      record.id
    ),
    JSON.stringify(
      record,
      null,
      2
    ),
    "utf8"
  );
}

async function readScanRecord(
  scanId: string
): Promise<ScanRecord | undefined> {
  try {
    return JSON.parse(
      await fs.readFile(
        getScanRecordPath(
          scanId
        ),
        "utf8"
      )
    ) as ScanRecord;
  } catch {
    return undefined;
  }
}

async function listScanRecords(
  limit = 50
): Promise<ScanRecord[]> {
  try {
    const entries =
      await fs.readdir(
        storageDirectory
      );

    const records =
      await Promise.all(
        entries
          .filter(
            entry => entry.endsWith(
              ".json"
            )
          )
          .map(
            async entry => {
              try {
                return JSON.parse(
                  await fs.readFile(
                    path.join(
                      storageDirectory,
                      entry
                    ),
                    "utf8"
                  )
                ) as ScanRecord;
              } catch {
                return undefined;
              }
            }
          )
      );

    return records
      .filter(
        (record): record is ScanRecord => Boolean(
          record
        )
      )
      .map(
        ({
          stdout,
          stderr,
          ...summary
        }) => summary
      )
      .sort(
        (
          left,
          right
        ) => right.createdAt.localeCompare(
          left.createdAt
        )
      )
      .slice(
        0,
        limit
      );
  } catch {
    return [];
  }
}

function getProjectRecordPath(
  projectId: string
): string {
  return path.join(
    projectStorageDirectory,
    `${projectId}.json`
  );
}

async function saveProjectRecord(
  record: ProjectRecord
): Promise<void> {
  await ensureProjectStorage();

  await fs.writeFile(
    getProjectRecordPath(
      record.id
    ),
    JSON.stringify(
      record,
      null,
      2
    ),
    "utf8"
  );
}

async function readProjectRecord(
  projectId: string
): Promise<ProjectRecord | undefined> {
  try {
    return JSON.parse(
      await fs.readFile(
        getProjectRecordPath(
          projectId
        ),
        "utf8"
      )
    ) as ProjectRecord;
  } catch {
    return undefined;
  }
}

async function listProjectRecords(
  limit = 50
): Promise<ProjectRecord[]> {
  try {
    const entries =
      await fs.readdir(
        projectStorageDirectory
      );

    const records =
      await Promise.all(
        entries
          .filter(
            entry => entry.endsWith(
              ".json"
            )
          )
          .map(
            async entry => {
              try {
                return JSON.parse(
                  await fs.readFile(
                    path.join(
                      projectStorageDirectory,
                      entry
                    ),
                    "utf8"
                  )
                ) as ProjectRecord;
              } catch {
                return undefined;
              }
            }
          )
      );

    return records
      .filter(
        (record): record is ProjectRecord => Boolean(
          record
        )
      )
      .sort(
        (
          left,
          right
        ) => right.updatedAt.localeCompare(
          left.updatedAt
        )
      )
      .slice(
        0,
        limit
      );
  } catch {
    return [];
  }
}

class FileScanRepository implements ScanRepository {
  async save(
    record: ScanRecord
  ): Promise<void> {
    await saveScanRecord(
      record
    );
  }

  async read(
    scanId: string
  ): Promise<ScanRecord | undefined> {
    return readScanRecord(
      scanId
    );
  }

  async list(
    limit?: number
  ): Promise<ScanRecord[]> {
    return listScanRecords(
      limit
    );
  }

  async listByProject(
    projectId: string,
    limit = 50
  ): Promise<ScanRecord[]> {
    const records =
      await listScanRecords(
        500
      );

    return records
      .filter(
        record => record.projectId === projectId
      )
      .slice(
        0,
        limit
      );
  }
}

class FileProjectRepository implements ProjectRepository {
  async save(
    record: ProjectRecord
  ): Promise<void> {
    await saveProjectRecord(
      record
    );
  }

  async read(
    projectId: string
  ): Promise<ProjectRecord | undefined> {
    return readProjectRecord(
      projectId
    );
  }

  async list(
    limit?: number
  ): Promise<ProjectRecord[]> {
    return listProjectRecords(
      limit
    );
  }
}

class FileScanArtifactRepository implements ScanArtifactRepository {
  async replaceForScan(
    scanId: string,
    artifacts: ScanArtifactSet
  ): Promise<void> {
    await ensureArtifactStorage();

    await Promise.all([
      fs.writeFile(
        path.join(
          artifactStorageDirectory,
          `${scanId}.findings.json`
        ),
        JSON.stringify(
          artifacts.findings,
          null,
          2
        ),
        "utf8"
      ),
      fs.writeFile(
        path.join(
          artifactStorageDirectory,
          `${scanId}.ai-analyses.json`
        ),
        JSON.stringify(
          artifacts.aiAnalyses,
          null,
          2
        ),
        "utf8"
      ),
      fs.writeFile(
        path.join(
          artifactStorageDirectory,
          `${scanId}.fix-suggestions.json`
        ),
        JSON.stringify(
          artifacts.fixes,
          null,
          2
        ),
        "utf8"
      )
    ]);
  }
}

async function getScanRepository(): Promise<ScanRepository> {
  if (
    scanRepository
  ) {
    return scanRepository;
  }

  const mongoConfig =
    readMongoDatabaseConfigFromEnv();

  if (
    mongoConfig
  ) {
    const database =
      await getMongoDatabase(
        mongoConfig
      );

    scanRepository =
      new MongoScanRepository(
        database
      );

    return scanRepository;
  }

  scanRepository =
    new FileScanRepository();

  return scanRepository;
}

async function getProjectRepository(): Promise<ProjectRepository> {
  if (
    projectRepository
  ) {
    return projectRepository;
  }

  const mongoConfig =
    readMongoDatabaseConfigFromEnv();

  if (
    mongoConfig
  ) {
    const database =
      await getMongoDatabase(
        mongoConfig
      );

    projectRepository =
      new MongoProjectRepository(
        database
      );

    return projectRepository;
  }

  projectRepository =
    new FileProjectRepository();

  return projectRepository;
}

async function getArtifactRepository(): Promise<ScanArtifactRepository> {
  if (
    artifactRepository
  ) {
    return artifactRepository;
  }

  const mongoConfig =
    readMongoDatabaseConfigFromEnv();

  if (
    mongoConfig
  ) {
    const database =
      await getMongoDatabase(
        mongoConfig
      );

    artifactRepository =
      new MongoScanArtifactRepository(
        database
      );

    return artifactRepository;
  }

  artifactRepository =
    new FileScanArtifactRepository();

  return artifactRepository;
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(
    status,
    {
      "content-type":
        "application/json; charset=utf-8",
      "access-control-allow-origin":
        "*",
      "access-control-allow-methods":
        "GET,POST,OPTIONS",
      "access-control-allow-headers":
        "authorization,content-type,x-codesentinel-filename,x-codesentinel-project-name,x-codesentinel-team"
    }
  );

  response.end(
    body === null
      ? undefined
      : JSON.stringify(
          body,
          null,
          2
        )
  );
}

async function readRequestBody(
  request: http.IncomingMessage
): Promise<string> {
  return (
    await readRequestBuffer(
      request
    )
  ).toString("utf8");
}

async function readRequestBuffer(
  request: http.IncomingMessage
): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (
    const chunk
    of request
  ) {
    chunks.push(
      Buffer.isBuffer(
        chunk
      )
        ? chunk
        : Buffer.from(
            chunk
          )
    );
  }

  return Buffer
    .concat(
      chunks
    );
}

async function readJsonRequest<T>(
  request: http.IncomingMessage
): Promise<T> {
  const body =
    await readRequestBody(
      request
    );

  if (
    body.trim().length === 0
  ) {
    return {} as T;
  }

  return JSON.parse(
    body
  ) as T;
}

function getHeaderValue(
  request: http.IncomingMessage,
  name: string
): string | undefined {
  const value =
    request.headers[name.toLowerCase()];

  return Array.isArray(
    value
  )
    ? value[0]
    : value;
}

function sanitizeUploadName(
  value: string | undefined
): string {
  const baseName =
    path.basename(
      value ?? "uploaded-project.zip"
    );

  return baseName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(
      0,
      80
    ) || "uploaded-project.zip";
}

function sanitizeProjectDirectoryName(
  value: string | undefined
): string {
  return sanitizeUploadName(
    value ?? "uploaded-project"
  )
    .replace(/\.zip$/i, "")
    .slice(
      0,
      64
    ) || "uploaded-project";
}

function sanitizeRelativeUploadPath(
  value: string
): string {
  const segments =
    value
      .replace(/\\/g, "/")
      .split("/")
      .map(
        segment =>
          segment
            .trim()
            .replace(/[^a-zA-Z0-9._ -]+/g, "-")
            .replace(/^-+|-+$/g, "")
      )
      .filter(
        segment =>
          segment.length > 0 &&
          segment !== "." &&
          segment !== ".."
      );

  return segments.join(
    path.sep
  );
}

interface GithubRepositoryTarget {
  normalizedUrl: string;
  owner: string;
  repo: string;
}

type GithubRepositoryValidation =
  | { ok: true; target: GithubRepositoryTarget }
  | { ok: false; error: string };

const githubRepositoryPathPattern =
  /^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38})?)\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/;

export function validateGithubRepositoryUrl(
  rawValue: string | undefined
): GithubRepositoryValidation {
  if (
    typeof rawValue !== "string" ||
    rawValue.trim().length === 0
  ) {
    return {
      ok: false,
      error: "repositoryUrl is required"
    };
  }

  if (
    rawValue.length > 512 ||
    /[\s\x00-\x1f]/.test(rawValue)
  ) {
    return {
      ok: false,
      error: "repositoryUrl is invalid"
    };
  }

  let url: URL;

  try {
    url = new URL(rawValue);
  } catch {
    return {
      ok: false,
      error: "repositoryUrl is not a valid URL"
    };
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return {
      ok: false,
      error: "repositoryUrl must be a plain https://github.com/<owner>/<repo> URL"
    };
  }

  const match =
    githubRepositoryPathPattern.exec(
      url.pathname
    );

  if (
    !match
  ) {
    return {
      ok: false,
      error: "repositoryUrl must point to a GitHub owner/repo path"
    };
  }

  const [, owner, repo] = match;

  return {
    ok: true,
    target: {
      normalizedUrl: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo
    }
  };
}

export function sanitizeGitRef(
  value: string | undefined
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const trimmed =
    value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > 200 ||
    trimmed.startsWith("-") ||
    trimmed.includes("..") ||
    !/^[A-Za-z0-9._/-]+$/.test(trimmed)
  ) {
    return undefined;
  }

  return trimmed;
}

function isZipBuffer(
  body: Buffer
): boolean {
  return (
    body.length >= 4 &&
    body[0] === 0x50 &&
    body[1] === 0x4b
  );
}

function parseMultipartFileUploads(
  body: Buffer,
  contentType: string | undefined
): UploadedFilePart[] {
  const boundaryMatch =
    contentType?.match(
      /boundary=(?:"([^"]+)"|([^;]+))/i
    );

  const boundary =
    boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (
    !boundary
  ) {
    throw new Error(
      "Missing multipart boundary"
    );
  }

  const raw =
    body.toString(
      "latin1"
    );

  const boundaryText =
    `--${boundary}`;

  const parts =
    raw
      .split(
        boundaryText
      )
      .slice(
        1,
        -1
      );

  const files: UploadedFilePart[] = [];

  for (
    const rawPart
    of parts
  ) {
    const part =
      rawPart.replace(
        /^\r?\n/,
        ""
      );

    const separatorIndex =
      part.indexOf(
        "\r\n\r\n"
      );

    if (
      separatorIndex === -1
    ) {
      continue;
    }

    const headerText =
      part.slice(
        0,
        separatorIndex
      );

    let content =
      part.slice(
        separatorIndex + 4
      );

    content =
      content.replace(
        /\r?\n$/,
        ""
      );

    const headers =
      Object.fromEntries(
        headerText
          .split(
            /\r?\n/
          )
          .map(
            line => {
              const index =
                line.indexOf(
                  ":"
                );

              return index === -1
                ? [
                    line.toLowerCase(),
                    ""
                  ]
                : [
                    line
                      .slice(
                        0,
                        index
                      )
                      .trim()
                      .toLowerCase(),
                    line
                      .slice(
                        index + 1
                      )
                      .trim()
                  ];
            }
          )
      );

    const disposition =
      headers["content-disposition"] ?? "";

    const nameMatch =
      disposition.match(
        /name="([^"]+)"/i
      );

    const fileNameMatch =
      disposition.match(
        /filename="([^"]*)"/i
      );

    const fileName =
      fileNameMatch?.[1];

    if (
      !fileName
    ) {
      continue;
    }

    files.push({
      fieldName:
        nameMatch?.[1] ?? "files",
      fileName,
      body:
        Buffer.from(
          content,
          "latin1"
        )
    });
  }

  return files;
}

function runProcess(
  command: string,
  args: string[]
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const child =
        spawn(
          command,
          args,
          {
            windowsHide:
              true,
            stdio:
              [
                "ignore",
                "ignore",
                "pipe"
              ]
          }
        );

      let stderr =
        "";

      child.stderr?.on(
        "data",
        data => {
          stderr +=
            data.toString();
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        exitCode => {
          if (
            exitCode === 0
          ) {
            resolve();
            return;
          }

          reject(
            new Error(
              stderr.trim() || `${command} exited with code ${exitCode}`
            )
          );
        }
      );
    }
  );
}

async function extractZipArchive(
  zipPath: string,
  destinationPath: string
): Promise<void> {
  await fs.mkdir(
    destinationPath,
    {
      recursive:
        true
    }
  );

  if (
    process.platform === "win32"
  ) {
    await runProcess(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "& { param($archivePath, $destinationPath) Expand-Archive -LiteralPath $archivePath -DestinationPath $destinationPath -Force }",
        zipPath,
        destinationPath
      ]
    );
    return;
  }

  await runProcess(
    "unzip",
    [
      "-q",
      zipPath,
      "-d",
      destinationPath
    ]
  );
}

const githubCloneTimeoutMs = 120_000;
const githubCloneKillGraceMs = 5_000;

function cloneGithubRepository(
  cloneUrl: string,
  ref: string | undefined,
  destinationPath: string
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      const args = [
        "clone",
        "--depth",
        "1",
        ...(ref ? ["--branch", ref] : []),
        "--single-branch",
        cloneUrl,
        destinationPath
      ];

      const child = spawn(
        "git",
        args,
        {
          windowsHide: true,
          stdio: ["ignore", "ignore", "pipe"],
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0"
          }
        }
      );

      let stderr = "";
      let settled = false;

      const timeoutHandle = setTimeout(
        () => {
          child.kill("SIGTERM");

          setTimeout(
            () => {
              if (!settled) {
                child.kill("SIGKILL");
              }
            },
            githubCloneKillGraceMs
          );

          if (!settled) {
            settled = true;
            reject(
              new Error(
                `git clone timed out after ${githubCloneTimeoutMs / 1000}s`
              )
            );
          }
        },
        githubCloneTimeoutMs
      );

      child.stderr?.on(
        "data",
        data => {
          stderr += data.toString();
        }
      );

      child.on(
        "error",
        error => {
          clearTimeout(timeoutHandle);

          if (settled) {
            return;
          }

          settled = true;

          const message =
            (error as NodeJS.ErrnoException).code === "ENOENT"
              ? "git is not installed or not available on PATH"
              : error.message;

          reject(new Error(message));
        }
      );

      child.on(
        "close",
        exitCode => {
          clearTimeout(timeoutHandle);

          if (settled) {
            return;
          }

          settled = true;

          if (exitCode === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              stderr.trim() || `git clone exited with code ${exitCode}`
            )
          );
        }
      );
    }
  );
}

async function hasProjectMarker(
  directoryPath: string
): Promise<boolean> {
  const markers = [
    "package.json",
    "pyproject.toml",
    "pom.xml",
    "build.gradle",
    "go.mod",
    "Cargo.toml"
  ];

  for (
    const marker
    of markers
  ) {
    if (
      fsSync.existsSync(
        path.join(
          directoryPath,
          marker
        )
      )
    ) {
      return true;
    }
  }

  return false;
}

async function findUploadedProjectRoot(
  extractedPath: string
): Promise<string> {
  if (
    await hasProjectMarker(
      extractedPath
    )
  ) {
    return extractedPath;
  }

  const entries =
    await fs.readdir(
      extractedPath,
      {
        withFileTypes:
          true
      }
    );

  const directories =
    entries.filter(
      entry => entry.isDirectory()
    );

  for (
    const directory
    of directories
  ) {
    const candidate =
      path.join(
        extractedPath,
        directory.name
      );

    if (
      await hasProjectMarker(
        candidate
      )
    ) {
      return candidate;
    }
  }

  if (
    directories.length === 1
  ) {
    return path.join(
      extractedPath,
      directories[0].name
    );
  }

  return extractedPath;
}

async function createUploadedProjectWorkspace(
  body: Buffer,
  fileName: string | undefined
): Promise<string> {
  await fs.mkdir(
    uploadStorageDirectory,
    {
      recursive:
        true
    }
  );

  const uploadId =
    createUploadId();

  const uploadDirectory =
    path.join(
      uploadStorageDirectory,
      uploadId
    );

  const workspaceDirectory =
    path.join(
      uploadDirectory,
      "workspace"
    );

  await fs.mkdir(
    uploadDirectory,
    {
      recursive:
        true
    }
  );

  const archivePath =
    path.join(
      uploadDirectory,
      sanitizeUploadName(
        fileName
      )
    );

  await fs.writeFile(
    archivePath,
    body
  );

  await extractZipArchive(
    archivePath,
    workspaceDirectory
  );

  return findUploadedProjectRoot(
    workspaceDirectory
  );
}

async function createGithubProjectWorkspace(
  repositoryUrl: string,
  ref: string | undefined
): Promise<string> {
  await fs.mkdir(
    uploadStorageDirectory,
    {
      recursive: true
    }
  );

  const uploadId =
    createUploadId();

  const workspaceDirectory =
    path.join(
      uploadStorageDirectory,
      uploadId,
      "workspace"
    );

  await fs.mkdir(
    workspaceDirectory,
    {
      recursive: true
    }
  );

  await cloneGithubRepository(
    repositoryUrl,
    ref,
    workspaceDirectory
  );

  // Unlike a ZIP/file upload, a fresh clone always contains a top-level
  // .git directory. If the repo has no root-level project marker,
  // findUploadedProjectRoot's single-subdirectory fallback would treat
  // .git itself as "the one directory" and misidentify it as the
  // project root, so it is removed before root detection runs.
  await fs.rm(
    path.join(
      workspaceDirectory,
      ".git"
    ),
    {
      recursive: true,
      force: true
    }
  );

  return findUploadedProjectRoot(
    workspaceDirectory
  );
}

async function createUploadedFilesWorkspace(
  files: UploadedFilePart[],
  projectName: string | undefined
): Promise<string> {
  await fs.mkdir(
    uploadStorageDirectory,
    {
      recursive:
        true
    }
  );

  const uploadId =
    createUploadId();

  const projectDirectory =
    path.join(
      uploadStorageDirectory,
      uploadId,
      sanitizeProjectDirectoryName(
        projectName
      )
    );

  await fs.mkdir(
    projectDirectory,
    {
      recursive:
        true
      }
  );

  let savedFiles =
    0;

  for (
    const file
    of files
  ) {
    const relativePath =
      sanitizeRelativeUploadPath(
        file.fileName
      );

    if (
      relativePath.length === 0
    ) {
      continue;
    }

    const targetPath =
      path.resolve(
        projectDirectory,
        relativePath
      );

    const relativeTargetPath =
      path.relative(
        projectDirectory,
        targetPath
      );

    if (
      relativeTargetPath.startsWith("..") ||
      path.isAbsolute(
        relativeTargetPath
      )
    ) {
      continue;
    }

    await fs.mkdir(
      path.dirname(
        targetPath
      ),
      {
        recursive:
          true
      }
    );

    await fs.writeFile(
      targetPath,
      file.body
    );

    savedFiles +=
      1;
  }

  if (
    savedFiles === 0
  ) {
    throw new Error(
      "No upload files were saved"
    );
  }

  return findUploadedProjectRoot(
    projectDirectory
  );
}

function resolveProjectPath(
  requestedPath: string | undefined
): string {
  const projectPath =
    requestedPath ?? ".";

  return path.resolve(
    repositoryRoot,
    projectPath
  );
}

function getTeamId(
  request: http.IncomingMessage
): string | undefined {
  const headerValue =
    request.headers["x-codesentinel-team"];

  const teamId =
    Array.isArray(
      headerValue
    )
      ? headerValue[0]
      : headerValue;

  return teamId ?? process.env.CODESENTINEL_DEFAULT_TEAM_ID;
}

function getExpectedApiToken(): string | undefined {
  const token =
    process.env.CODESENTINEL_API_TOKEN?.trim();

  return token
    ? token
    : undefined;
}

function getRequestBearerToken(
  request: http.IncomingMessage
): string | undefined {
  const authorization =
    request.headers.authorization;

  if (
    !authorization
  ) {
    return undefined;
  }

  const [
    scheme,
    token
  ] = authorization.split(/\s+/, 2);

  return scheme.toLowerCase() === "bearer"
    ? token
    : undefined;
}

function isAuthorized(
  request: http.IncomingMessage
): boolean {
  const expectedToken =
    getExpectedApiToken();

  if (
    !expectedToken
  ) {
    return true;
  }

  return getRequestBearerToken(
    request
  ) === expectedToken;
}

function extractHealthPercent(
  report: unknown
): number | undefined {
  const scan =
    typeof report === "object" &&
    report &&
    "scan" in report
      ? (report as {
          scan?: {
            health?: {
              score?: number;
              maxScore?: number;
            };
          };
        }).scan
      : undefined;

  if (
    !scan?.health?.maxScore
  ) {
    return undefined;
  }

  return Math.round(
    (
      scan.health.score ?? 0
    ) / scan.health.maxScore * 100
  );
}

function asRecord(
  value: unknown
): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

function asArray(
  value: unknown
): unknown[] {
  return Array.isArray(
    value
  )
    ? value
    : [];
}

function asString(
  value: unknown,
  fallback: string
): string {
  return typeof value === "string" && value.trim()
    ? value
    : fallback;
}

function asNumber(
  value: unknown
): number | undefined {
  return typeof value === "number"
    ? value
    : undefined;
}

function getReportScan(
  report: unknown
): Record<string, unknown> | undefined {
  return asRecord(
    asRecord(
      report
    )?.scan
  );
}

function createArtifactId(
  scanId: string,
  type: string,
  index: number
): string {
  return `${scanId}_${type}_${index + 1}`;
}

function createFindingRecord(
  record: ScanRecord,
  value: unknown,
  index: number,
  type: "finding" | "warning"
): FindingRecord {
  const finding =
    asRecord(
      value
    ) ?? {};

  return {
    id:
      asString(
        finding.id,
        createArtifactId(
          record.id,
          type,
          index
        )
      ),
    scanId:
      record.id,
    projectId:
      record.projectId,
    teamId:
      record.teamId,
    type,
    severity:
      asString(
        finding.severity,
        type === "warning"
          ? "medium"
          : "info"
      ),
    category:
      asString(
        finding.category,
        "general"
      ),
    code:
      typeof finding.code === "string"
        ? finding.code
        : undefined,
    title:
      asString(
        finding.title,
        type === "warning"
          ? "Warning"
          : "Finding"
      ),
    message:
      asString(
        finding.message,
        "No message provided"
      ),
    file:
      typeof finding.file === "string"
        ? finding.file
        : undefined,
    line:
      asNumber(
        finding.line
      ),
    column:
      asNumber(
        finding.column
      ),
    createdAt:
      record.updatedAt
  };
}

function createScanArtifacts(
  record: ScanRecord
): ScanArtifactSet {
  const scan =
    getReportScan(
      record.report
    );

  const findings: FindingRecord[] =
    [
      ...asArray(
        scan?.findings
      ).map(
        (
          value,
          index
        ) => createFindingRecord(
          record,
          value,
          index,
          "finding"
        )
      ),
      ...asArray(
        asRecord(
          scan?.validation
        )?.warnings
      ).map(
        (
          value,
          index
        ) => createFindingRecord(
          record,
          value,
          index,
          "warning"
        )
      )
    ];

  const aiRootCause =
    asRecord(
      scan?.aiRootCause
    );

  const aiFixSuggestions =
    asRecord(
      scan?.aiFixSuggestions
    );

  const aiAnalyses: AiAnalysisRecord[] =
    asArray(
      aiRootCause?.analyses
    ).map(
      (
        analysis,
        index
      ) => ({
        id:
          createArtifactId(
            record.id,
            "ai",
            index
          ),
        scanId:
          record.id,
        projectId:
          record.projectId,
        teamId:
          record.teamId,
        analysis,
        createdAt:
          record.updatedAt
      })
    );

  const fixes: FixRecord[] =
    asArray(
      aiFixSuggestions?.suggestions
    ).map(
      (
        suggestion,
        index
      ) => ({
        id:
          createArtifactId(
            record.id,
            "fix",
            index
          ),
        scanId:
          record.id,
        projectId:
          record.projectId,
        teamId:
          record.teamId,
        suggestion,
        createdAt:
          record.updatedAt
      })
    );

  return {
    findings,
    aiAnalyses,
    fixes
  };
}

async function upsertProjectFromPath(
  projectPath: string,
  teamId: string | undefined,
  name: string | undefined,
  group?: {
    groupId: string;
    groupLabel?: string;
  }
): Promise<ProjectRecord> {
  const repository =
    await getProjectRepository();

  const id =
    createProjectId(
      projectPath,
      teamId
    );

  const existing =
    await repository.read(
      id
    );

  const now =
    new Date().toISOString();

  const record: ProjectRecord = {
    ...existing,
    id,
    path:
      projectPath,
    teamId,
    name:
      name ?? existing?.name ?? path.basename(
        projectPath
      ),
    groupId:
      group?.groupId ?? existing?.groupId,
    groupLabel:
      group?.groupLabel ?? existing?.groupLabel,
    createdAt:
      existing?.createdAt ?? now,
    updatedAt:
      now
  };

  await repository.save(
    record
  );

  return record;
}

function getScannerScriptPath(): string {
  return path.join(
    repositoryRoot,
    "apps",
    "scanner",
    "dist",
    "index.js"
  );
}

function extractJsonReport(
  stdout: string
): unknown | undefined {
  const trimmed =
    stdout.trim();

  if (
    trimmed.length === 0
  ) {
    return undefined;
  }

  try {
    return JSON.parse(
      trimmed
    ) as unknown;
  } catch {
    return undefined;
  }
}

async function runScan(
  initialRecord: ScanRecord
): Promise<void> {
  const repository =
    await getScanRepository();

  const runningRecord: ScanRecord = {
    ...initialRecord,
    status:
      "running",
    updatedAt:
      new Date().toISOString()
  };

  await repository.save(
    runningRecord
  );

  const child =
    spawn(
      process.execPath,
      [
        getScannerScriptPath(),
        runningRecord.projectPath,
        "--format",
        "json"
      ],
      {
        cwd:
          repositoryRoot,
        windowsHide:
          true,
        stdio:
          [
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

  child.stdout?.on(
    "data",
    data => {
      stdout +=
        data.toString();
    }
  );

  child.stderr?.on(
    "data",
    data => {
      stderr +=
        data.toString();
    }
  );

  child.on(
    "error",
    async error => {
      await repository.save({
        ...runningRecord,
        status:
          "error",
        updatedAt:
          new Date().toISOString(),
        error:
          error.message,
        stdout,
        stderr
      });
    }
  );

  child.on(
    "close",
    async exitCode => {
      const report =
        extractJsonReport(
          stdout
        );

      const completedRecord: ScanRecord = {
        ...runningRecord,
        status:
          exitCode === 0
            ? "passed"
            : "failed",
        updatedAt:
          new Date().toISOString(),
        exitCode,
        stdout,
        stderr,
        report
      };

      await repository.save(
        completedRecord
      );

      await (
        await getArtifactRepository()
      ).replaceForScan(
        completedRecord.id,
        createScanArtifacts(
          completedRecord
        )
      );

      if (
        completedRecord.projectId
      ) {
        const projects =
          await getProjectRepository();

        const project =
          await projects.read(
            completedRecord.projectId
          );

        if (
          project
        ) {
          await projects.save({
            ...project,
            lastScanId:
              completedRecord.id,
            lastStatus:
              completedRecord.status,
            lastHealthScore:
              extractHealthPercent(
                report
              ),
            updatedAt:
              completedRecord.updatedAt
          });
        }
      }
    }
  );
}

async function createScan(
  request: http.IncomingMessage
): Promise<ApiResponse> {
  const body =
    await readJsonRequest<CreateScanRequest>(
      request
    );

  return createScanFromBody(
    request,
    body
  );
}

async function createZipUploadScan(
  request: http.IncomingMessage
): Promise<ApiResponse> {
  const body =
    await readRequestBuffer(
      request
    );

  if (
    body.length === 0
  ) {
    return {
      status:
        400,
      body:
        {
          error:
            "ZIP upload body is empty"
        }
    };
  }

  if (
    !isZipBuffer(
      body
    )
  ) {
    return {
      status:
        400,
      body:
        {
          error:
            "Uploaded file is not a ZIP archive"
        }
    };
  }

  try {
    const projectPath =
      await createUploadedProjectWorkspace(
        body,
        getHeaderValue(
          request,
          "x-codesentinel-filename"
        )
      );

    return createScanFromBody(
      request,
      {
        projectPath
      }
    );
  } catch (error) {
    return {
      status:
        400,
      body:
        {
          error:
            error instanceof Error
              ? error.message
              : String(
                  error
                )
        }
    };
  }
}

async function createGithubScan(
  request: http.IncomingMessage
): Promise<ApiResponse> {
  const body =
    await readJsonRequest<CreateGithubScanRequest>(
      request
    );

  const validation =
    validateGithubRepositoryUrl(
      body.repositoryUrl
    );

  if (
    !validation.ok
  ) {
    return {
      status: 400,
      body: {
        error: validation.error
      }
    };
  }

  const ref =
    sanitizeGitRef(
      body.ref
    );

  try {
    const projectPath =
      await createGithubProjectWorkspace(
        validation.target.normalizedUrl,
        ref
      );

    return createScanFromBody(
      request,
      {
        projectPath
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return {
      status: 400,
      body: {
        error: message.slice(0, 2000)
      }
    };
  }
}

function sanitizeDisplayLabel(
  value: string | undefined,
  fallback: string
): string {
  const trimmed =
    (value ?? "").trim().slice(0, 80);

  return trimmed.length > 0
    ? trimmed
    : fallback;
}

interface GithubGroupScanOutcome {
  label: string;
  repositoryUrl: string;
  ok: boolean;
  id?: string;
  projectId?: string;
  status?: string;
  projectPath?: string;
  error?: string;
}

async function createGithubGroupScan(
  request: http.IncomingMessage
): Promise<ApiResponse> {
  const body =
    await readJsonRequest<CreateGithubGroupScanRequest>(
      request
    );

  const repositories =
    Array.isArray(body.repositories)
      ? body.repositories
      : [];

  if (
    repositories.length === 0
  ) {
    return {
      status: 400,
      body: {
        error: "repositories must be a non-empty array"
      }
    };
  }

  const validatedRepositories: Array<{
    target: GithubRepositoryTarget;
    ref: string | undefined;
    label: string;
  }> = [];

  for (
    let index = 0;
    index < repositories.length;
    index += 1
  ) {
    const entry =
      repositories[index];

    const validation =
      validateGithubRepositoryUrl(
        entry.repositoryUrl
      );

    if (
      !validation.ok
    ) {
      return {
        status: 400,
        body: {
          error: `repositories[${index}]: ${validation.error}`
        }
      };
    }

    validatedRepositories.push({
      target: validation.target,
      ref: sanitizeGitRef(entry.ref),
      label: sanitizeDisplayLabel(
        entry.label,
        validation.target.repo
      )
    });
  }

  const groupId =
    createGroupId();

  const groupLabel =
    sanitizeDisplayLabel(
      body.groupLabel,
      validatedRepositories
        .map(repo => repo.label)
        .join(" + ")
    );

  const outcomes: GithubGroupScanOutcome[] = [];

  for (
    const repo
    of validatedRepositories
  ) {
    try {
      const projectPath =
        await createGithubProjectWorkspace(
          repo.target.normalizedUrl,
          repo.ref
        );

      const scanResponse =
        await createScanFromBody(
          request,
          {
            projectPath,
            name: repo.label,
            groupId,
            groupLabel
          }
        );

      const scanBody =
        scanResponse.body as {
          id?: string;
          projectId?: string;
          status?: string;
          projectPath?: string;
          error?: string;
        };

      outcomes.push({
        label: repo.label,
        repositoryUrl: repo.target.normalizedUrl,
        ok: scanResponse.status < 400,
        id: scanBody.id,
        projectId: scanBody.projectId,
        status: scanBody.status,
        projectPath: scanBody.projectPath,
        error: scanResponse.status >= 400
          ? scanBody.error
          : undefined
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      outcomes.push({
        label: repo.label,
        repositoryUrl: repo.target.normalizedUrl,
        ok: false,
        error: message.slice(0, 2000)
      });
    }
  }

  return {
    status: 202,
    body: {
      groupId,
      groupLabel,
      scans: outcomes
    }
  };
}

async function createFilesUploadScan(
  request: http.IncomingMessage
): Promise<ApiResponse> {
  const body =
    await readRequestBuffer(
      request
    );

  if (
    body.length === 0
  ) {
    return {
      status:
        400,
      body:
        {
          error:
            "Files upload body is empty"
        }
    };
  }

  try {
    const files =
      parseMultipartFileUploads(
        body,
        getHeaderValue(
          request,
          "content-type"
        )
      );

    if (
      files.length === 0
    ) {
      return {
        status:
          400,
        body:
          {
            error:
              "No files found in upload"
          }
      };
    }

    const projectPath =
      await createUploadedFilesWorkspace(
        files,
        getHeaderValue(
          request,
          "x-codesentinel-project-name"
        )
      );

    return createScanFromBody(
      request,
      {
        projectPath
      }
    );
  } catch (error) {
    return {
      status:
        400,
      body:
        {
          error:
            error instanceof Error
              ? error.message
              : String(
                  error
                )
        }
    };
  }
}

async function createScanFromBody(
  request: http.IncomingMessage,
  body: CreateScanRequest
): Promise<ApiResponse> {
  const repository =
    await getScanRepository();

  const requestedProjectPath =
    body.projectId
      ? (
          await (
            await getProjectRepository()
          ).read(
            body.projectId
          )
        )?.path
      : body.projectPath;

  if (
    body.projectId &&
    !requestedProjectPath
  ) {
    return {
      status:
        404,
      body:
        {
          error:
            "Project not found"
        }
    };
  }

  const projectPath =
    resolveProjectPath(
      requestedProjectPath
    );

  const project =
    await upsertProjectFromPath(
      projectPath,
      getTeamId(
        request
      ),
      body.name,
      body.groupId
        ? {
            groupId: body.groupId,
            groupLabel: body.groupLabel
          }
        : undefined
    );

  const record: ScanRecord = {
    id:
      createScanId(),
    status:
      "queued",
    projectId:
      project.id,
    teamId:
      project.teamId,
    projectPath:
      project.path,
    createdAt:
      new Date().toISOString(),
    updatedAt:
      new Date().toISOString()
  };

  await repository.save(
    record
  );

  void runScan(
    record
  );

  return {
    status:
      202,
    body:
      {
        id:
          record.id,
        projectId:
          record.projectId,
        status:
          record.status,
        projectPath:
          record.projectPath
      }
  };
}

function summarizeScanRecord(
  record: ScanRecord
): Omit<ScanRecord, "stdout" | "stderr"> {
  const {
    stdout,
    stderr,
    ...summary
  } = record;

  return summary;
}

async function listScans(): Promise<ApiResponse> {
  const repository =
    await getScanRepository();

  const records =
    await repository.list(
      50
    );

  return {
    status:
      200,
    body:
      {
        scans:
          records.map(
            summarizeScanRecord
          )
      }
  };
}

async function getScan(
  scanId: string
): Promise<ApiResponse> {
  const repository =
    await getScanRepository();

  const record =
    await repository.read(
      scanId
    );

  if (
    !record
  ) {
    return {
      status:
        404,
      body:
        {
          error:
            "Scan not found"
        }
    };
  }

  return {
    status:
      200,
    body:
      summarizeScanRecord(
        record
      )
  };
}

async function getScanFindings(
  scanId: string
): Promise<ApiResponse> {
  const repository =
    await getScanRepository();

  const record =
    await repository.read(
      scanId
    );

  if (
    !record
  ) {
    return {
      status:
        404,
      body:
        {
          error:
            "Scan not found"
        }
    };
  }

  const scan =
    getReportScan(
      record.report
    );

  return {
    status:
      200,
    body:
      {
        scanId,
        findings:
          [
            ...asArray(
              scan?.findings
            ),
            ...asArray(
              asRecord(
                scan?.validation
              )?.warnings
            ).map(
              warning => ({
                ...asRecord(
                  warning
                ),
                type:
                  "warning"
              })
            )
          ]
      }
  };
}

async function getScanReport(
  scanId: string
): Promise<ApiResponse> {
  const repository =
    await getScanRepository();

  const record =
    await repository.read(
      scanId
    );

  if (
    !record
  ) {
    return {
      status:
        404,
      body:
        {
          error:
            "Scan not found"
        }
    };
  }

  return {
    status:
      200,
    body:
      record.report ?? {
        scanId,
        status:
          record.status,
        message:
          "Scan report is not available yet"
      }
  };
}

async function listProjects(): Promise<ApiResponse> {
  const repository =
    await getProjectRepository();

  const projects =
    await repository.list(
      50
    );

  return {
    status:
      200,
    body:
      {
        projects
      }
  };
}

async function createProject(
  request: http.IncomingMessage
): Promise<ApiResponse> {
  const body =
    await readJsonRequest<CreateProjectRequest>(
      request
    );

  const project =
    await upsertProjectFromPath(
      resolveProjectPath(
        body.path
      ),
      getTeamId(
        request
      ),
      body.name
    );

  return {
    status:
      201,
    body:
      project
  };
}

async function getProject(
  projectId: string
): Promise<ApiResponse> {
  const repository =
    await getProjectRepository();

  const project =
    await repository.read(
      projectId
    );

  if (
    !project
  ) {
    return {
      status:
        404,
      body:
        {
          error:
            "Project not found"
        }
    };
  }

  return {
    status:
      200,
    body:
      project
  };
}

async function listProjectScans(
  projectId: string
): Promise<ApiResponse> {
  const project =
    await (
      await getProjectRepository()
    ).read(
      projectId
    );

  if (
    !project
  ) {
    return {
      status:
        404,
      body:
        {
          error:
            "Project not found"
        }
    };
  }

  const scans =
    await (
      await getScanRepository()
    ).listByProject(
      projectId,
      50
    );

  return {
    status:
      200,
    body:
      {
        project,
        scans:
          scans.map(
            summarizeScanRecord
          )
      }
  };
}

function getRouteParts(
  requestUrl: string | undefined
): string[] {
  const url =
    new URL(
      requestUrl ?? "/",
      "http://localhost"
    );

  return url.pathname
    .split("/")
    .filter(
      Boolean
    );
}

export async function handleApiRequest(
  request: http.IncomingMessage
): Promise<ApiResponse> {
  if (
    request.method === "OPTIONS"
  ) {
    return {
      status:
        204,
      body:
        null
    };
  }

  if (
    !isAuthorized(
      request
    )
  ) {
    return {
      status:
        401,
      body:
        {
          error:
            "Unauthorized"
        }
    };
  }

  const parts =
    getRouteParts(
      request.url
    );

  if (
    request.method === "GET" &&
    parts.length === 0
  ) {
    return {
      status:
        200,
      body:
        {
          name:
            "CodeSentinel API",
          status:
            "ok",
          endpoints:
            [
              "GET /projects",
              "POST /projects",
              "GET /projects/:id",
              "GET /projects/:id/scans",
              "POST /scans",
              "POST /uploads/files",
              "POST /uploads/zip",
              "POST /scans/github",
              "POST /scans/github/group",
              "GET /scans",
              "GET /scans/:id",
              "GET /scans/:id/findings",
              "GET /scans/:id/report"
            ]
        }
    };
  }

  if (
    request.method === "GET" &&
    parts[0] === "projects" &&
    parts.length === 1
  ) {
    return listProjects();
  }

  if (
    request.method === "POST" &&
    parts[0] === "projects" &&
    parts.length === 1
  ) {
    return createProject(
      request
    );
  }

  if (
    request.method === "GET" &&
    parts[0] === "projects" &&
    parts[1] &&
    parts.length === 2
  ) {
    return getProject(
      parts[1]
    );
  }

  if (
    request.method === "GET" &&
    parts[0] === "projects" &&
    parts[1] &&
    parts[2] === "scans"
  ) {
    return listProjectScans(
      parts[1]
    );
  }

  if (
    request.method === "POST" &&
    parts[0] === "projects" &&
    parts[1] &&
    parts[2] === "scans"
  ) {
    const body =
      await readJsonRequest<Omit<CreateScanRequest, "projectId">>(
        request
      );

    return createScanFromBody(
      request,
      {
        ...body,
        projectId:
          parts[1]
      }
    );
  }

  if (
    request.method === "GET" &&
    parts[0] === "scans" &&
    parts.length === 1
  ) {
    return listScans();
  }

  if (
    request.method === "POST" &&
    parts[0] === "uploads" &&
    parts[1] === "files" &&
    parts.length === 2
  ) {
    return createFilesUploadScan(
      request
    );
  }

  if (
    request.method === "POST" &&
    parts[0] === "uploads" &&
    parts[1] === "zip" &&
    parts.length === 2
  ) {
    return createZipUploadScan(
      request
    );
  }

  if (
    request.method === "POST" &&
    parts[0] === "scans" &&
    parts[1] === "github" &&
    parts[2] === "group" &&
    parts.length === 3
  ) {
    return createGithubGroupScan(
      request
    );
  }

  if (
    request.method === "POST" &&
    parts[0] === "scans" &&
    parts[1] === "github" &&
    parts.length === 2
  ) {
    return createGithubScan(
      request
    );
  }

  if (
    request.method === "POST" &&
    parts[0] === "scans" &&
    parts.length === 1
  ) {
    return createScan(
      request
    );
  }

  if (
    request.method === "GET" &&
    parts[0] === "scans" &&
    parts[1] &&
    parts.length === 2
  ) {
    return getScan(
      parts[1]
    );
  }

  if (
    request.method === "GET" &&
    parts[0] === "scans" &&
    parts[1] &&
    parts[2] === "findings"
  ) {
    return getScanFindings(
      parts[1]
    );
  }

  if (
    request.method === "GET" &&
    parts[0] === "scans" &&
    parts[1] &&
    parts[2] === "report"
  ) {
    return getScanReport(
      parts[1]
    );
  }

  return {
    status:
      404,
    body:
      {
        error:
          "Route not found"
      }
  };
}

export function createApiServer(): http.Server {
  return http.createServer(
    async (
      request,
      response
    ) => {
      try {
        const result =
          await handleApiRequest(
            request
          );

        sendJson(
          response,
          result.status,
          result.body
        );
      } catch (error) {
        sendJson(
          response,
          500,
          {
            error:
              error instanceof Error
                ? error.message
                : "Unknown API error"
          }
        );
      }
    }
  );
}

async function ensureRepositoryIndexes(
  repository: unknown
): Promise<void> {
  if (
    repository &&
    typeof repository === "object" &&
    "ensureIndexes" in repository &&
    typeof repository.ensureIndexes === "function"
  ) {
    await repository.ensureIndexes();
  }
}

export async function initializeApiStorage(): Promise<void> {
  await Promise.all([
    ensureRepositoryIndexes(
      await getScanRepository()
    ),
    ensureRepositoryIndexes(
      await getProjectRepository()
    ),
    ensureRepositoryIndexes(
      await getArtifactRepository()
    )
  ]);
}

const shouldStartServer =
  process.argv[1] &&
  path.resolve(
    process.argv[1]
  ) === path.resolve(
    apiSourceFile
  );

if (
  shouldStartServer
) {
  const port =
    Number(
      process.env.PORT ?? 4317
    );

  await initializeApiStorage();

  createApiServer()
    .listen(
      port,
      () => {
        console.log(
          `CodeSentinel API listening on http://localhost:${port}`
        );
      }
    )
    .on(
      "error",
      error => {
        if (
          "code" in error &&
          error.code === "EADDRINUSE"
        ) {
          console.error(
            `Port ${port} is already in use. Stop the old API process or set PORT to another value.`
          );
        }

        throw error;
      }
    );
}

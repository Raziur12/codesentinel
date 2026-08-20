import { spawn } from "node:child_process";
import http from "node:http";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getMongoDatabase,
  MongoProjectRepository,
  MongoScanRepository,
  readMongoDatabaseConfigFromEnv
} from "@codesentinel/database";

import type {
  ProjectRecord,
  ProjectRepository,
  ScanRecord,
  ScanRepository
} from "@codesentinel/database";

interface CreateScanRequest {
  projectId?: string;
  projectPath?: string;
}

interface CreateProjectRequest {
  name?: string;
  path?: string;
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

let scanRepository:
  ScanRepository |
  undefined;

let projectRepository:
  ProjectRepository |
  undefined;

function createScanId(): string {
  return `scan_${Date.now().toString(36)}_${Math.random()
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

  const hash =
    Buffer.from(
      `${teamId ?? "default"}:${projectPath}`
    )
      .toString("base64url")
      .slice(
        0,
        12
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
        "authorization,content-type,x-codesentinel-team"
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
    )
    .toString("utf8");
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

async function upsertProjectFromPath(
  projectPath: string,
  teamId: string | undefined,
  name: string | undefined
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
      undefined
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
    typeof record.report === "object" &&
    record.report &&
    "scan" in record.report
      ? (record.report as {
          scan?: {
            findings?: unknown;
          };
        }).scan
      : undefined;

  return {
    status:
      200,
    body:
      {
        scanId,
        findings:
          scan?.findings ?? []
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

  createApiServer().listen(
    port,
    () => {
      console.log(
        `CodeSentinel API listening on http://localhost:${port}`
      );
    }
  );
}

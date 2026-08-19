import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface CreateScanRequest {
  projectPath?: string;
}

interface ScanRecord {
  id: string;
  status: "queued" | "running" | "passed" | "failed" | "error";
  projectPath: string;
  createdAt: string;
  updatedAt: string;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  report?: unknown;
  error?: string;
}

interface ApiResponse {
  status: number;
  body: unknown;
}

const apiSourceFile =
  fileURLToPath(
    import.meta.url
  );

const repositoryRoot =
  process.env.CODESENTINEL_ROOT ??
  path.resolve(
    path.dirname(
      apiSourceFile
    ),
    "..",
    "..",
    ".."
  );

const storageDirectory =
  path.join(
    repositoryRoot,
    ".codesentinel-api",
    "scans"
  );

function createScanId(): string {
  return `scan_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
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

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(
    status,
    {
      "content-type":
        "application/json; charset=utf-8"
    }
  );

  response.end(
    JSON.stringify(
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
  const runningRecord: ScanRecord = {
    ...initialRecord,
    status:
      "running",
    updatedAt:
      new Date().toISOString()
  };

  await saveScanRecord(
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
      await saveScanRecord({
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

      await saveScanRecord({
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
      });
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

  const record: ScanRecord = {
    id:
      createScanId(),
    status:
      "queued",
    projectPath:
      resolveProjectPath(
        body.projectPath
      ),
    createdAt:
      new Date().toISOString(),
    updatedAt:
      new Date().toISOString()
  };

  await saveScanRecord(
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
        status:
          record.status,
        projectPath:
          record.projectPath
      }
  };
}

async function getScan(
  scanId: string
): Promise<ApiResponse> {
  const record =
    await readScanRecord(
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

  const {
    stdout,
    stderr,
    ...summary
  } = record;

  return {
    status:
      200,
    body:
      summary
  };
}

async function getScanFindings(
  scanId: string
): Promise<ApiResponse> {
  const record =
    await readScanRecord(
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
  const record =
    await readScanRecord(
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
              "POST /scans",
              "GET /scans/:id",
              "GET /scans/:id/findings",
              "GET /scans/:id/report"
            ]
        }
    };
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

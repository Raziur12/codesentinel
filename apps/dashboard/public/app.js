const defaultApiUrl = "http://localhost:4317";

function normalizeApiUrl(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : defaultApiUrl;
}

const state = {
  apiUrl: normalizeApiUrl(localStorage.getItem("codesentinel.apiUrl")),
  apiToken: localStorage.getItem("codesentinel.apiToken") ?? "",
  projects: JSON.parse(localStorage.getItem("codesentinel.projects") ?? "[]"),
  scans: JSON.parse(localStorage.getItem("codesentinel.scans") ?? "[]"),
  selectedProjectId: localStorage.getItem("codesentinel.selectedProjectId") ?? "",
  selectedScanId: localStorage.getItem("codesentinel.selectedScanId")
};

const elements = {
  apiUrl: document.querySelector("#api-url"),
  apiToken: document.querySelector("#api-token"),
  projectPath: document.querySelector("#project-path"),
  githubRepoList: document.querySelector("#github-repo-list"),
  addGithubRepo: document.querySelector("#add-github-repo"),
  linkedProjects: document.querySelector("#linked-projects"),
  projectFiles: document.querySelector("#project-files"),
  projectFilesName: document.querySelector("#project-files-name"),
  uploadFiles: document.querySelector("#upload-files"),
  zipFile: document.querySelector("#zip-file"),
  zipFileName: document.querySelector("#zip-file-name"),
  uploadZip: document.querySelector("#upload-zip"),
  runScan: document.querySelector("#run-scan"),
  form: document.querySelector("#scan-form"),
  connectionStatus: document.querySelector("#connection-status"),
  connectionHelp: document.querySelector("#connection-help"),
  factorDrawer: document.querySelector("#factor-drawer"),
  factorDrawerScrim: document.querySelector("#factor-drawer-scrim"),
  factorDrawerTitle: document.querySelector("#factor-drawer-title"),
  factorDrawerSubtitle: document.querySelector("#factor-drawer-subtitle"),
  factorDrawerClose: document.querySelector("#factor-drawer-close"),
  factorDrawerBody: document.querySelector("#factor-drawer-body"),
  projectCount: document.querySelector("#project-count"),
  projectsLabel: document.querySelector("#projects-label"),
  projectList: document.querySelector("#project-list"),
  scanCount: document.querySelector("#scan-count"),
  scanList: document.querySelector("#scan-list"),
  refreshScan: document.querySelector("#refresh-scan"),
  healthScore: document.querySelector("#health-score"),
  healthNote: document.querySelector("#health-note"),
  validationStatus: document.querySelector("#validation-status"),
  findingCount: document.querySelector("#finding-count"),
  projectLabel: document.querySelector("#project-label"),
  scanProgress: document.querySelector("#scan-progress"),
  factorGrid: document.querySelector("#factor-grid"),
  technologyStack: document.querySelector("#technology-stack"),
  severityDistribution: document.querySelector("#severity-distribution"),
  findingsLabel: document.querySelector("#findings-label"),
  findingsList: document.querySelector("#findings-list"),
  aiLabel: document.querySelector("#ai-label"),
  aiList: document.querySelector("#ai-list"),
  fixList: document.querySelector("#fix-list"),
  featuresLabel: document.querySelector("#features-label"),
  coreFeatures: document.querySelector("#core-features"),
  trendsLabel: document.querySelector("#trends-label"),
  trendList: document.querySelector("#trend-list")
};

elements.apiUrl.value = state.apiUrl;
elements.apiToken.value = state.apiToken;

function saveState() {
  state.apiUrl = normalizeApiUrl(state.apiUrl);
  elements.apiUrl.value = state.apiUrl;
  localStorage.setItem("codesentinel.apiUrl", state.apiUrl);
  localStorage.setItem("codesentinel.apiToken", state.apiToken);
  localStorage.setItem("codesentinel.projects", JSON.stringify(state.projects));
  localStorage.setItem("codesentinel.scans", JSON.stringify(state.scans));

  if (state.selectedProjectId) {
    localStorage.setItem("codesentinel.selectedProjectId", state.selectedProjectId);
  } else {
    localStorage.removeItem("codesentinel.selectedProjectId");
  }

  if (state.selectedScanId) {
    localStorage.setItem("codesentinel.selectedScanId", state.selectedScanId);
  } else {
    localStorage.removeItem("codesentinel.selectedScanId");
  }
}

function endpoint(path) {
  return `${normalizeApiUrl(state.apiUrl).replace(/\/$/, "")}${path}`;
}

function html(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function fetchJson(path, options) {
  let response;
  const headers = {
    ...(options?.headers ?? {})
  };

  if (state.apiToken.trim()) {
    headers.authorization = `Bearer ${state.apiToken.trim()}`;
  }

  try {
    response = await fetch(endpoint(path), {
      ...options,
      headers
    });
  } catch {
    throw new Error("API offline. Start backend with npm run api.");
  }

  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("API URL is not returning JSON. Use http://localhost:4317 and start npm run api.");
  }

  if (!response.ok) {
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  return body;
}

function setConnection(text, ok = true) {
  elements.connectionStatus.textContent = text;
  elements.connectionStatus.style.color = ok ? "#0f9f6e" : "#dc2626";
  elements.connectionStatus.dataset.status = ok ? "ok" : "error";
  elements.connectionHelp.classList.toggle("hidden", ok);
}

async function checkApi() {
  try {
    const body = await fetchJson("/");
    setConnection(`${body.name}: ${body.status}`);
    return true;
  } catch (error) {
    setConnection(error.message, false);
    return false;
  }
}

function compactPath(value) {
  if (!value) return "--";
  const parts = value.replace(/\\/g, "/").split("/");
  return parts.slice(-3).join("/");
}

function getScanReport(scan) {
  return scan?.report?.scan;
}

function hasReport(scan) {
  return Boolean(getScanReport(scan));
}

function isScanPending(scan) {
  return ["queued", "running"].includes(scan?.status);
}

function getFindings(scan) {
  return getScanReport(scan)?.findings ?? [];
}

function getWarnings(scan) {
  return getScanReport(scan)?.validation?.warnings ?? [];
}

function getIssues(scan) {
  return [
    ...getFindings(scan).map(item => ({
      ...item,
      type:
        "finding"
    })),
    ...getWarnings(scan).map(item => ({
      ...item,
      type:
        "warning"
    }))
  ];
}

function getHealth(scan) {
  return getScanReport(scan)?.health;
}

function getValidation(scan) {
  return getScanReport(scan)?.summary;
}

function getValidationReport(scan) {
  return getScanReport(scan)?.validation;
}

function getValidationResult(scan, category) {
  return getValidationReport(scan)?.results?.find(result => result.category === category);
}

function getProjects() {
  if (state.projects.length > 0) return state.projects;

  return [...new Map(
    state.scans
      .filter(scan => scan.projectId || scan.projectPath)
      .map(scan => [
        scan.projectId ?? scan.projectPath,
        {
          id: scan.projectId ?? scan.projectPath,
          name: compactPath(scan.projectPath),
          path: scan.projectPath,
          lastStatus: scan.status,
          lastScanId: scan.id
        }
      ])
  ).values()];
}

function severityClass(severity) {
  return String(severity ?? "info").toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function getHealthPercent(scan) {
  const health = getHealth(scan);
  if (!health?.maxScore) return undefined;
  return Math.round((health.score / health.maxScore) * 100);
}

function getHealthNote(scan) {
  const factors = getHealth(scan)?.factors ?? [];
  if (factors.length === 0) return "";

  const weakFactors = factors.filter(factor => factor.status !== "passed");
  if (weakFactors.length === 0) return "All readiness checks passed";

  const labels = weakFactors
    .slice(0, 3)
    .map(factor => `${factor.label}: ${factor.status}`)
    .join(", ");

  return `${weakFactors.length} readiness check(s) reduced score: ${labels}`;
}

function getElapsedSeconds(scan) {
  const start = scan?.createdAt ? Date.parse(scan.createdAt) : undefined;
  const end = scan?.updatedAt && !isScanPending(scan) ? Date.parse(scan.updatedAt) : Date.now();

  if (!start || Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }

  return Math.max(0, Math.round((end - start) / 1000));
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function getScanProgress(scan) {
  if (!scan) {
    return {
      percent: 0,
      label: "No scan selected",
      detail: "Upload files, upload ZIP, or scan a local path."
    };
  }

  if (hasReport(scan)) {
    return {
      percent: 100,
      label: "Report ready",
      detail: "Technology, validation, findings, and health data are available."
    };
  }

  if (scan.status === "queued") {
    return {
      percent: 8,
      label: "Queued",
      detail: "Waiting for scan worker."
    };
  }

  if (scan.status === "running") {
    const elapsed = getElapsedSeconds(scan);
    return {
      percent: Math.min(95, 18 + elapsed * 2),
      label: "Scanning",
      detail: "Analyzing project structure, stack, validation commands, and findings."
    };
  }

  if (scan.status === "failed" || scan.status === "error") {
    return {
      percent: 100,
      label: scan.status,
      detail: scan.error ?? "Scan finished with errors."
    };
  }

  return {
    percent: 0,
    label: scan.status ?? "Unknown",
    detail: "Scan status is pending."
  };
}

function getDisplayStatus(scan) {
  const rawStatus = scan?.status ?? "--";
  if (["queued", "running", "failed", "error"].includes(rawStatus)) {
    return rawStatus;
  }

  if (getIssues(scan).length > 0) {
    return "warning";
  }

  const validation = getValidation(scan);
  if (validation) {
    return validation.passed ? "passed" : "failed";
  }

  return rawStatus;
}

function getFileProjectName(files) {
  const firstFile = files[0];
  const relativePath = firstFile?.webkitRelativePath;
  if (relativePath) {
    return relativePath.split("/")[0];
  }

  const firstName = firstFile?.name ?? "uploaded-project";
  return firstName.replace(/\.[^.]+$/, "") || "uploaded-project";
}

function getVisibleScans() {
  if (!state.selectedProjectId) return state.scans;
  return state.scans.filter(scan => scan.projectId === state.selectedProjectId);
}

function getSelectedProject() {
  return getProjects().find(project => project.id === state.selectedProjectId);
}

function renderProjects() {
  const projects = getProjects();
  const visibleScans = getVisibleScans();
  elements.projectCount.textContent = String(projects.length);
  elements.projectsLabel.textContent = `${projects.length} total`;
  elements.projectList.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `project-row ${state.selectedProjectId ? "" : "active"}`;
  allButton.innerHTML = `
    <strong>All Projects</strong>
    <span>${html(state.scans.length)} scan(s) across ${html(projects.length)} project(s)</span>
  `;
  allButton.addEventListener("click", () => {
    state.selectedProjectId = "";
    state.selectedScanId = state.scans[0]?.id;
    saveState();
    renderAll();
  });
  elements.projectList.append(allButton);

  if (projects.length === 0) {
    elements.projectList.insertAdjacentHTML("beforeend", `<div class="empty">No projects yet</div>`);
    return;
  }

  for (const project of projects) {
    const projectScans = state.scans.filter(scan => scan.projectId === project.id);
    const latestScan = projectScans[0];
    const status = latestScan ? getDisplayStatus(latestScan) : project.lastStatus ?? "ready";
    const row = document.createElement("button");
    row.type = "button";
    row.className = `project-row ${project.id === state.selectedProjectId ? "active" : ""}`;
    row.dataset.status = status;
    row.innerHTML = `
      <span class="scan-row-top">
        <b>${html(status)}</b>
        <small>${html(projectScans.length)} scan(s)</small>
      </span>
      <strong>${html(project.name ?? compactPath(project.path))}</strong>
      ${project.groupId ? `<span class="group-badge">&#128279; ${html(project.groupLabel ?? "linked")}</span>` : ""}
      <span>${html(compactPath(project.path))}</span>
    `;
    row.addEventListener("click", () => {
      state.selectedProjectId = project.id;
      state.selectedScanId = latestScan?.id;
      saveState();
      renderAll();
    });
    elements.projectList.append(row);
  }

  if (visibleScans.length === 0 && state.selectedProjectId) {
    state.selectedScanId = undefined;
  }
}

function renderScans() {
  const visibleScans = getVisibleScans();
  elements.scanCount.textContent = String(visibleScans.length);
  elements.scanList.innerHTML = "";

  if (visibleScans.length === 0) {
    elements.scanList.innerHTML = `<div class="empty">No scans for this project yet</div>`;
    return;
  }

  for (const scan of visibleScans) {
    const status = getDisplayStatus(scan);
    const createdAt = scan.createdAt
      ? new Date(scan.createdAt).toLocaleString()
      : "not started";
    const row = document.createElement("button");
    row.type = "button";
    row.className = `scan-row ${scan.id === state.selectedScanId ? "active" : ""}`;
    row.dataset.status = status;
    row.innerHTML = `
      <span class="scan-row-top">
        <b>${html(status)}</b>
        <small>${html(createdAt)}</small>
      </span>
      <strong>${html(compactPath(scan.projectPath))}</strong>
      <span>${html(scan.id)}</span>
    `;
    row.addEventListener("click", () => {
      state.selectedScanId = scan.id;
      saveState();
      renderAll();
      void refreshSelectedScan();
    });
    elements.scanList.append(row);
  }
}

function renderMetrics(scan) {
  const health = getHealth(scan);
  const issues = getIssues(scan);
  const status = getDisplayStatus(scan);
  const healthPercent = getHealthPercent(scan);

  elements.healthScore.textContent = health ? `${health.score}/${health.maxScore}` : "--";
  elements.healthNote.textContent = health ? getHealthNote(scan) : "";
  elements.validationStatus.textContent = status;
  elements.findingCount.textContent = String(issues.length);
  const selectedProject = getSelectedProject();
  elements.projectLabel.textContent = selectedProject
    ? `${selectedProject.name ?? compactPath(selectedProject.path)} / ${compactPath(scan?.projectPath)}`
    : compactPath(scan?.projectPath);
  elements.healthScore.closest(".metric").dataset.state =
    healthPercent === undefined ? "neutral" : healthPercent >= 80 ? "good" : healthPercent >= 60 ? "warn" : "bad";
  elements.validationStatus.closest(".metric").dataset.state = severityClass(status);
  elements.findingCount.closest(".metric").dataset.state = issues.length === 0 ? "good" : "warn";
}

function renderScanProgress(scan) {
  const progress = getScanProgress(scan);
  const report = getScanReport(scan);
  const elapsed = getElapsedSeconds(scan);
  const filesScanned = report?.filesScanned ?? "--";
  const issueCount = getIssues(scan).length;
  const startedAt = scan?.createdAt ? new Date(scan.createdAt).toLocaleString() : "--";
  const finishedAt = scan?.updatedAt && !isScanPending(scan) ? new Date(scan.updatedAt).toLocaleString() : "--";

  elements.scanProgress.innerHTML = `
    <div class="progress-main">
      <div>
        <strong>${html(progress.label)}</strong>
        <span>${html(progress.detail)}</span>
      </div>
      <b>${html(Math.round(progress.percent))}%</b>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="width:${Math.max(0, Math.min(100, progress.percent))}%"></div>
    </div>
    <div class="record-grid">
      <span><b>Elapsed</b>${html(formatDuration(elapsed))}</span>
      <span><b>Files</b>${html(filesScanned)}</span>
      <span><b>Issues</b>${html(issueCount)}</span>
      <span><b>Started</b>${html(startedAt)}</span>
      <span><b>Finished</b>${html(finishedAt)}</span>
      <span><b>Scan ID</b>${html(scan?.id ?? "--")}</span>
    </div>
  `;
}

function renderFactors(scan) {
  const factors = getHealth(scan)?.factors ?? [];
  elements.factorGrid.innerHTML = "";

  if (isScanPending(scan) && !hasReport(scan)) {
    elements.factorGrid.innerHTML = `<div class="empty">Scan is running. Health data will appear when the report is ready.</div>`;
    return;
  }

  if (factors.length === 0) {
    elements.factorGrid.innerHTML = `<div class="empty">No health data</div>`;
    return;
  }

  for (const factor of factors) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "factor";
    item.dataset.status = factor.status;
    item.innerHTML = `
      <strong>${html(factor.label)}</strong>
      <span>${html(factor.status)} - ${html(factor.score)}/${html(factor.maxScore)}</span>
    `;
    item.addEventListener("click", () => openFactorDrawer(scan, factor));
    elements.factorGrid.append(item);
  }
}

/**
 * Maps a health-factor name to the validation/finding category (or
 * categories) whose findings actually explain it. "configuration" and
 * "architecture" are computed from project structure rather than from
 * validation findings, so they have no matching category here - the
 * drawer falls back to the factor's own evidence text for those.
 */
const factorDrawerCategoryMap = {
  build: ["build"],
  tests: ["test"],
  "type-safety": ["type-check"],
  lint: ["lint"],
  dependencies: ["dependency"],
  security: ["security", "secret"],
  runtime: ["runtime"]
};

function closeFactorDrawer() {
  elements.factorDrawer.classList.add("hidden");
  elements.factorDrawerScrim.classList.add("hidden");
}

function openFactorDrawer(scan, factor) {
  const categories = factorDrawerCategoryMap[factor.name] ?? [];
  const relatedIssues = getIssues(scan).filter(issue => categories.includes(issue.category));
  const validationResult = categories
    .map(category => getValidationResult(scan, category))
    .find(Boolean);

  elements.factorDrawerTitle.textContent = factor.label;
  elements.factorDrawerSubtitle.textContent = `${factor.status} · ${factor.score}/${factor.maxScore}`;

  const metaHtml = validationResult
    ? `
      <div class="factor-drawer-meta">
        <div><span>Command</span><span class="mono">${html(validationResult.command ?? "--")}</span></div>
        <div><span>Exit code</span><span>${html(validationResult.exitCode ?? "--")}</span></div>
        <div><span>Duration</span><span>${html(validationResult.durationMs != null ? `${validationResult.durationMs}ms` : "--")}</span></div>
        ${validationResult.skipReason ? `<div><span>Skip reason</span><span>${html(validationResult.skipReason)}</span></div>` : ""}
      </div>
    `
    : "";

  const tableHtml = relatedIssues.length > 0
    ? `
      <table class="factor-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Reason</th>
            <th>Cause</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          ${relatedIssues.map(issue => `
            <tr>
              <td><strong class="severity-${severityClass(issue.severity)}">${html(issue.severity)}</strong></td>
              <td>
                <strong>${html(issue.title)}</strong>
                <div>${html(issue.message)}</div>
                ${issue.suggestion ? `<div style="color:var(--muted); margin-top:4px;">Fix: ${html(issue.suggestion)}</div>` : ""}
              </td>
              <td class="cause">${html(issue.evidence ?? issue.code ?? "--")}</td>
              <td class="loc">${html(issue.file ? `${issue.file}${issue.line ? `:${issue.line}` : ""}${issue.column ? `:${issue.column}` : ""}` : "--")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `
    : `
      <p style="margin:0; color:var(--muted); font-size:13px;">
        ${categories.length > 0
          ? "No structured findings for this check."
          : "This check is derived from project structure, not from individual findings."}
      </p>
      ${factor.evidence?.length
        ? `<ul class="factor-evidence-list">${factor.evidence.map(line => `<li>${html(line)}</li>`).join("")}</ul>`
        : ""}
    `;

  elements.factorDrawerBody.innerHTML = `
    <div style="font-size:13px; color:var(--muted);">
      ${relatedIssues.length} record(s) found for <b>${html(factor.label)}</b>
    </div>
    ${metaHtml}
    ${tableHtml}
  `;

  elements.factorDrawer.classList.remove("hidden");
  elements.factorDrawerScrim.classList.remove("hidden");
}

elements.factorDrawerClose.addEventListener("click", closeFactorDrawer);
elements.factorDrawerScrim.addEventListener("click", closeFactorDrawer);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeFactorDrawer();
});

function flattenStack(profile) {
  if (!profile) return [];
  return [
    ...(profile.languages ?? []),
    ...(profile.runtimes ?? []),
    ...(profile.frameworks ?? []),
    ...(profile.databases ?? []),
    ...(profile.buildTools ?? []),
    ...(profile.packageManagers ?? []),
    ...(profile.infrastructure ?? [])
  ];
}

function getTechnologyGroups(profile) {
  if (!profile) return [];

  return [
    ["Languages", profile.languages ?? []],
    ["Runtimes", profile.runtimes ?? []],
    ["Frameworks", profile.frameworks ?? []],
    ["Databases", profile.databases ?? []],
    ["Build Tools", profile.buildTools ?? []],
    ["Package Managers", profile.packageManagers ?? []],
    ["Infrastructure", profile.infrastructure ?? []],
    ["Unknown", profile.unknown ?? []]
  ].filter(([, items]) => items.length > 0);
}

function renderTechnology(scan) {
  const profile = getScanReport(scan)?.technologyProfile;
  const groups = getTechnologyGroups(profile);
  elements.technologyStack.innerHTML = "";

  if (isScanPending(scan) && !hasReport(scan)) {
    elements.technologyStack.innerHTML = `<div class="empty">Technology detection is running</div>`;
    return;
  }

  if (groups.length === 0) {
    elements.technologyStack.innerHTML = `<div class="empty">No stack detected</div>`;
    return;
  }

  for (const [label, items] of groups) {
    const group = document.createElement("div");
    group.className = "tech-group";
    group.innerHTML = `<strong>${html(label)}</strong>`;

    const chips = document.createElement("div");
    chips.className = "chips";

    for (const item of items) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.title = item.evidence?.join(", ") ?? "";
      chip.textContent = `${item.name}${item.confidence ? ` ${Math.round(item.confidence * 100)}%` : ""}`;
      chips.append(chip);
    }

    group.append(chips);
    elements.technologyStack.append(group);
  }
}

function renderSeverity(scan) {
  if (isScanPending(scan) && !hasReport(scan)) {
    elements.severityDistribution.innerHTML = `<div class="empty">Severity will appear after scan completion</div>`;
    return;
  }

  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };

  for (const issue of getIssues(scan)) {
    const severity = severityClass(issue.severity);
    if (severity in counts) counts[severity] += 1;
  }

  const max = Math.max(1, ...Object.values(counts));
  elements.severityDistribution.innerHTML = "";

  for (const [severity, count] of Object.entries(counts)) {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span class="severity-${severity}">${severity}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
      <span>${count}</span>
    `;
    elements.severityDistribution.append(row);
  }
}

function renderFindings(scan) {
  const issues = getIssues(scan);
  elements.findingsLabel.textContent = `${issues.length} total`;
  elements.findingsList.innerHTML = "";

  if (isScanPending(scan) && !hasReport(scan)) {
    elements.findingsList.innerHTML = `<div class="empty">Scan is running. Issues will appear when validation finishes.</div>`;
    return;
  }

  if (issues.length === 0) {
    elements.findingsList.innerHTML = `<div class="empty">No findings active</div>`;
    return;
  }

  for (const issue of issues) {
    const item = document.createElement("div");
    item.className = "finding-row";
    item.innerHTML = `
      <strong>${html(issue.title)}</strong>
      <span class="severity-${severityClass(issue.severity)}">${html(issue.type)} - ${html(issue.severity)} - ${html(issue.category)} - ${html(issue.code ?? "no code")}</span>
      <p>${html(issue.message)}</p>
      <span>${html(issue.file ? `${issue.file}:${issue.line ?? ""}:${issue.column ?? ""}` : "No file location")}</span>
    `;
    elements.findingsList.append(item);
  }
}

function renderAi(scan) {
  const report = getScanReport(scan);
  const analyses = report?.aiRootCause?.analyses ?? [];
  const fixes = report?.aiFixSuggestions?.suggestions ?? [];
  const warningCount = getWarnings(scan).length;
  elements.aiLabel.textContent = `${analyses.length} explanation(s)`;
  elements.aiList.innerHTML = "";
  elements.fixList.innerHTML = "";

  if (isScanPending(scan) && !hasReport(scan)) {
    elements.aiList.innerHTML = `<div class="empty">Scan is running. AI analysis starts after validation data is ready.</div>`;
    elements.fixList.innerHTML = `<div class="empty">Fix suggestions will appear after AI analysis</div>`;
    return;
  }

  if (analyses.length === 0) {
    elements.aiList.innerHTML = warningCount > 0
      ? `<div class="empty">No AI active for ${warningCount} warning(s)</div>`
      : `<div class="empty">No AI active</div>`;
  }

  for (const analysis of analyses) {
    const item = document.createElement("div");
    item.className = "ai-row";
    item.innerHTML = `
      <strong>${html(analysis.title)}</strong>
      <span>${html(analysis.rootCause.label)} - ${html(analysis.category)} - ${html(analysis.code ?? "no code")}</span>
      <p>${html(analysis.rootCause.text)}</p>
      <p>${html(analysis.howToFix.text)}</p>
    `;
    elements.aiList.append(item);
  }

  if (fixes.length === 0) {
    elements.fixList.innerHTML = `<div class="empty">No fix suggestions active</div>`;
  }

  for (const fix of fixes) {
    const item = document.createElement("div");
    item.className = "fix-row";
    item.innerHTML = `
      <strong>${html(fix.title)}</strong>
      <span>${html(fix.affectedFiles.join(", ") || "No file")} - no files modified</span>
      <p>${html(fix.suggestedAction)}</p>
    `;
    elements.fixList.append(item);
  }
}

function featureStatus(status, detail) {
  return {
    status,
    detail
  };
}

function getFactorStatus(scan, name) {
  const factor = getHealth(scan)?.factors?.find(item => item.name === name);
  if (!factor) return undefined;
  return featureStatus(factor.status, `${factor.score}/${factor.maxScore}`);
}

function getCommandFeatureStatus(scan, category) {
  const result = getValidationResult(scan, category);
  if (!result) return featureStatus("missing", "No command discovered");
  return featureStatus(result.status, result.command || result.skipReason || result.name);
}

function getCoreFeatures(scan) {
  const report = getScanReport(scan);
  const projectCount = getProjects().length;
  const stack = flattenStack(report?.technologyProfile);
  const issues = getIssues(scan);
  const analyses = report?.aiRootCause?.analyses ?? [];
  const fixes = report?.aiFixSuggestions?.suggestions ?? [];
  const securityReport = report?.securityReport;
  const pending = isScanPending(scan) && !hasReport(scan);

  if (pending) {
    return [
      ["Local Workspace", "running", "Scan worker is processing the selected project"],
      ["Automatic Technology Detection", "running", "Waiting for scanner report"],
      ["Build Validation", "running", "Waiting for validation results"],
      ["Security Analysis", "running", "Waiting for security report"],
      ["Production Readiness Report", "running", "Health score will appear after completion"]
    ].map(([name, status, detail]) => ({ name, status, detail }));
  }

  const build = getCommandFeatureStatus(scan, "build");
  const tests = getCommandFeatureStatus(scan, "test");
  const lint = getCommandFeatureStatus(scan, "lint");
  const typeCheck = getCommandFeatureStatus(scan, "type-check");
  const runtime = getCommandFeatureStatus(scan, "runtime");
  const security = getFactorStatus(scan, "security") ?? featureStatus("missing", "No security factor");

  return [
    {
      name: "Multi Repository Support",
      ...featureStatus(projectCount > 1 ? "active" : "ready", `${projectCount} project record(s)`)
    },
    {
      name: "ZIP Upload",
      ...featureStatus("ready", "Dashboard upload and API ZIP scan endpoint are wired")
    },
    {
      name: "Local Workspace",
      ...featureStatus(scan?.projectPath ? "active" : "ready", compactPath(scan?.projectPath))
    },
    {
      name: "GitHub Integration",
      ...featureStatus("ready", "Repository URL clone and scan is wired via POST /scans/github")
    },
    {
      name: "AI Root Cause Analysis",
      ...featureStatus(analyses.length > 0 || issues.length === 0 ? "active" : "ready", `${analyses.length} explanation(s), ${fixes.length} fix suggestion(s)`)
    },
    {
      name: "Automatic Technology Detection",
      ...featureStatus(stack.length > 0 ? "active" : "missing", `${stack.length} stack signal(s)`)
    },
    {
      name: "Build Validation",
      ...build
    },
    {
      name: "Runtime Validation",
      ...runtime
    },
    {
      name: "Security Analysis",
      ...featureStatus(securityReport ? security.status : "missing", securityReport ? `${securityReport.summary.totalFindings} security finding(s)` : security.detail)
    },
    {
      name: "Performance Analysis",
      ...featureStatus("planned", "Performance checks are not implemented yet")
    },
    {
      name: "Production Readiness Report",
      ...featureStatus(getHealth(scan) ? "active" : "missing", getHealth(scan) ? `${getHealth(scan).score}/${getHealth(scan).maxScore} health score` : "No health report")
    },
    {
      name: "Quality Gates",
      ...featureStatus([build, tests, lint, typeCheck].some(item => item.status === "failed") ? "failed" : issues.length > 0 ? "warning" : "active", `build ${build.status}, test ${tests.status}, lint ${lint.status}, type ${typeCheck.status}, issues ${issues.length}`)
    }
  ];
}

function renderCoreFeatures(scan) {
  const features = getCoreFeatures(scan);
  const done = features.filter(feature => ["active", "ready", "passed"].includes(feature.status)).length;
  elements.featuresLabel.textContent = `${done}/${features.length} ready or active`;
  elements.coreFeatures.innerHTML = "";

  for (const feature of features) {
    const item = document.createElement("div");
    item.className = "feature-card";
    item.dataset.status = feature.status;
    item.innerHTML = `
      <div>
        <strong>${html(feature.name)}</strong>
        <span>${html(feature.detail)}</span>
      </div>
      <b>${html(feature.status)}</b>
    `;
    elements.coreFeatures.append(item);
  }
}

function renderTrends() {
  const scans = [...state.scans]
    .filter(scan => scan.createdAt)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-10);

  elements.trendsLabel.textContent = `${scans.length} recent scan(s)`;
  elements.trendList.innerHTML = "";

  if (scans.length === 0) {
    elements.trendList.innerHTML = `<div class="empty">No trend data yet</div>`;
    return;
  }

  for (const scan of scans) {
    const health = getHealthPercent(scan);
    const issues = getIssues(scan).length;
    const row = document.createElement("div");
    row.className = "trend-row";
    row.innerHTML = `
      <strong>${html(new Date(scan.createdAt).toLocaleDateString())}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${health ?? 0}%"></div></div>
      <span>${html(health === undefined ? getDisplayStatus(scan) : `Health ${health}%`)}<br>${html(issues)} issue(s)</span>
    `;
    elements.trendList.append(row);
  }
}

function getSelectedScan() {
  const visibleScans = getVisibleScans();
  return visibleScans.find(scan => scan.id === state.selectedScanId) ?? visibleScans[0];
}

function renderLinkedProjects() {
  if (!elements.linkedProjects) return;

  const project = getSelectedProject();
  const siblings = project?.groupId
    ? getProjects().filter(item => item.groupId === project.groupId && item.id !== project.id)
    : [];

  if (siblings.length === 0) {
    elements.linkedProjects.innerHTML = "";
    elements.linkedProjects.classList.add("hidden");
    return;
  }

  elements.linkedProjects.classList.remove("hidden");
  elements.linkedProjects.innerHTML = `
    <span>Linked (${html(project.groupLabel ?? "group")}):</span>
    ${siblings
      .map(
        sibling =>
          `<button type="button" class="linked-project-chip" data-project-id="${html(sibling.id)}">${html(
            sibling.name ?? compactPath(sibling.path)
          )}</button>`
      )
      .join("")}
  `;

  elements.linkedProjects.querySelectorAll(".linked-project-chip").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedProjectId = button.dataset.projectId;
      const projectScans = state.scans.filter(scan => scan.projectId === state.selectedProjectId);
      state.selectedScanId = projectScans[0]?.id;
      saveState();
      renderAll();
    });
  });
}

function renderAll() {
  const scan = getSelectedScan();
  if (scan && state.selectedScanId !== scan.id) state.selectedScanId = scan.id;

  renderProjects();
  renderLinkedProjects();
  renderScans();
  renderMetrics(scan);
  renderScanProgress(scan);
  renderFactors(scan);
  renderTechnology(scan);
  renderSeverity(scan);
  renderFindings(scan);
  renderAi(scan);
  renderCoreFeatures(scan);
  renderTrends();
  saveState();
}

async function loadProjects() {
  const body = await fetchJson("/projects");
  state.projects = body.projects ?? [];

  if (
    state.selectedProjectId &&
    !state.projects.some(project => project.id === state.selectedProjectId)
  ) {
    state.selectedProjectId = "";
  }
}

async function loadScans() {
  const body = await fetchJson("/scans");
  state.scans = body.scans ?? [];

  if (
    state.selectedScanId &&
    !state.scans.some(scan => scan.id === state.selectedScanId)
  ) {
    state.selectedScanId = state.scans[0]?.id;
  }

  renderAll();
}

async function refreshSelectedScan() {
  const selected = getSelectedScan();
  if (!selected) {
    await loadScans();
    return;
  }

  const scan = await fetchJson(`/scans/${selected.id}`);
  const index = state.scans.findIndex(item => item.id === selected.id);

  if (index >= 0) {
    state.scans[index] = scan;
  }

  await loadProjects();
  await loadScans();
  renderAll();
}

async function createScan(projectPath) {
  let created;

  try {
    created = await fetchJson("/scans", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ projectPath })
    });
  } catch (error) {
    setConnection(error.message, false);
    return;
  }

  state.scans = [
    created,
    ...state.scans.filter(scan => scan.id !== created.id)
  ].slice(0, 20);
  await loadProjects().catch(() => undefined);
  if (created.projectId) state.selectedProjectId = created.projectId;
  state.selectedScanId = created.id;
  renderAll();

  const interval = window.setInterval(async () => {
    try {
      await refreshSelectedScan();
      const scan = getSelectedScan();
      if (scan && !["queued", "running"].includes(scan.status)) {
        window.clearInterval(interval);
      }
    } catch (error) {
      setConnection(error.message, false);
      window.clearInterval(interval);
    }
  }, 1500);
}

async function createZipUploadScan(file) {
  let created;

  try {
    created = await fetchJson("/uploads/zip", {
      method: "POST",
      headers: {
        "content-type": file.type || "application/zip",
        "x-codesentinel-filename": file.name
      },
      body: file
    });
  } catch (error) {
    setConnection(error.message, false);
    return;
  }

  state.scans = [
    created,
    ...state.scans.filter(scan => scan.id !== created.id)
  ].slice(0, 20);
  await loadProjects().catch(() => undefined);
  if (created.projectId) state.selectedProjectId = created.projectId;
  state.selectedScanId = created.id;
  renderAll();

  const interval = window.setInterval(async () => {
    try {
      await refreshSelectedScan();
      const scan = getSelectedScan();
      if (scan && !["queued", "running"].includes(scan.status)) {
        window.clearInterval(interval);
      }
    } catch (error) {
      setConnection(error.message, false);
      window.clearInterval(interval);
    }
  }, 1500);
}

function setInlineNotice(text, ok = true) {
  elements.connectionStatus.textContent = text;
  elements.connectionStatus.style.color = ok ? "#0f9f6e" : "#dc2626";
  elements.connectionStatus.dataset.status = ok ? "ok" : "error";
}

/**
 * Creates one or more linked GitHub-repo scans in a single request (e.g.
 * a frontend + backend repo that depend on each other). Works for a
 * single repository too, so the dashboard always uses this one path for
 * GitHub scans rather than branching on repository count.
 */
async function createGithubGroupScan(repositories, groupLabel) {
  let response;

  try {
    response = await fetchJson("/scans/github/group", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ repositories, groupLabel })
    });
  } catch (error) {
    setConnection(error.message, false);
    return;
  }

  const outcomes = response.scans ?? [];
  const succeeded = outcomes.filter(item => item.ok && item.id);
  const failed = outcomes.filter(item => !item.ok);

  if (failed.length > 0) {
    setInlineNotice(
      `${failed.length} of ${outcomes.length} linked repositories failed: ` +
        failed.map(item => `${item.label} (${item.error ?? "unknown error"})`).join("; "),
      succeeded.length > 0
    );
  }

  if (succeeded.length === 0) {
    return;
  }

  await loadProjects().catch(() => undefined);
  await loadScans().catch(() => undefined);

  state.selectedProjectId = succeeded[0].projectId;
  state.selectedScanId = succeeded[0].id;
  renderAll();

  const pendingIds = new Set(succeeded.map(item => item.id));

  const interval = window.setInterval(async () => {
    try {
      await loadProjects();
      await loadScans();

      for (const id of Array.from(pendingIds)) {
        const scan = state.scans.find(item => item.id === id);
        if (scan && !["queued", "running"].includes(scan.status)) {
          pendingIds.delete(id);
        }
      }

      if (pendingIds.size === 0) {
        window.clearInterval(interval);
      }
    } catch (error) {
      setConnection(error.message, false);
      window.clearInterval(interval);
    }
  }, 1500);
}

async function createFilesUploadScan(files) {
  let created;
  const formData = new FormData();
  const fileList = Array.from(files);

  for (const file of fileList) {
    formData.append(
      "files",
      file,
      file.webkitRelativePath || file.name
    );
  }

  try {
    created = await fetchJson("/uploads/files", {
      method: "POST",
      headers: {
        "x-codesentinel-project-name": getFileProjectName(fileList)
      },
      body: formData
    });
  } catch (error) {
    setConnection(error.message, false);
    return;
  }

  state.scans = [
    created,
    ...state.scans.filter(scan => scan.id !== created.id)
  ].slice(0, 20);
  await loadProjects().catch(() => undefined);
  if (created.projectId) state.selectedProjectId = created.projectId;
  state.selectedScanId = created.id;
  renderAll();

  const interval = window.setInterval(async () => {
    try {
      await refreshSelectedScan();
      const scan = getSelectedScan();
      if (scan && !["queued", "running"].includes(scan.status)) {
        window.clearInterval(interval);
      }
    } catch (error) {
      setConnection(error.message, false);
      window.clearInterval(interval);
    }
  }, 1500);
}

function syncConnectionInputs() {
  state.apiUrl = normalizeApiUrl(elements.apiUrl.value);
  state.apiToken = elements.apiToken.value.trim();
  saveState();
}

function createGithubRepoRow() {
  const row = document.createElement("div");
  row.className = "github-repo-row";
  row.innerHTML = `
    <input type="text" class="github-repo-label" placeholder="Label (e.g. Frontend)" aria-label="Repository label">
    <input type="url" class="github-repo-url" placeholder="https://github.com/owner/repo" aria-label="Repository URL">
    <button type="button" class="ghost remove-repo-row" aria-label="Remove repository">&times;</button>
  `;

  row.querySelector(".github-repo-url").addEventListener("input", updatePrimaryActionLabel);
  row.querySelector(".remove-repo-row").addEventListener("click", () => {
    row.remove();
    updatePrimaryActionLabel();
  });

  return row;
}

function addGithubRepoRow() {
  const row = createGithubRepoRow();
  elements.githubRepoList.append(row);
  row.querySelector(".github-repo-url").focus();
}

function getGithubRepositories() {
  return Array.from(elements.githubRepoList.querySelectorAll(".github-repo-row"))
    .map(row => ({
      label: row.querySelector(".github-repo-label").value.trim(),
      repositoryUrl: row.querySelector(".github-repo-url").value.trim()
    }))
    .filter(repo => repo.repositoryUrl.length > 0);
}

function startScanFromSelectedSource() {
  const files = elements.projectFiles.files;
  const zipFile = elements.zipFile.files?.[0];
  const githubRepos = getGithubRepositories();

  syncConnectionInputs();

  if (files && files.length > 0) {
    void createFilesUploadScan(files);
    return;
  }

  if (zipFile) {
    void createZipUploadScan(zipFile);
    return;
  }

  if (githubRepos.length > 0) {
    const groupLabel = githubRepos.length > 1
      ? githubRepos.map(repo => repo.label || repo.repositoryUrl).join(" + ")
      : undefined;
    void createGithubGroupScan(githubRepos, groupLabel);
    return;
  }

  void createScan(elements.projectPath.value.trim() || ".");
}

function updatePrimaryActionLabel() {
  const files = elements.projectFiles.files;
  const zipFile = elements.zipFile.files?.[0];
  const githubRepos = getGithubRepositories();

  if (files && files.length > 0) {
    elements.runScan.textContent = "Scan Files";
    return;
  }

  if (zipFile) {
    elements.runScan.textContent = "Scan ZIP";
    return;
  }

  if (githubRepos.length > 1) {
    elements.runScan.textContent = `Scan ${githubRepos.length} Repos`;
    return;
  }

  if (githubRepos.length === 1) {
    elements.runScan.textContent = "Scan GitHub Repo";
    return;
  }

  elements.runScan.textContent = "Run Scan";
}

elements.form.addEventListener("submit", event => {
  event.preventDefault();
  startScanFromSelectedSource();
});

elements.refreshScan.addEventListener("click", () => {
  state.apiUrl = normalizeApiUrl(elements.apiUrl.value);
  state.apiToken = elements.apiToken.value.trim();
  saveState();
  void (async () => {
    await loadProjects();
    await loadScans();
  })().catch(error => setConnection(error.message, false));
});

elements.uploadFiles.addEventListener("click", () => {
  const files = elements.projectFiles.files;
  if (!files || files.length === 0) {
    setConnection("Choose project files before uploading.", false);
    return;
  }

  syncConnectionInputs();
  void createFilesUploadScan(files);
});

elements.uploadZip.addEventListener("click", () => {
  const file = elements.zipFile.files?.[0];
  if (!file) {
    setConnection("Choose a ZIP file before uploading.", false);
    return;
  }

  syncConnectionInputs();
  void createZipUploadScan(file);
});

elements.projectFiles.addEventListener("change", () => {
  const files = elements.projectFiles.files;
  elements.projectFilesName.textContent = files && files.length > 0
    ? `${files.length} file(s) selected`
    : "Choose files";
  updatePrimaryActionLabel();
});

elements.zipFile.addEventListener("change", () => {
  const file = elements.zipFile.files?.[0];
  elements.zipFileName.textContent = file ? file.name : "Choose ZIP";
  updatePrimaryActionLabel();
});

elements.addGithubRepo.addEventListener("click", () => {
  addGithubRepoRow();
  updatePrimaryActionLabel();
});

addGithubRepoRow();

for (const button of document.querySelectorAll(".nav-item")) {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`[data-view-panel="${button.dataset.view}"]`)?.classList.add("active");
  });
}

if (await checkApi()) {
  await (async () => {
    await loadProjects();
    await loadScans();
  })().catch(error => setConnection(error.message, false));
}
renderAll();

const defaultApiUrl = "http://localhost:4317";

function normalizeApiUrl(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : defaultApiUrl;
}

const state = {
  apiUrl: normalizeApiUrl(localStorage.getItem("codesentinel.apiUrl")),
  scans: JSON.parse(localStorage.getItem("codesentinel.scans") ?? "[]"),
  selectedScanId: localStorage.getItem("codesentinel.selectedScanId")
};

const elements = {
  apiUrl: document.querySelector("#api-url"),
  projectPath: document.querySelector("#project-path"),
  form: document.querySelector("#scan-form"),
  connectionStatus: document.querySelector("#connection-status"),
  connectionHelp: document.querySelector("#connection-help"),
  projectCount: document.querySelector("#project-count"),
  scanCount: document.querySelector("#scan-count"),
  scanList: document.querySelector("#scan-list"),
  refreshScan: document.querySelector("#refresh-scan"),
  healthScore: document.querySelector("#health-score"),
  validationStatus: document.querySelector("#validation-status"),
  findingCount: document.querySelector("#finding-count"),
  projectLabel: document.querySelector("#project-label"),
  factorGrid: document.querySelector("#factor-grid"),
  technologyStack: document.querySelector("#technology-stack"),
  severityDistribution: document.querySelector("#severity-distribution"),
  findingsLabel: document.querySelector("#findings-label"),
  findingsList: document.querySelector("#findings-list"),
  aiLabel: document.querySelector("#ai-label"),
  aiList: document.querySelector("#ai-list"),
  fixList: document.querySelector("#fix-list"),
  trendsLabel: document.querySelector("#trends-label"),
  trendList: document.querySelector("#trend-list")
};

elements.apiUrl.value = state.apiUrl;

function saveState() {
  state.apiUrl = normalizeApiUrl(state.apiUrl);
  elements.apiUrl.value = state.apiUrl;
  localStorage.setItem("codesentinel.apiUrl", state.apiUrl);
  localStorage.setItem("codesentinel.scans", JSON.stringify(state.scans));

  if (state.selectedScanId) {
    localStorage.setItem("codesentinel.selectedScanId", state.selectedScanId);
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

  try {
    response = await fetch(endpoint(path), options);
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

function getFindings(scan) {
  return getScanReport(scan)?.findings ?? [];
}

function getHealth(scan) {
  return getScanReport(scan)?.health;
}

function getValidation(scan) {
  return getScanReport(scan)?.summary;
}

function getProjects() {
  return [...new Set(
    state.scans
      .map(scan => scan.projectPath)
      .filter(Boolean)
  )];
}

function severityClass(severity) {
  return String(severity ?? "info").toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function getHealthPercent(scan) {
  const health = getHealth(scan);
  if (!health?.maxScore) return undefined;
  return Math.round((health.score / health.maxScore) * 100);
}

function renderScans() {
  elements.projectCount.textContent = String(getProjects().length);
  elements.scanCount.textContent = String(state.scans.length);
  elements.scanList.innerHTML = "";

  if (state.scans.length === 0) {
    elements.scanList.innerHTML = `<div class="empty">No scans yet</div>`;
    return;
  }

  for (const scan of state.scans) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `scan-row ${scan.id === state.selectedScanId ? "active" : ""}`;
    row.innerHTML = `
      <strong>${html(scan.status ?? "queued")}</strong>
      <span>${html(compactPath(scan.projectPath))}</span>
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
  const validation = getValidation(scan);
  const findings = getFindings(scan);

  elements.healthScore.textContent = health ? `${health.score}/${health.maxScore}` : "--";
  elements.validationStatus.textContent = validation ? (validation.passed ? "passed" : "failed") : scan?.status ?? "--";
  elements.findingCount.textContent = String(findings.length);
  elements.projectLabel.textContent = compactPath(scan?.projectPath);
}

function renderFactors(scan) {
  const factors = getHealth(scan)?.factors ?? [];
  elements.factorGrid.innerHTML = "";

  if (factors.length === 0) {
    elements.factorGrid.innerHTML = `<div class="empty">No health data</div>`;
    return;
  }

  for (const factor of factors) {
    const item = document.createElement("div");
    item.className = "factor";
    item.dataset.status = factor.status;
    item.innerHTML = `
      <strong>${html(factor.label)}</strong>
      <span>${html(factor.status)} - ${html(factor.score)}/${html(factor.maxScore)}</span>
    `;
    elements.factorGrid.append(item);
  }
}

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

function renderTechnology(scan) {
  const stack = flattenStack(getScanReport(scan)?.technologyProfile);
  elements.technologyStack.innerHTML = "";

  if (stack.length === 0) {
    elements.technologyStack.innerHTML = `<div class="empty">No stack detected</div>`;
    return;
  }

  for (const item of stack) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = item.name;
    elements.technologyStack.append(chip);
  }
}

function renderSeverity(scan) {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };

  for (const finding of getFindings(scan)) {
    const severity = severityClass(finding.severity);
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
  const findings = getFindings(scan);
  elements.findingsLabel.textContent = `${findings.length} total`;
  elements.findingsList.innerHTML = "";

  if (findings.length === 0) {
    elements.findingsList.innerHTML = `<div class="empty">No active findings</div>`;
    return;
  }

  for (const finding of findings) {
    const item = document.createElement("div");
    item.className = "finding-row";
    item.innerHTML = `
      <strong>${html(finding.title)}</strong>
      <span class="severity-${severityClass(finding.severity)}">${html(finding.severity)} - ${html(finding.category)} - ${html(finding.code ?? "no code")}</span>
      <p>${html(finding.message)}</p>
      <span>${html(finding.file ? `${finding.file}:${finding.line ?? ""}:${finding.column ?? ""}` : "No file location")}</span>
    `;
    elements.findingsList.append(item);
  }
}

function renderAi(scan) {
  const report = getScanReport(scan);
  const analyses = report?.aiRootCause?.analyses ?? [];
  const fixes = report?.aiFixSuggestions?.suggestions ?? [];
  elements.aiLabel.textContent = `${analyses.length} explanation(s)`;
  elements.aiList.innerHTML = "";
  elements.fixList.innerHTML = "";

  if (analyses.length === 0) {
    elements.aiList.innerHTML = `<div class="empty">No AI explanations</div>`;
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
    elements.fixList.innerHTML = `<div class="empty">No fix suggestions</div>`;
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
    const findings = getFindings(scan).length;
    const row = document.createElement("div");
    row.className = "trend-row";
    row.innerHTML = `
      <strong>${html(new Date(scan.createdAt).toLocaleDateString())}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${health ?? 0}%"></div></div>
      <span>${html(health === undefined ? scan.status : `${health}%`)} / ${html(findings)} finding(s)</span>
    `;
    elements.trendList.append(row);
  }
}

function getSelectedScan() {
  return state.scans.find(scan => scan.id === state.selectedScanId) ?? state.scans[0];
}

function renderAll() {
  const scan = getSelectedScan();
  if (scan && !state.selectedScanId) state.selectedScanId = scan.id;

  renderScans();
  renderMetrics(scan);
  renderFactors(scan);
  renderTechnology(scan);
  renderSeverity(scan);
  renderFindings(scan);
  renderAi(scan);
  renderTrends();
  saveState();
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

elements.form.addEventListener("submit", event => {
  event.preventDefault();
  state.apiUrl = normalizeApiUrl(elements.apiUrl.value);
  saveState();
  void createScan(elements.projectPath.value.trim() || ".");
});

elements.refreshScan.addEventListener("click", () => {
  state.apiUrl = normalizeApiUrl(elements.apiUrl.value);
  saveState();
  void loadScans().catch(error => setConnection(error.message, false));
});

for (const button of document.querySelectorAll(".nav-item")) {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`[data-view-panel="${button.dataset.view}"]`)?.classList.add("active");
  });
}

if (await checkApi()) {
  await loadScans().catch(error => setConnection(error.message, false));
}
renderAll();

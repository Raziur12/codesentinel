const defaultApiUrl = "http://localhost:4317";

function normalizeApiUrl(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : defaultApiUrl;
}

const state = {
  apiUrl: normalizeApiUrl(localStorage.getItem("codesentinel.apiUrl")),
  apiToken: localStorage.getItem("codesentinel.apiToken") ?? "",
  projects: [],
  scans: []
};

const elements = {
  select: document.querySelector("#arch-project-select"),
  connection: document.querySelector("#arch-connection"),
  empty: document.querySelector("#arch-empty"),
  canvas: document.querySelector("#arch-canvas")
};

function endpoint(path) {
  return `${state.apiUrl.replace(/\/$/, "")}${path}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function fetchJson(path) {
  const headers = {};
  if (state.apiToken.trim()) {
    headers.authorization = `Bearer ${state.apiToken.trim()}`;
  }

  const response = await fetch(endpoint(path), { headers });
  if (!response.ok) {
    throw new Error(`${path} responded with ${response.status}`);
  }
  return response.json();
}

function setConnection(text, ok = true) {
  elements.connection.textContent = text;
  elements.connection.style.color = ok ? "#0f9f6e" : "#dc2626";
}

function showEmpty(message) {
  elements.empty.textContent = message;
  elements.empty.classList.remove("hidden");
  elements.canvas.classList.add("hidden");
}

function showCanvas() {
  elements.empty.classList.add("hidden");
  elements.canvas.classList.remove("hidden");
}

/**
 * Category order/keys match TechnologyProfile from packages/scanner-core -
 * see the languages/runtimes/frameworks/databases/buildTools/
 * packageManagers/infrastructure fields on a scan's technologyProfile.
 */
const categoryDefs = [
  ["languages", "language"],
  ["runtimes", "runtime"],
  ["frameworks", "framework"],
  ["databases", "database"],
  ["buildTools", "buildTool"],
  ["packageManagers", "packageManager"],
  ["infrastructure", "infrastructure"]
];

const maxChildrenPerProject = 10;

function buildChildList(profile) {
  if (!profile) return [];

  const list = [];
  for (const [key, category] of categoryDefs) {
    for (const item of profile[key] ?? []) {
      list.push({ label: item.name, category });
    }
  }
  return list.slice(0, maxChildrenPerProject);
}

function monogram(name) {
  const words = String(name).split(/[\s.]+/).filter(Boolean);
  const text = words.length >= 2 ? words[0][0] + words[1][0] : String(name).slice(0, 2);
  return text.toUpperCase();
}

function compactPath(path) {
  if (!path) return "";
  const normalized = String(path).replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 3 ? `.../${parts.slice(-3).join("/")}` : normalized;
}

function getLatestScanForProject(projectId) {
  return state.scans.find(scan => scan.projectId === projectId);
}

function getScanReport(scan) {
  return scan?.report?.scan;
}

function buildArchitectureCards(projectId) {
  const project = state.projects.find(item => item.id === projectId);
  if (!project) return [];

  const linkedProjects = project.groupId
    ? state.projects.filter(item => item.groupId === project.groupId)
    : [project];

  return linkedProjects
    .map(linkedProject => {
      const scan = linkedProject.id === project.id ? getLatestScanForProject(project.id) : getLatestScanForProject(linkedProject.id);
      const report = getScanReport(scan);
      return {
        project: linkedProject,
        structure: report?.project?.structure,
        profile: report?.technologyProfile
      };
    })
    .filter(card => card.structure || card.profile);
}

const layout = {
  mainWidth: 190,
  mainHeight: 92,
  childSize: 72,
  childGapX: 96,
  rowGapY: 140,
  projectGap: 70,
  padding: 40
};

function computeSlotWidth(childCount) {
  const rowWidth = childCount > 0 ? (childCount - 1) * layout.childGapX + layout.childSize : layout.childSize;
  return Math.max(layout.mainWidth, rowWidth);
}

function renderDiagram(cards) {
  if (cards.length === 0) {
    showEmpty("No structural data available for this project yet. Run a scan first.");
    return;
  }

  showCanvas();

  const nodes = [];
  const edges = [];
  const mainY = layout.padding;
  const childY = mainY + layout.mainHeight + layout.rowGapY;
  let cursorX = layout.padding;

  cards.forEach((card, index) => {
    const children = buildChildList(card.profile);
    const slotWidth = computeSlotWidth(children.length);
    const slotCenterX = cursorX + slotWidth / 2;
    const mainId = `main-${index}`;

    const roleTags = [];
    if (card.structure?.frontend) roleTags.push("Frontend");
    if (card.structure?.backend) roleTags.push("Backend");

    nodes.push({
      id: mainId,
      type: "main",
      x: slotCenterX - layout.mainWidth / 2,
      y: mainY,
      width: layout.mainWidth,
      height: layout.mainHeight,
      title: card.project.name ?? compactPath(card.project.path),
      path: compactPath(card.project.path),
      role: roleTags.length > 0 ? roleTags.join(" + ") : "Role unclear"
    });

    if (index > 0) {
      edges.push({ from: `main-${index - 1}`, to: mainId, kind: "main" });
    }

    const rowWidth = children.length > 0 ? (children.length - 1) * layout.childGapX : 0;
    const startX = slotCenterX - rowWidth / 2;

    children.forEach((child, childIndex) => {
      const childId = `${mainId}-child-${childIndex}`;
      nodes.push({
        id: childId,
        type: "child",
        x: startX + childIndex * layout.childGapX - layout.childSize / 2,
        y: childY,
        width: layout.childSize,
        height: layout.childSize,
        title: child.label,
        category: child.category,
        monogram: monogram(child.label)
      });
      edges.push({ from: mainId, to: childId, kind: "child" });
    });

    cursorX += slotWidth + layout.projectGap;
  });

  const canvasWidth = Math.max(...nodes.map(n => n.x + n.width)) + layout.padding;
  const canvasHeight = Math.max(...nodes.map(n => n.y + n.height)) + layout.padding;

  elements.canvas.style.width = `${canvasWidth}px`;
  elements.canvas.style.height = `${canvasHeight}px`;
  elements.canvas.innerHTML = "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "diagram-edges");
  svg.setAttribute("width", String(canvasWidth));
  svg.setAttribute("height", String(canvasHeight));

  const nodeById = new Map(nodes.map(node => [node.id, node]));

  for (const edge of edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) continue;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    if (edge.kind === "main") {
      const x1 = from.x + from.width;
      const y1 = from.y + from.height / 2;
      const x2 = to.x;
      const y2 = to.y + to.height / 2;
      path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
      path.setAttribute("class", "diagram-edge-main");
    } else {
      const x1 = from.x + from.width / 2;
      const y1 = from.y + from.height;
      const x2 = to.x + to.width / 2;
      const y2 = to.y;
      const midY = (y1 + y2) / 2;
      path.setAttribute("d", `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
      path.setAttribute("class", "diagram-edge-child");
    }

    svg.appendChild(path);
  }

  elements.canvas.appendChild(svg);

  for (const node of nodes) {
    const el = document.createElement("div");
    el.className = `diagram-node ${node.type}`;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.width}px`;
    el.style.height = `${node.height}px`;

    el.innerHTML = node.type === "main"
      ? `
        <div class="diagram-node-title">${escapeHtml(node.title)}</div>
        <span class="diagram-role-badge">${escapeHtml(node.role)}</span>
        <div class="diagram-node-path">${escapeHtml(node.path)}</div>
      `
      : `
        <div class="diagram-node-icon diagram-category-${node.category}">${escapeHtml(node.monogram)}</div>
        <div class="diagram-node-title">${escapeHtml(node.title)}</div>
      `;

    elements.canvas.appendChild(el);
  }
}

function populateProjectSelect(selectedProjectId) {
  elements.select.innerHTML = "";

  for (const project of state.projects) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.groupLabel
      ? `${project.name} (${project.groupLabel})`
      : project.name ?? compactPath(project.path);
    elements.select.append(option);
  }

  if (selectedProjectId && state.projects.some(project => project.id === selectedProjectId)) {
    elements.select.value = selectedProjectId;
  }
}

async function loadAndRender() {
  try {
    const [projectsBody, scansBody] = await Promise.all([
      fetchJson("/projects"),
      fetchJson("/scans")
    ]);

    state.projects = projectsBody.projects ?? [];
    state.scans = scansBody.scans ?? [];
    setConnection("API online", true);
  } catch (error) {
    setConnection(error.message, false);
    showEmpty("Could not reach the CodeSentinel API. Check the dashboard's API Base URL, then reload this page.");
    return;
  }

  if (state.projects.length === 0) {
    showEmpty("No projects yet. Run a scan from the dashboard first.");
    return;
  }

  const savedProjectId = localStorage.getItem("codesentinel.selectedProjectId");
  const initialProjectId = state.projects.some(project => project.id === savedProjectId)
    ? savedProjectId
    : state.projects[0].id;

  populateProjectSelect(initialProjectId);
  renderDiagram(buildArchitectureCards(initialProjectId));
}

elements.select.addEventListener("change", () => {
  renderDiagram(buildArchitectureCards(elements.select.value));
});

loadAndRender();

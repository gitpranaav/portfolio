const SOURCES = {
  github: "https://github-contributions-api.jogruber.de/v4/gitpranaav",
  leetcode: "https://alfa-leetcode-api.onrender.com/pranav-navandar/calendar",
};

const PALETTES = {
  dsa: ["#ead1c3", "#dea382", "#c86f45", "#93472d"],
  dev: ["#c7dcd2", "#86b39f", "#398066", "#124433"],
};

const state = {
  days: [],
  activity: new Map(),
  filter: "combined",
  failures: [],
};

const grid = document.querySelector("#heatmap-grid");
const monthLabels = document.querySelector("#month-labels");
const tooltip = document.querySelector("#activity-tooltip");
const statusText = document.querySelector("#activity-status");

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - start.getDay());

  const days = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function blankActivity() {
  return { dsa: 0, dev: 0 };
}

function renderSkeleton() {
  state.days = buildDateRange();
  grid.innerHTML = "";
  state.days.forEach((day, index) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "activity-cell";
    cell.tabIndex = -1;
    cell.style.animationDelay = `${(index % 19) * 30}ms`;
    grid.appendChild(cell);
  });
  renderMonthLabels();
}

function renderMonthLabels() {
  const weekCount = Math.ceil(state.days.length / 7);
  monthLabels.style.setProperty("--week-count", weekCount);
  grid.style.setProperty("--week-count", weekCount);
  monthLabels.innerHTML = "";

  let lastMonth = -1;
  state.days.forEach((date, index) => {
    if (index % 7 !== 0) return;
    const month = date.getMonth();
    const label = document.createElement("span");
    label.style.gridColumn = `${Math.floor(index / 7) + 1}`;
    if (month !== lastMonth && date.getDate() <= 14) {
      label.textContent = date.toLocaleDateString(undefined, { month: "short" });
      lastMonth = month;
    }
    monthLabels.appendChild(label);
  });
}

async function fetchJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseGitHub(data) {
  const result = new Map();
  const contributions = Array.isArray(data?.contributions) ? data.contributions : [];
  contributions.forEach((entry) => {
    if (typeof entry?.date === "string") result.set(entry.date, Number(entry.count) || 0);
  });
  return result;
}

function parseLeetCode(data) {
  const result = new Map();
  let calendar = data?.submissionCalendar ?? {};
  if (typeof calendar === "string") {
    try { calendar = JSON.parse(calendar); } catch { calendar = {}; }
  }
  Object.entries(calendar).forEach(([timestamp, count]) => {
    const date = new Date(Number(timestamp) * 1000);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    result.set(key, (result.get(key) || 0) + (Number(count) || 0));
  });
  return result;
}

function intensity(value, type) {
  if (value <= 0) return "rgba(23, 32, 27, .075)";
  const level = value <= 2 ? 0 : value <= 5 ? 1 : value <= 9 ? 2 : 3;
  return PALETTES[type][level];
}

function cellBackground(activity) {
  const dsaColor = intensity(activity.dsa, "dsa");
  const devColor = intensity(activity.dev, "dev");

  if (state.filter === "dsa") return dsaColor;
  if (state.filter === "dev") return devColor;
  if (activity.dsa > 0 && activity.dev > 0) {
    return `linear-gradient(135deg, ${dsaColor} 0 48%, #f3f0e8 48% 52%, ${devColor} 52% 100%)`;
  }
  return activity.dsa > 0 ? dsaColor : devColor;
}

function formatDay(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function showTooltip(cell) {
  const key = cell.dataset.date;
  const activity = state.activity.get(key) || blankActivity();
  const date = new Date(`${key}T12:00:00`);
  tooltip.innerHTML = `<strong>${formatDay(date)}</strong><span>${activity.dsa} LeetCode submission${activity.dsa === 1 ? "" : "s"}</span><br><span>${activity.dev} GitHub contribution${activity.dev === 1 ? "" : "s"}</span>`;
  tooltip.hidden = false;
  const rect = cell.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const left = Math.min(window.innerWidth - tooltipRect.width - 10, Math.max(10, rect.left + rect.width / 2 - tooltipRect.width / 2));
  const top = Math.max(10, rect.top - tooltipRect.height - 10);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function renderHeatmap() {
  grid.classList.remove("is-loading");
  grid.innerHTML = "";

  state.days.forEach((date, index) => {
    const key = toDateKey(date);
    const activity = state.activity.get(key) || blankActivity();
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "activity-cell";
    cell.tabIndex = index === state.days.length - 1 ? 0 : -1;
    cell.dataset.date = key;
    cell.style.background = cellBackground(activity);
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `${formatDay(date)}: ${activity.dsa} LeetCode submissions and ${activity.dev} GitHub contributions`);
    cell.addEventListener("mouseenter", () => showTooltip(cell));
    cell.addEventListener("mouseleave", hideTooltip);
    cell.addEventListener("focus", () => showTooltip(cell));
    cell.addEventListener("blur", hideTooltip);
    cell.addEventListener("keydown", (event) => {
      const offsets = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
      if (event.key === "Escape") {
        hideTooltip();
        return;
      }
      if (!(event.key in offsets)) return;
      event.preventDefault();
      const target = Math.max(0, Math.min(state.days.length - 1, index + offsets[event.key]));
      const cells = grid.querySelectorAll(".activity-cell");
      cells.forEach((candidate) => { candidate.tabIndex = -1; });
      cells[target].tabIndex = 0;
      cells[target].focus();
    });
    grid.appendChild(cell);
  });
}

function updateStats() {
  let dsa = 0;
  let dev = 0;
  let activeDays = 0;
  state.days.forEach((date) => {
    const activity = state.activity.get(toDateKey(date)) || blankActivity();
    dsa += activity.dsa;
    dev += activity.dev;
    if (activity.dsa > 0 || activity.dev > 0) activeDays += 1;
  });
  document.querySelector("#stat-dsa").textContent = dsa.toLocaleString();
  document.querySelector("#stat-dev").textContent = dev.toLocaleString();
  document.querySelector("#stat-days").textContent = activeDays.toLocaleString();
}

async function loadActivity() {
  const [githubResult, leetcodeResult] = await Promise.allSettled([
    fetchJson(SOURCES.github),
    fetchJson(SOURCES.leetcode),
  ]);

  const github = githubResult.status === "fulfilled" ? parseGitHub(githubResult.value) : new Map();
  const leetcode = leetcodeResult.status === "fulfilled" ? parseLeetCode(leetcodeResult.value) : new Map();
  state.failures = [];
  if (githubResult.status === "rejected") state.failures.push("GitHub");
  if (leetcodeResult.status === "rejected") state.failures.push("LeetCode");

  state.days.forEach((date) => {
    const key = toDateKey(date);
    state.activity.set(key, { dsa: leetcode.get(key) || 0, dev: github.get(key) || 0 });
  });

  updateStats();
  renderHeatmap();

  if (state.failures.length === 2) {
    statusText.textContent = "Live sources are temporarily unavailable. Profile links still work.";
  } else if (state.failures.length === 1) {
    statusText.textContent = `${state.failures[0]} is temporarily unavailable · Showing the remaining live source`;
  } else {
    statusText.textContent = `Live data · Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
}

function setupFilters() {
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll(".filter-button").forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      renderHeatmap();
    });
  });
}

function setupNavigation() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#site-nav");
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    nav.classList.toggle("is-open", !open);
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  }));
}

renderSkeleton();
setupFilters();
setupNavigation();
document.querySelector("#copyright-year").textContent = new Date().getFullYear();
loadActivity();

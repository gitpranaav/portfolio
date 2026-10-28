const ACTIVITY_CACHE = "data/activity.json";

const PALETTES = {
  dsa: ["var(--dsa-1)", "var(--dsa-2)", "var(--dsa-3)", "var(--dsa-4)"],
  dev: ["var(--dev-1)", "var(--dev-2)", "var(--dev-3)", "var(--dev-4)"],
};

const state = {
  days: [],
  activity: new Map(),
  filter: "combined",
  githubTotal: 0,
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
    const response = await fetch(url, { signal: controller.signal, cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function intensity(value, type) {
  if (value <= 0) return "var(--activity-empty)";
  const level = value <= 2 ? 0 : value <= 5 ? 1 : value <= 9 ? 2 : 3;
  return PALETTES[type][level];
}

function cellBackground(activity) {
  const dsaColor = intensity(activity.dsa, "dsa");
  const devColor = intensity(activity.dev, "dev");

  if (state.filter === "dsa") return dsaColor;
  if (state.filter === "dev") return devColor;
  if (activity.dsa > 0 && activity.dev > 0) {
    return `linear-gradient(135deg, ${dsaColor} 0 48%, var(--paper) 48% 52%, ${devColor} 52% 100%)`;
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
  let activeDays = 0;
  state.days.forEach((date) => {
    const activity = state.activity.get(toDateKey(date)) || blankActivity();
    if (activity.dsa > 0 || activity.dev > 0) activeDays += 1;
  });
  document.querySelector("#stat-dsa").textContent = "900+";
  document.querySelector("#stat-dev").textContent = state.githubTotal.toLocaleString();
  document.querySelector("#stat-days").textContent = activeDays.toLocaleString();
}

async function loadActivity() {
  try {
    const cache = await fetchJson(ACTIVITY_CACHE);
    if (!Array.isArray(cache?.days)) throw new Error("Invalid activity cache");

    state.activity.clear();
    cache.days.forEach((day) => {
      if (typeof day?.date !== "string") return;
      state.activity.set(day.date, {
        dsa: Number(day.dsa) || 0,
        dev: Number(day.dev) || 0,
      });
    });
    state.githubTotal = cache.days.reduce((sum, day) => sum + (Number(day?.dev) || 0), 0);

    updateStats();
    renderHeatmap();

    const updated = new Date(cache.updatedAt);
    const updatedLabel = Number.isNaN(updated.getTime())
      ? "recently"
      : updated.toLocaleString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
    statusText.textContent = `Cached every 48h · Updated ${updatedLabel}`;
  } catch {
    state.githubTotal = 0;
    updateStats();
    renderHeatmap();
    document.querySelector("#stat-dev").textContent = "—";
    statusText.textContent = "Activity cache is temporarily unavailable. Profile links still work.";
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

function setupThemeToggle() {
  const toggle = document.querySelector(".theme-toggle");
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  const applyTheme = (theme, persist = false) => {
    document.documentElement.dataset.theme = theme;
    const nextTheme = theme === "dark" ? "light" : "dark";
    const label = `Switch to ${nextTheme} mode`;
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
    themeColor?.setAttribute("content", theme === "dark" ? "#111713" : "#f3f0e8");
    if (persist) {
      try { localStorage.setItem("portfolio-theme", theme); } catch { /* Storage can be unavailable. */ }
    }
  };

  applyTheme(document.documentElement.dataset.theme || (media.matches ? "dark" : "light"));
  toggle.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
  media.addEventListener("change", (event) => {
    let hasSavedTheme = false;
    try { hasSavedTheme = Boolean(localStorage.getItem("portfolio-theme")); } catch { /* Use system theme. */ }
    if (!hasSavedTheme) applyTheme(event.matches ? "dark" : "light");
  });
}

function setupSearchDemo() {
  const demo = document.querySelector("[data-search-demo]");
  if (!demo) return;

  const query = demo.querySelector("[data-search-query]");
  const mode = demo.querySelector("[data-search-mode]");
  const latency = demo.querySelector("[data-search-latency]");
  const rows = Array.from(demo.querySelectorAll("[data-search-results] li"));
  const cases = [
    {
      query: "gut",
      mode: "fuzzy",
      label: "BK-tree · QWERTY DP",
      latency: "0.08 ms",
      results: [["hut", "adjacent key · 0.50"], ["but", "near key · 0.60"], ["nut", "far key · 0.90"]],
    },
    {
      query: "comput",
      mode: "prefix",
      label: "Trie · exact prefix",
      latency: "0.04 ms",
      results: [["computation", "exact prefix"], ["computer", "exact prefix"], ["computing", "exact prefix"]],
    },
    {
      query: "comput",
      mode: "cache",
      label: "LRU cache · hit",
      latency: "<0.01 ms",
      results: [["computation", "cached result"], ["computer", "cached result"], ["computing", "cached result"]],
    },
  ];

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const showCase = async (item) => {
    rows.forEach((row) => row.classList.remove("is-visible"));
    query.textContent = "";
    mode.textContent = "indexing…";
    latency.textContent = "—";
    demo.dataset.mode = item.mode;
    await wait(220);

    for (const character of item.query) {
      query.textContent += character;
      await wait(115);
    }

    await wait(180);
    mode.textContent = item.label;
    latency.textContent = item.latency;
    item.results.forEach(([word, detail], index) => {
      rows[index].querySelector("b").textContent = word;
      rows[index].querySelector("small").textContent = detail;
    });
    for (const row of rows) {
      row.classList.add("is-visible");
      await wait(110);
    }
    await wait(1800);
  };

  const run = async () => {
    let index = 0;
    await wait(800);
    while (demo.isConnected) {
      if (document.hidden) {
        await wait(600);
        continue;
      }
      await showCase(cases[index]);
      index = (index + 1) % cases.length;
    }
  };
  run();
}

function setupMediFlowDemo() {
  const demo = document.querySelector("[data-mediflow-demo]");
  if (!demo) return;

  const turns = {
    doctor: demo.querySelector('[data-dialogue="doctor"]'),
    patient: demo.querySelector('[data-dialogue="patient"]'),
  };
  const fields = Object.fromEntries(
    Array.from(demo.querySelectorAll("[data-field]")).map((field) => [field.dataset.field, field]),
  );
  const conversation = [
    {
      speaker: "doctor",
      text: "What brings you in today?",
      updates: {},
    },
    {
      speaker: "patient",
      text: "A dry cough and fever for three days.",
      updates: { complaint: "Dry cough + fever", duration: "3 days" },
    },
    {
      speaker: "doctor",
      text: "Any allergies or breathing trouble?",
      updates: {},
    },
    {
      speaker: "patient",
      text: "No allergies. My breathing feels normal.",
      updates: { allergies: "None reported", respiratory: "Normal" },
    },
  ];

  const reset = () => {
    Object.values(turns).forEach((turn) => {
      turn.classList.remove("is-active", "is-transcribing");
      turn.querySelector("[data-dialogue-text]").textContent = "";
    });
    Object.values(fields).forEach((field) => { field.textContent = "—"; });
    demo.querySelectorAll("[data-field-card]").forEach((card) => card.classList.remove("is-updating"));
  };

  const applyUpdates = async (updates, wait) => {
    for (const [name, value] of Object.entries(updates)) {
      const field = fields[name];
      const card = field.closest("[data-field-card]");
      field.textContent = value;
      card.classList.remove("is-updating");
      void card.offsetWidth;
      card.classList.add("is-updating");
      await wait(180);
    }
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    turns.doctor.classList.add("is-active");
    turns.patient.classList.add("is-active");
    turns.doctor.querySelector("[data-dialogue-text]").textContent = conversation[2].text;
    turns.patient.querySelector("[data-dialogue-text]").textContent = conversation[3].text;
    fields.complaint.textContent = "Dry cough + fever";
    fields.duration.textContent = "3 days";
    fields.allergies.textContent = "None reported";
    fields.respiratory.textContent = "Normal";
    return;
  }

  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const transcribe = async (item) => {
    const turn = turns[item.speaker];
    const text = turn.querySelector("[data-dialogue-text]");
    Object.values(turns).forEach((candidate) => candidate.classList.remove("is-active"));
    turn.classList.add("is-active", "is-transcribing");
    text.textContent = "";
    for (const character of item.text) {
      text.textContent += character;
      await wait(character === " " ? 18 : 30);
    }
    turn.classList.remove("is-transcribing");
    await wait(220);
    await applyUpdates(item.updates, wait);
    await wait(420);
  };

  const run = async () => {
    await wait(650);
    while (demo.isConnected) {
      reset();
      for (const item of conversation) {
        while (document.hidden) await wait(500);
        await transcribe(item);
      }
      await wait(1800);
    }
  };
  run();
}

renderSkeleton();
setupFilters();
setupNavigation();
setupThemeToggle();
setupSearchDemo();
setupMediFlowDemo();
document.querySelector("#copyright-year").textContent = new Date().getFullYear();
loadActivity();

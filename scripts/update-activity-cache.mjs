import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_PATH = resolve(ROOT, "data", "activity.json");
const SOURCES = {
  github: "https://github-contributions-api.jogruber.de/v4/gitpranaav",
  leetcode: "https://alfa-leetcode-api.onrender.com/pranav-navandar/calendar",
};

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function dateRange() {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);
  const dates = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(dateKey(cursor));
  }
  return dates;
}

async function fetchOnce(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "gitpranaav-portfolio-cache" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

function parseGitHub(data) {
  if (!Array.isArray(data?.contributions)) throw new Error("GitHub response has no contributions array");
  const result = new Map();
  for (const entry of data.contributions) {
    if (typeof entry?.date === "string") result.set(entry.date, Number(entry.count) || 0);
  }
  return result;
}

function parseLeetCode(data) {
  const result = new Map();
  let calendar = data?.submissionCalendar;
  if (calendar == null) throw new Error("LeetCode response has no submission calendar");
  if (typeof calendar === "string") calendar = JSON.parse(calendar);
  if (typeof calendar !== "object" || Array.isArray(calendar)) {
    throw new Error("LeetCode submission calendar has an invalid shape");
  }
  for (const [timestamp, count] of Object.entries(calendar)) {
    const date = new Date(Number(timestamp) * 1000);
    if (Number.isNaN(date.getTime())) continue;
    const key = dateKey(date);
    result.set(key, (result.get(key) || 0) + (Number(count) || 0));
  }
  return result;
}

async function previousCache() {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8"));
  } catch {
    return { days: [], sources: {} };
  }
}

const previous = await previousCache();
const previousDays = new Map(
  (Array.isArray(previous.days) ? previous.days : []).map((day) => [day.date, day]),
);
const [githubResult, leetcodeResult] = await Promise.allSettled([
  fetchOnce(SOURCES.github).then(parseGitHub),
  fetchOnce(SOURCES.leetcode).then(parseLeetCode),
]);

if (githubResult.status === "rejected" && leetcodeResult.status === "rejected") {
  throw new AggregateError(
    [githubResult.reason, leetcodeResult.reason],
    "Both activity sources failed; the existing cache was left unchanged.",
  );
}

const now = new Date().toISOString();
const github = githubResult.status === "fulfilled" ? githubResult.value : null;
const leetcode = leetcodeResult.status === "fulfilled" ? leetcodeResult.value : null;
const days = dateRange().map((date) => ({
  date,
  dsa: leetcode?.get(date) ?? (Number(previousDays.get(date)?.dsa) || 0),
  dev: github?.get(date) ?? (Number(previousDays.get(date)?.dev) || 0),
}));
const githubContributions = days.reduce((sum, day) => sum + day.dev, 0);

const cache = {
  schemaVersion: 1,
  updatedAt: now,
  range: { from: days[0].date, to: days.at(-1).date },
  algorithmicProblemsSolved: "900+",
  totals: { githubContributions },
  sources: {
    github: { updatedAt: github ? now : previous.sources?.github?.updatedAt ?? null },
    leetcode: { updatedAt: leetcode ? now : previous.sources?.leetcode?.updatedAt ?? null },
  },
  days,
};

await mkdir(dirname(CACHE_PATH), { recursive: true });
await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");

const refreshed = [github && "GitHub", leetcode && "LeetCode"].filter(Boolean).join(" + ");
console.log(`Wrote ${days.length} cached days; refreshed ${refreshed}; GitHub total ${githubContributions}.`);

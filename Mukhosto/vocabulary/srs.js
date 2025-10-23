/**
 * Mukhosto Vocabulary - Spaced Repetition Core (v3.1)
 * - Minute/Hour/Day schedule support (stores minutes)
 * - Backward-compatible helpers for "days"
 * - NEW: SRS.rescheduleStage0() to apply the current first interval to all stage-0 items
 *
 * Storage:
 *   Records map ............ localStorage["muk_srs_v1"]
 *   Config (minutes) ....... localStorage["muk_srs_config_v2"] => { stageMinutes:number[], rollingMinutes:number }
 *
 * Public API (window.SRS):
 *   version: 3
 *   // minutes-first API
 *   getScheduleMinutes(): number[]
 *   setScheduleMinutes(mins: number[]): boolean
 *   getRollingMinutes(): number
 *   setRollingMinutes(mins: number): boolean
 *
 *   // legacy shims (days-based)
 *   getSchedule(): number[]                // days (rounded)
 *   setSchedule(days: number[]): boolean   // converts to minutes
 *   getRollingDays(): number               // days (rounded)
 *   setRollingDays(days: number): boolean  // converts to minutes
 *   formatDuration(mins: number): string   // "30m", "12h", "3d"
 *
 *   // core
 *   initForWord(word: string): void
 *   markReviewed(word: string, outcome: "good" | "again"): void
 *   dueKeys(atTimeMs?: number): string[]
 *   countDue(atTimeMs?: number): number
 *   peek(word: string): Record|null
 *   clearAll(): void
 *   migrateFromKnownWords(): { added: number }
 *
 *   // utility
 *   rescheduleStage0(): { changed: number, firstMinutes: number }
 */
(function () {
  "use strict";

  // ---------- Time constants ----------
  const MIN_PER_HOUR = 60;
  const MIN_PER_DAY  = 1440;
  const MINUTE_MS    = 60 * 1000;

  // ---------- Defaults (legacy: 3,7,14,21,30 days; rolling 30 days) ----------
  const DEFAULT_STAGE_DAYS = [3, 7, 14, 21, 30];
  const DEFAULT_STAGE_MIN  = DEFAULT_STAGE_DAYS.map(d => d * MIN_PER_DAY);
  const DEFAULT_ROLLING_MIN = 30 * MIN_PER_DAY;

  // ---------- Storage keys ----------
  const STORAGE_KEY = "muk_srs_v1";        // word -> record
  const CONFIG_KEY  = "muk_srs_config_v2"; // { stageMinutes:[], rollingMinutes:number }

  // ---------- Utils ----------
  function now() { return Date.now(); }
  function minutesFromNow(mins) { return now() + mins * MINUTE_MS; }
  function normalizeKey(word) { return String(word || "").trim().toLowerCase(); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function isPositiveInt(n) { return Number.isInteger(n) && n > 0 && n < 10000000; }

  function normalizeMinutesArray(arr) {
    const cleaned = (arr || [])
      .map(x => parseInt(x, 10))
      .filter(isPositiveInt)
      .sort((a, b) => a - b);
    const out = [];
    for (const n of cleaned) if (!out.includes(n)) out.push(n);
    return out.length ? out : DEFAULT_STAGE_MIN.slice();
  }

  // ---------- Config (minutes) ----------
  function readConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return { stageMinutes: DEFAULT_STAGE_MIN.slice(), rollingMinutes: DEFAULT_ROLLING_MIN };
      const cfg = JSON.parse(raw);
      const stageMinutes = normalizeMinutesArray(cfg?.stageMinutes);
      const rollingMinutes = isPositiveInt(cfg?.rollingMinutes) ? cfg.rollingMinutes : DEFAULT_ROLLING_MIN;
      return { stageMinutes, rollingMinutes };
    } catch {
      return { stageMinutes: DEFAULT_STAGE_MIN.slice(), rollingMinutes: DEFAULT_ROLLING_MIN };
    }
  }
  function writeConfig(cfg) {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); return true; }
    catch { return false; }
  }

  function getScheduleMinutes() { return readConfig().stageMinutes.slice(); }
  function setScheduleMinutes(minsArr) { const cfg = readConfig(); cfg.stageMinutes = normalizeMinutesArray(minsArr); return writeConfig(cfg); }
  function getRollingMinutes() { return readConfig().rollingMinutes; }
  function setRollingMinutes(n) { if (!isPositiveInt(n)) return false; const cfg = readConfig(); cfg.rollingMinutes = n; return writeConfig(cfg); }

  // ---------- Legacy shims (days) ----------
  function getSchedule() { return getScheduleMinutes().map(m => Math.round(m / MIN_PER_DAY)); }
  function setSchedule(daysArr) {
    const mins = (Array.isArray(daysArr) ? daysArr : []).map(d => parseInt(d, 10) * MIN_PER_DAY);
    return setScheduleMinutes(mins);
  }
  function getRollingDays() { return Math.round(getRollingMinutes() / MIN_PER_DAY); }
  function setRollingDays(d) { return setRollingMinutes(parseInt(d, 10) * MIN_PER_DAY); }

  function formatDuration(mins) {
    const d = Math.floor(mins / MIN_PER_DAY);
    const h = Math.floor((mins % MIN_PER_DAY) / MIN_PER_HOUR);
    const m = Math.floor(mins % MIN_PER_HOUR);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m && parts.length === 0) parts.push(`${m}m`); // keep single unit when possible
    return parts.join(" ") || "0m";
  }

  // ---------- Storage (records) ----------
  function readMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (typeof parsed === "object" && parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  function writeMap(map) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }
    catch (e) { console.error("[SRS] persist failed", e); }
  }

  // ---------- Core behaviors ----------
  function initForWord(word) {
    const key = normalizeKey(word); if (!key) return;
    const map = readMap(); const existing = map[key]; const t = now(); const schedule = getScheduleMinutes();
    if (existing) {
      if (!Array.isArray(existing.history)) existing.history = [];
      if (typeof existing.stage !== "number") existing.stage = 0;
      if (typeof existing.dueAt !== "number") existing.dueAt = minutesFromNow(schedule[0] || DEFAULT_STAGE_MIN[0]);
      map[key] = existing; writeMap(map); return;
    }
    map[key] = {
      key,
      display: String(word),
      addedAt: t,
      stage: 0,
      dueAt: minutesFromNow(schedule[0] || DEFAULT_STAGE_MIN[0]),
      history: [{ ts: t, action: "init" }]
    };
    writeMap(map);
  }

  function markReviewed(word, outcome /* "good" | "again" */) {
    const key = normalizeKey(word); if (!key) return;
    const map = readMap(); let e = map[key]; const t = now();
    const schedule = getScheduleMinutes(); const lastIndex = schedule.length - 1; const rolling = getRollingMinutes();

    if (!e) { initForWord(word); e = readMap()[key]; }
    e.display = String(word);

    if (outcome === "again") {
      e.stage = 0;
      e.dueAt = minutesFromNow(schedule[0] || DEFAULT_STAGE_MIN[0]);
      (e.history || (e.history = [])).push({ ts: t, action: "again" });
    } else {
      if (e.stage < lastIndex) {
        e.stage = clamp(e.stage + 1, 0, lastIndex);
        e.dueAt = minutesFromNow(
          schedule[e.stage] || DEFAULT_STAGE_MIN[Math.min(e.stage, DEFAULT_STAGE_MIN.length - 1)]
        );
      } else {
        e.stage = lastIndex >= 0 ? lastIndex : 0;
        e.dueAt = t + rolling * MINUTE_MS;
      }
      (e.history || (e.history = [])).push({ ts: t, action: "good" });
    }
    map[key] = e; writeMap(map);
  }

  function dueKeys(atTime /* optional number (ms) */) {
    const t = typeof atTime === "number" ? atTime : now();
    return Object.values(readMap())
      .filter(e => typeof e.dueAt === "number" && e.dueAt <= t)
      .map(e => e.display || e.key);
  }
  function countDue(atTime) { return dueKeys(atTime).length; }
  function peek(word) { const key = normalizeKey(word); const e = readMap()[key]; return e ? Object.assign({}, e) : null; }
  function clearAll() { writeMap({}); }

  function migrateFromKnownWords() {
    const old = JSON.parse(localStorage.getItem("knownWords") || "[]");
    if (!Array.isArray(old) || !old.length) return { added: 0 };

    const map = readMap(); const schedule = getScheduleMinutes();
    let added = 0; const t = now();
    for (const w of old) {
      const k = normalizeKey(w); if (!k || map[k]) continue;
      map[k] = {
        key: k,
        display: String(w),
        addedAt: t,
        stage: 0,
        dueAt: minutesFromNow(schedule[0] || DEFAULT_STAGE_MIN[0]),
        history: [{ ts: t, action: "migrated" }]
      };
      added++;
    }
    writeMap(map); return { added };
  }

  // ---------- Utility ----------
  // Apply the CURRENT first interval to all stage-0 items.
  // Use this after you change the schedule (e.g., from days to minutes).
  function rescheduleStage0() {
    try {
      const map = readMap();
      const schedule = getScheduleMinutes();
      const first = schedule[0] || DEFAULT_STAGE_MIN[0];
      const t = now();
      let changed = 0;

      for (const k of Object.keys(map)) {
        const e = map[k]; if (!e) continue;
        if (e.stage === 0) {
          e.dueAt = minutesFromNow(first);
          (e.history || (e.history = [])).push({ ts: t, action: "reschedule_stage0" });
          changed++;
        }
      }
      writeMap(map);
      return { changed, firstMinutes: first };
    } catch (e) {
      console.warn("[SRS] rescheduleStage0 failed:", e);
      return { changed: 0, firstMinutes: 0 };
    }
  }

  // ---------- Public API ----------
  const api = {
    version: 3,

    // minutes-first API
    getScheduleMinutes,
    setScheduleMinutes,
    getRollingMinutes,
    setRollingMinutes,

    // helpers / legacy shims
    getSchedule,
    setSchedule,
    getRollingDays,
    setRollingDays,
    formatDuration,

    // core
    initForWord,
    markReviewed,
    peek,
    dueKeys,
    countDue,
    clearAll,
    migrateFromKnownWords,

    // utility
    rescheduleStage0,
  };

  window.SRS = api;
})();

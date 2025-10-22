/**
 * Settings page logic (minutes/hours/days) + Apply-to-stage0 + Reset Progress
 */
(function () {
  "use strict";

  const MIN_PER_HOUR = 60;
  const MIN_PER_DAY  = 1440;

  function $(sel) { return document.querySelector(sel); }

  // ---- parse helpers ----
  function parseIntervalToken(token) {
    const s = String(token || "").trim().toLowerCase();
    if (!s) return null;
    const m = s.match(/^(\d+)\s*([mhd])?$/);
    if (!m) return null;
    const val = parseInt(m[1], 10);
    const unit = m[2] || "d";
    if (!(val > 0)) return null;
    if (unit === "m") return val;
    if (unit === "h") return val * MIN_PER_HOUR;
    return val * MIN_PER_DAY; // "d"
  }

  function parseScheduleString(str) {
    if (!str) return [];
    const mins = str.split(",").map(x => x.trim()).filter(Boolean).map(parseIntervalToken).filter(Boolean);
    mins.sort((a,b)=>a-b);
    const out=[]; for (const n of mins) if (!out.includes(n)) out.push(n);
    return out;
  }

  function minsToBestString(mins) {
    try { return (window.SRS && SRS.formatDuration) ? SRS.formatDuration(mins) : `${Math.round(mins/MIN_PER_DAY)}d`; }
    catch { return `${Math.round(mins/MIN_PER_DAY)}d`; }
  }

  function stageListToDisplay(minsArray, rollingMinutes) {
    if (!minsArray || !minsArray.length) return "—";
    const stages = minsArray.map(minsToBestString).join(" → ");
    const tail = rollingMinutes ? ` → every ${minsToBestString(rollingMinutes)}` : "";
    return stages + tail;
  }

  // ---- UI elements ----
  const scheduleInput = $("#schedule-input");
  const rollingValue  = $("#rolling-value");
  const rollingUnit   = $("#rolling-unit");
  const previewEl     = $("#preview");
  const saveBtn       = $("#save-schedule");
  const resetBtn      = $("#reset-schedule");
  const applyBtn      = $("#apply-to-stage0");
  const msgOk         = $("#schedule-msg");
  const msgErr        = $("#schedule-err");

  const chkReverse    = $("#default-reverse");
  const chkShowExtra  = $("#default-show-extra");
  const btnSaveDef    = $("#save-defaults");
  const btnClearDef   = $("#clear-defaults");
  const defaultsMsg   = $("#defaults-msg");

  const resetAllBtn   = $("#reset-all");
  const resetMsg      = $("#reset-msg");
  const resetErr      = $("#reset-err");

  // ---- load initial values ----
  function loadScheduleUI() {
    const stageMinutes   = (window.SRS && SRS.getScheduleMinutes) ? SRS.getScheduleMinutes() : [3*MIN_PER_DAY,7*MIN_PER_DAY,14*MIN_PER_DAY,21*MIN_PER_DAY,30*MIN_PER_DAY];
    const rollingMinutes = (window.SRS && SRS.getRollingMinutes) ? SRS.getRollingMinutes() : 30*MIN_PER_DAY;

    scheduleInput.value = stageMinutes.map(minsToBestString).join(", ");

    if (rollingMinutes % MIN_PER_DAY === 0) { rollingUnit.value = "d"; rollingValue.value = rollingMinutes / MIN_PER_DAY; }
    else if (rollingMinutes % MIN_PER_HOUR === 0) { rollingUnit.value = "h"; rollingValue.value = rollingMinutes / MIN_PER_HOUR; }
    else { rollingUnit.value = "m"; rollingValue.value = rollingMinutes; }

    previewEl.textContent = stageListToDisplay(stageMinutes, rollingMinutes);
  }

  function loadDefaultsUI() {
    chkReverse.checked   = localStorage.getItem("reversePractice") === "1";
    chkShowExtra.checked = localStorage.getItem("showExtraDefault") === "1";
  }

  // ---- actions ----
  function saveSchedule() {
    msgOk.textContent = ""; msgErr.textContent = "";
    const stageMinutes = parseScheduleString(scheduleInput.value);
    if (!stageMinutes.length) { msgErr.textContent = "Please enter at least one interval (e.g., 1m, 3m, 5m)."; return; }

    const val = parseInt(rollingValue.value, 10); const unit = String(rollingUnit.value || "d");
    if (!(val > 0)) { msgErr.textContent = "Rolling value must be a positive number."; return; }
    let rollingMinutes = val; if (unit === "h") rollingMinutes *= MIN_PER_HOUR; else if (unit === "d") rollingMinutes *= MIN_PER_DAY;

    try {
      const ok1 = SRS.setScheduleMinutes(stageMinutes);
      const ok2 = SRS.setRollingMinutes(rollingMinutes);
      if (ok1 && ok2) { msgOk.textContent = "Saved! New schedule will be used for future reviews."; previewEl.textContent = stageListToDisplay(stageMinutes, rollingMinutes); }
      else { msgErr.textContent = "Could not save config (localStorage disabled?)."; }
    } catch (e) { msgErr.textContent = "Failed to save schedule."; console.warn(e); }
  }

  function resetSchedule() {
    try {
      const defStages  = [3*MIN_PER_DAY,7*MIN_PER_DAY,14*MIN_PER_DAY,21*MIN_PER_DAY,30*MIN_PER_DAY];
      const defRolling = 30*MIN_PER_DAY;
      const ok1 = SRS.setScheduleMinutes(defStages);
      const ok2 = SRS.setRollingMinutes(defRolling);
      if (ok1 && ok2) { loadScheduleUI(); msgOk.textContent = "Reset to defaults."; msgErr.textContent = ""; }
    } catch { msgErr.textContent = "Failed to reset."; }
  }

  function applyToStage0() {
    try {
      const result = (SRS.rescheduleStage0 && SRS.rescheduleStage0()) || { changed: 0 };
      msgOk.textContent = `Applied schedule to ${result.changed} card(s).`;
      setTimeout(() => msgOk.textContent = "", 1500);
    } catch (e) {
      msgErr.textContent = "Failed to apply to current cards.";
    }
  }

  function saveDefaults() {
    localStorage.setItem("reversePractice",   chkReverse.checked ? "1" : "0");
    localStorage.setItem("showExtraDefault",  chkShowExtra.checked ? "1" : "0");
    defaultsMsg.textContent = "Defaults saved.";
    setTimeout(() => defaultsMsg.textContent = "", 1200);
  }

  function clearDefaults() {
    localStorage.removeItem("reversePractice");
    localStorage.removeItem("showExtraDefault");
    loadDefaultsUI();
    defaultsMsg.textContent = "Defaults cleared.";
    setTimeout(() => defaultsMsg.textContent = "", 1200);
  }

  function refreshPreview() {
    const stages = parseScheduleString(scheduleInput.value);
    const val = parseInt(rollingValue.value, 10);
    let rolling = null;
    if (val > 0) {
      if (rollingUnit.value === "m") rolling = val;
      else if (rollingUnit.value === "h") rolling = val * MIN_PER_HOUR;
      else rolling = val * MIN_PER_DAY;
    }
    previewEl.textContent = stages.length ? stageListToDisplay(stages, rolling || 0) : "—";
  }

  // ---- Reset Progress (Danger zone) ----
  function resetAllProgress() {
    resetMsg.textContent = "";
    resetErr.textContent = "";

    // Confirm with the user
    const sure = confirm("This will remove all Known Words and all scheduled reviews from this browser. Continue?");
    if (!sure) return;

    try {
      // 1) Clear Known Words list
      localStorage.removeItem("knownWords");

      // 2) Clear all scheduled SRS records
      localStorage.removeItem("muk_srs_v1");

      // 3) Clear any session toast flag (optional)
      localStorage.removeItem("srs_session_complete");

      resetMsg.textContent = "All progress has been reset.";
      setTimeout(() => { resetMsg.textContent = ""; }, 1800);
    } catch (e) {
      resetErr.textContent = "Failed to reset progress.";
      console.warn(e);
    }
  }

  // ---- wires ----
  document.addEventListener("DOMContentLoaded", () => {
    loadScheduleUI(); loadDefaultsUI();

    saveBtn.addEventListener("click", saveSchedule);
    resetBtn.addEventListener("click", resetSchedule);
    applyBtn.addEventListener("click", applyToStage0);
    btnSaveDef.addEventListener("click", saveDefaults);
    btnClearDef.addEventListener("click", clearDefaults);

    scheduleInput.addEventListener("input", refreshPreview);
    rollingValue.addEventListener("input", refreshPreview);
    rollingUnit.addEventListener("change", refreshPreview);

    if (resetAllBtn) resetAllBtn.addEventListener("click", resetAllProgress);
  });
})();

/**
 * Mukhosto Vocabulary - SRS Integrations (v2 - robust word detection)
 * File: /vocabulary/srs-integrations.js
 *
 * Purpose:
 * - Ensure SRS.initForWord(...) runs whenever a card is marked known,
 *   EVEN IF the app's function doesn't pass the word argument.
 *
 * Strategy:
 * - Wrap common functions (saveKnownWord, markAsKnown, markKnown).
 * - If the first arg is falsy, infer the word from the current DOM:
 *     - .flashcard .card-front .word  (your known-words/review template)
 *     - fallback: [data-current-word] or .current-word (optional hooks)
 * - Normalize the text and call SRS.initForWord(text).
 *
 * Scales safely (non-invasive). If functions get renamed, add another wrap.
 */
(function () {
  "use strict";

  function getVisibleWordText() {
    try {
      // 1) Preferred: same structure your cards use
      const el = document.querySelector(".flashcard .card-front .word");
      if (el && el.textContent) return el.textContent.trim();

      // 2) Optional custom hooks if present
      const el2 = document.querySelector("[data-current-word]");
      if (el2) return (el2.getAttribute("data-current-word") || "").trim();

      const el3 = document.querySelector(".current-word");
      if (el3 && el3.textContent) return el3.textContent.trim();

      return "";
    } catch {
      return "";
    }
  }

  function safeInit(wordMaybe) {
    try {
      const w = (wordMaybe && String(wordMaybe).trim()) || getVisibleWordText();
      if (!w) {
        console.warn("[SRS] Could not detect current word to init.");
        return;
      }
      if (window.SRS && typeof SRS.initForWord === "function") {
        SRS.initForWord(w);
        // Helpful debug log (you can remove later)
        console.log("[SRS] initForWord:", w);
      }
    } catch (e) {
      console.warn("[SRS] initForWord failed:", e);
    }
  }

  function wrapFunction(obj, fnName, onCall) {
    if (!obj || typeof obj[fnName] !== "function") return false;
    const original = obj[fnName];
    obj[fnName] = function () {
      try { onCall.apply(this, arguments); } catch (e) { console.warn("[SRS] wrapper error:", e); }
      return original.apply(this, arguments);
    };
    console.log(`[SRS] Wrapped ${fnName}()`);
    return true;
  }

  function tryWrapAll() {
    let wrapped = false;

    wrapped = wrapFunction(window, "saveKnownWord", function (word) {
      safeInit(word);   // word may be undefined -> DOM fallback
    }) || wrapped;

    wrapped = wrapFunction(window, "markAsKnown", function (word) {
      safeInit(word);
    }) || wrapped;

    wrapped = wrapFunction(window, "markKnown", function (word) {
      safeInit(word);
    }) || wrapped;

    return wrapped;
  }

  // Poll briefly so order doesn't matter
  const start = Date.now();
  const limitMs = 5000;
  const timer = setInterval(function () {
    const ok = tryWrapAll();
    if (ok || Date.now() - start > limitMs) {
      clearInterval(timer);
      if (!ok) console.warn("[SRS] No known functions found to wrap (ok if not on flashcard page).");
    }
  }, 200);
})();

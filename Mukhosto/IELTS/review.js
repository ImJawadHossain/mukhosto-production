/**
 * Review page (uses EXACT same card structure/styles as known-words.html)
 * - pulls only words that are DUE from SRS
 * - Again/Good buttons are at the TOP toolbar
 * - Respects defaults for Reverse & Show Extra Data
 * - Records a session summary for homepage toast
 * - UPDATED: "Done" button on the card replaces the old ❌ and acts like Good
 */

let flashcards = [];
let currentCardIndex = 0;
let showExtraData = false;
let reviewedThisSession = 0; // for the small homepage toast

function normalize(s) { return String(s || "").trim().toLowerCase(); }
function isReverseMode() { return localStorage.getItem("reversePractice") === "1"; }

document.addEventListener("DOMContentLoaded", () => {
  // DEFAULT: Show Extra Data based on settings
  const showExtraDefault = localStorage.getItem("showExtraDefault") === "1";
  showExtraData = showExtraDefault;
  const extraChk = document.getElementById("toggle-extra");
  if (extraChk) extraChk.checked = showExtraDefault;

  // Reverse toggle behavior
  const toggle = document.getElementById("reverse-toggle");
  if (toggle) {
    toggle.checked = isReverseMode();
    toggle.addEventListener("change", () => {
      localStorage.setItem("reversePractice", toggle.checked ? "1" : "0");
      const params = new URLSearchParams(window.location.search);
      params.set("reverse", toggle.checked ? "1" : "0");
      window.location.search = params.toString();
    });
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === "ArrowRight") {
    showNext();
  } else if (e.key === "ArrowLeft") {
    showPrevious();
  } else if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    const card = document.querySelector(".flashcard");
    if (card) flipCard(card);
  }
});

// Boot: load XLSX, filter by SRS due, then render
window.addEventListener("DOMContentLoaded", () => {
  if (!window.SRS || typeof SRS.dueKeys !== "function") {
    document.getElementById("flashcard-container").innerHTML =
      `<p>SRS not available. Did you include <code>srs.js</code>?</p>`;
    return;
  }

  const dueWords = SRS.dueKeys();
  if (!Array.isArray(dueWords) || dueWords.length === 0) {
    document.getElementById("flashcard-container").innerHTML =
      `<p>No cards are due right now — nice! 🎉</p>`;
    document.getElementById("card-counter").textContent = "0/0";
    return;
  }

  fetch("data.xlsx")
    .then(res => res.arrayBuffer())
    .then(buffer => {
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      // Lookup by FrontData (normalized)
      const byFront = {};
      for (const row of json) {
        const k = normalize(row["FrontData"]);
        if (k) byFront[k] = row;
      }

      const reverse = isReverseMode();

      flashcards = dueWords.map(w => {
        const row = byFront[normalize(w)];
        if (row) {
          return {
            word: row["FrontData"],
            front: reverse ? (row["BackData"] || "") : (row["FrontData"] || ""),
            back:  reverse ? (row["FrontData"] || "") : (row["BackData"] || ""),
            subBack: row["SubBack"] || "",
            extras: Object.keys(row).filter(k => k.startsWith("ExtraData")).map(k => row[k])
          };
        } else {
          return {
            word: String(w),
            front: reverse ? "" : String(w),
            back: reverse ? String(w) : "",
            subBack: "",
            extras: []
          };
        }
      });

      createFlashcard();
    })
    .catch(err => {
      document.getElementById("flashcard-container").innerHTML =
        `<p>Error loading file: ${err.message}</p>`;
    });
});

// ---- UI functions (mirroring known-words style) ----

function createFlashcard() {
  const container = document.getElementById("flashcard-container");
  container.innerHTML = "";

  if (flashcards.length === 0) {
    finishSession();
    return;
  }

  const card = flashcards[currentCardIndex];
  const cardDiv = document.createElement("div");
  cardDiv.classList.add("flashcard");

  // IMPORTANT CHANGE: the top-left button is now "Done" and triggers markGood()
  // We keep the same 'remove-btn' class so it inherits your styling/position.
  cardDiv.innerHTML = `
    <div class="card-inner">
      <div class="card-front">
        <button class="remove-btn" onclick="event.stopPropagation(); markGood()">✅</button>
        <span class="word">${card.front}</span>
        <button class="pronunciation-btn" onclick="event.stopPropagation(); pronounce('${card.front}')">🔊</button>
      </div>
      <div class="card-back">
        <div class="meaning">${card.back}</div>
        <button class="pronunciation-btn" onclick="event.stopPropagation(); pronounce('${card.back}')">🔊</button>
        ${card.subBack ? `<em class="sub-definition">${card.subBack}</em>` : ""}

      </div>
    </div>
  `;

  cardDiv.onclick = () => flipCard(cardDiv);
  container.appendChild(cardDiv);
  renderExamplesOutside(card);
  updateCardCounter();
  updateNextButton();
}

function injectExampleStylesOnce() {
  if (document.getElementById("examples-style-tag")) return; // already added
  const css = `
    .examples-box {
      max-width: 900px;
      margin: 18px auto 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      text-align: left;            /* force left alignment for all content */
      margin-bottom: 24px;
    }


    .examples-heading {
      font-weight: 700;
      margin-bottom: 10px;
      color: #111827;
      font-size: 16px;
      text-align: center;          /* heading centered is fine */
      letter-spacing: 0.2px;
    }
    .examples-list {
      margin: 0;
      padding-left: 24px;
      list-style-position: outside;
      text-align: left;            /* ensure list text is left */
    }
.example-item {
  margin: 6px 0;
  line-height: 1.75;
  color: #1f2937;
  display: block;
}

/* add bottom space after every English line so pair separation looks good */
.example-item.en {
  font-size: 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  margin-bottom: 1px;     /* 👈 extra gap after each English line */
}

/* Bangla lines keep nice spacing and teal color */
.example-item.bn {
  font-size: 18px;
  line-height: 1.9;
  font-family: "Noto Sans Bengali", "Hind Siliguri", "SolaimanLipi", "Bangla", "Noto Serif Bengali", serif, sans-serif;
  letter-spacing: 0.1px;
  color: #0f766e;
  margin-left: 1.5rem;
  margin-bottom: 30px;     /* 👈 extra gap after Bangla line */
}

    /* English lines */
    .example-item.en {
      font-size: 18px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      line-height: 1.5;
    }
    /* Bangla lines — different color + comfortable sizing */
    .example-item.bn {
      font-size: 16px;
      line-height: 1.5;
      font-family: "Noto Sans Bengali", "Hind Siliguri", "SolaimanLipi", "Bangla", "Noto Serif Bengali", serif, sans-serif;
      letter-spacing: 0.1px;
      color: #0f766e;              /* teal for Bangla lines */
    }

    .example-symbol {
      font-weight: 600;
      color: #0f766e;      /* same color as Bangla text */
      margin-right: 1px;
    }


  `;
  const tag = document.createElement("style");
  tag.id = "examples-style-tag";
  tag.textContent = css;
  document.head.appendChild(tag);
}


function renderExamplesOutside(card) {
  injectExampleStylesOnce(); // ensure styles exist

  const host = document.getElementById("examples-outside");
  if (!host) return;

  if (!card || !showExtraData || !card.extras || card.extras.length === 0) {
    host.innerHTML = "";
    return;
  }

  // Detect Bangla vs English (Bangla unicode range \u0980-\u09FF)
  const bnRegex = /[\u0980-\u09FF]/;

  let count = 1;
  let examplesHTML = "";

  card.extras.forEach((text) => {
    const isBangla = bnRegex.test(text);
    const cls = isBangla ? "bn" : "en";

    if (isBangla) {
      // Bangla line — symbol before it
      examplesHTML += `<div class="example-item ${cls}"><span class="example-symbol">➤</span> ${text}</div>`;
    } else {
      // English line — numbered
      examplesHTML += `<div class="example-item ${cls}"><span class="example-num">${count++}.</span> ${text}</div>`;
    }
  });

  host.innerHTML = `
    <div class="examples-box">
      <div class="examples-heading">Examples</div>
      <div class="examples-list">${examplesHTML}</div>
    </div>
  `;
}



function flipCard(cardElement) {
  const inner = cardElement.querySelector(".card-inner");
  inner.classList.toggle("is-flipped");
}

function showNext() {
  if (currentCardIndex < flashcards.length - 1) {
    currentCardIndex++;
    createFlashcard();
  } else {
    finishSession();
  }
}

function showPrevious() {
  if (currentCardIndex > 0) {
    currentCardIndex--;
    createFlashcard();
  }
}

function updateCardCounter() {
  document.getElementById("card-counter").textContent =
    `${currentCardIndex + 1}/${flashcards.length}`;
}

function updateNextButton() {
  const nextBtn = document.getElementById("next-button");
  nextBtn.textContent = (currentCardIndex === flashcards.length - 1) ? "Exit" : "Next";
}

function toggleExtras() {
  const chk = document.getElementById("toggle-extra");
  showExtraData = chk ? !!chk.checked : showExtraData;
  createFlashcard();
}

function pronounce(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utterance);
}

function shuffleFlashcards() {
  flashcards.sort(() => Math.random() - 0.5);
  currentCardIndex = 0;
  createFlashcard();
}

// Keep function defined (not used now), in case CSS/HTML still references it somewhere.
function removeCurrentCard() {
  // no-op in Review: we no longer remove cards permanently from here
}

// ---- SRS actions ----
function markGood() {
  const card = flashcards[currentCardIndex];
  if (!card) return;

  try { SRS.markReviewed(card.word || card.front, "good"); } catch {}
  reviewedThisSession++;

  flashcards.splice(currentCardIndex, 1);
  if (currentCardIndex >= flashcards.length) currentCardIndex = flashcards.length - 1;
  if (flashcards.length === 0) finishSession(); else createFlashcard();
}

function markAgain() {
  const card = flashcards[currentCardIndex];
  if (!card) return;

  try { SRS.markReviewed(card.word || card.front, "again"); } catch {}
  reviewedThisSession++;

  flashcards.splice(currentCardIndex, 1);
  if (currentCardIndex >= flashcards.length) currentCardIndex = flashcards.length - 1;
  if (flashcards.length === 0) finishSession(); else createFlashcard();
}

// ---- finish & hand off a small summary for the homepage toast ----
function finishSession() {
  try {
    localStorage.setItem(
      "srs_session_complete",
      JSON.stringify({ ts: Date.now(), reviewed: reviewedThisSession })
    );
  } catch {}
  window.location.href = "/vocabulary";
}

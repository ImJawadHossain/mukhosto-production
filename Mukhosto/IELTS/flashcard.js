let flashcards = [];
let currentCardIndex = 0;
let showExtraData = false;

// ✅ Ensure default is ON if user never set it
if (localStorage.getItem("showExtraDefault") === null) {
  localStorage.setItem("showExtraDefault", "1");
}


function getKnownWords() {
  return JSON.parse(localStorage.getItem("knownWords_1") || "[]");
}

function isReverseMode() {
  return localStorage.getItem("reversePractice") === "1";
}

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("reverse-toggle");
  if (!toggle) return;

  toggle.checked = isReverseMode();

  toggle.addEventListener("change", () => {
    localStorage.setItem("reversePractice", toggle.checked ? "1" : "0");

    const params = new URLSearchParams(window.location.search);
    params.set("reverse", toggle.checked ? "1" : "0");
    window.location.search = params.toString();
  });
});

function saveKnownWord(word) {
  const knownWords = getKnownWords();
  if (!knownWords.includes(word)) {
    knownWords.push(word);
    localStorage.setItem("knownWords_1", JSON.stringify(knownWords));
  }
}

function getRangeFromURL() {
  const params = new URLSearchParams(window.location.search);
  const start = parseInt(params.get("start")) || 1;
  const end = parseInt(params.get("end")) || Number.MAX_SAFE_INTEGER;
  return { start, end };
}

document.addEventListener('keydown', (e) => {
  if (e.key === "ArrowRight") {
    showNext();
  } else if (e.key === "ArrowLeft") {
    showPrevious();
  } else if (e.key === " " || e.key === "Enter") {
    e.preventDefault(); // stop page from scrolling
    const card = document.querySelector(".flashcard");
    if (card) flipCard(card);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  fetch("data.xlsx")
    .then(res => res.arrayBuffer())
    .then(buffer => {
      const reverse = isReverseMode();

      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      const { start, end } = getRangeFromURL();
      const knownWords = getKnownWords();

      let selectedRows = json.slice(start - 1, end)
        .filter(row => !knownWords.includes(row["FrontData"] || ""));

      flashcards = selectedRows.map(row => ({
        front: reverse ? (row["BackData"] || "") : (row["FrontData"] || ""),
        back: reverse ? (row["FrontData"] || "") : (row["BackData"] || ""),
        subBack: row["SubBack"] || "",
        extras: Object.keys(row).filter(k => k.startsWith("ExtraData")).map(k => row[k]),
        reverseOriginal: row["FrontData"] || "",
        partOfSpeech: row["Part_of_Speech"] || "",

      }));

      createFlashcard();
    })
    .catch(err => {
      document.getElementById("flashcard-container").innerHTML = `<p>Error loading file: ${err.message}</p>`;
    });
});

function createFlashcard() {
  const container = document.getElementById("flashcard-container");
  container.innerHTML = "";

  if (flashcards.length === 0) {
    container.innerHTML = "<p>No cards to review!</p>";
    return;
  }

  const card = flashcards[currentCardIndex];
  const cardDiv = document.createElement("div");
  cardDiv.classList.add("flashcard");

  cardDiv.innerHTML = `
    <div class="card-inner">
      <div class="card-front">
        <span class="word">${card.front}</span>
${card.partOfSpeech ? `<span class="pos-tag">${card.partOfSpeech}</span>` : ""}

        <button class="pronunciation-btn" onclick="event.stopPropagation(); pronounce('${card.front}')">🔊</button>
        <button class="known-icon" onclick="event.stopPropagation(); markAsKnown('${card.reverseOriginal || card.front}')">✅</button>
      </div>
      <div class="card-back">
        <div class="meaning">${card.back}</div>
        <button class="pronunciation-btn" onclick="event.stopPropagation(); pronounce('${card.back}')">🔊</button>
        <button class="known-icon" onclick="event.stopPropagation(); markAsKnown('${card.reverseOriginal || card.front}')">✅</button>
        ${card.subBack ? `<em class="sub-definition">${card.subBack}</em>` : ""}
      </div>

    </div>
  `;

  cardDiv.onclick = () => flipCard(cardDiv);
  container.appendChild(cardDiv);

  renderExamplesOutside(card);

  updateCardCounter();
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
    window.location.href = '/vocabulary'; // redirect to /vocabulary
  }
}

function showPrevious() {
  if (currentCardIndex > 0) {
    currentCardIndex--;
    createFlashcard();
  }
}

function updateCardCounter() {
  document.getElementById("card-counter").textContent = `${currentCardIndex + 1}/${flashcards.length}`;

  const nextBtn = document.getElementById("next-btn");
  if (currentCardIndex === flashcards.length - 1) {
    nextBtn.textContent = "Exit";
  } else {
    nextBtn.textContent = "Next";
  }
}

function toggleExtras() {
  showExtraData = document.getElementById("toggle-extra").checked;
  createFlashcard();
}

function pronounce(word) {
  const utterance = new SpeechSynthesisUtterance(word);
  window.speechSynthesis.speak(utterance);
}

function markAsKnown(word) {
  saveKnownWord(word);
  flashcards.splice(currentCardIndex, 1);
  if (currentCardIndex >= flashcards.length) currentCardIndex = flashcards.length - 1;
  createFlashcard();
}

function shuffleCards() {
  const container = document.getElementById("flashcard-container");

  // Add shuffle animation class
  container.classList.add("shuffle-animation");

  setTimeout(() => {
    flashcards.sort(() => Math.random() - 0.5);
    currentCardIndex = 0;
    createFlashcard();

    // Remove animation class after shuffle
    container.classList.remove("shuffle-animation");
  }, 500);
}

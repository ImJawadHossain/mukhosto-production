function getKnownWords() {
  return JSON.parse(localStorage.getItem("knownWords_1") || "[]");
}



const chunkSize = 20;
const setsContainer = document.getElementById("sets-container");
const colorClasses = ['blue', 'green', 'purple', 'pink', 'yellow', 'red', 'indigo'];

document.addEventListener("DOMContentLoaded", () => {
  const resetBtn = document.getElementById("reset-progress");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to reset your progress? This will unmark all known words.")) {
        localStorage.removeItem("knownWords");
        window.location.reload();
      }
    });
  }

  fetch('data.xlsx')
    .then(res => res.arrayBuffer())
    .then(buffer => {
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);

      const knownWords = getKnownWords();
      const totalWords = data.filter(row => row["FrontData"]).length;

      for (let i = 0; i < Math.ceil(totalWords / chunkSize); i++) {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize, totalWords);

        const selectedRows = data.slice(start, end)
          .filter(row => row["FrontData"] && !knownWords.includes(row["FrontData"]));

        const color = colorClasses[i % colorClasses.length];





const sliceRows = data.slice(start, end).filter(r => r["FrontData"]);
const totalInSet = sliceRows.length;
const knownInSet = sliceRows.filter(r => knownWords.includes(r["FrontData"])).length;
const pct = totalInSet ? Math.round((knownInSet / totalInSet) * 100) : 0;

const card = document.createElement('div');
card.className = `bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition`;

card.innerHTML = `
  <h2 class="text-2xl font-semibold text-${color}-600 mb-2">Set ${i + 1}</h2>
  <p class="text-gray-500 mb-2">Words ${start + 1} – ${end}</p>

  <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
    <div class="bg-${color}-600 h-2 rounded-full" style="width: ${pct}%;"></div>
  </div>
  <p class="text-sm text-gray-600 mb-4">${knownInSet}/${totalInSet} known (${pct}%)</p>

  ${
    knownInSet < totalInSet
      ? `<a href="flashcard.html?start=${start + 1}&end=${end}&reverse=${document.getElementById('reverse-toggle')?.checked ? '1' : '0'}" class="inline-block bg-${color}-600 text-white px-4 py-2 rounded-xl">Start</a>`
      : `<div class="text-green-600 font-semibold">✅ Completed</div>`
  }
`;

setsContainer.appendChild(card);






      }

      if (totalWords === 0) {
        setsContainer.innerHTML = `<p class="text-green-600">🎉 You've learned all the words! Reset to start over.</p>`;
      }
    })
    .catch(err => {
      setsContainer.innerHTML = `<p class="text-red-500">Error loading vocabulary file: ${err.message}</p>`;
    });
});

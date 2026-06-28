const MAX_ITEMS = 48;
const ITEMS_PER_PAGE = 24;
const STORAGE_KEY = "kanji-test-maker";

const DEFAULT_ITEMS = [
  { text: "", kanji: "", reading: "" }
];

let items = DEFAULT_ITEMS.map((item) => ({ ...item }));

const SOURCE_FIELDS = [
  "sourceWord",
  "sourceWordReading",
  "sourceTargetReading"
];

const entryList = document.getElementById("entryList");
const previewStage = document.getElementById("previewStage");
const printRoot = document.getElementById("printRoot");
const addButton = document.getElementById("addButton");
const answerToggleButton = document.getElementById("answerToggleButton");
const openRandomButton = document.getElementById("openRandomButton");
const openDataButton = document.getElementById("openDataButton");
const randomModal = document.getElementById("randomModal");
const closeRandomButton = document.getElementById("closeRandomButton");
const cancelRandomButton = document.getElementById("cancelRandomButton");
const generateRandomButton = document.getElementById("generateRandomButton");
const randomCountInput = document.getElementById("randomCountInput");
const randomMessage = document.getElementById("randomMessage");
const csvModal = document.getElementById("csvModal");
const csvTextArea = document.getElementById("csvTextArea");
const csvMessage = document.getElementById("csvMessage");
const closeCsvButton = document.getElementById("closeCsvButton");
const cancelCsvButton = document.getElementById("cancelCsvButton");
const downloadCsvButton = document.getElementById("downloadCsvButton");
const importCsvButton = document.getElementById("importCsvButton");

let lastFocusedElement = null;
let showAnswers = false;

function createEmptyItem() {
  return { text: "", kanji: "", reading: "" };
}

function normalizeItem(item) {
  const normalized = {
    text: String(item.text || ""),
    kanji: String(item.kanji || ""),
    reading: String(item.reading || "")
  };

  SOURCE_FIELDS.forEach((field) => {
    if (item[field] !== undefined && item[field] !== null && item[field] !== "") {
      normalized[field] = String(item[field]);
    }
  });

  return normalized;
}

function clearSourceData(item) {
  SOURCE_FIELDS.forEach((field) => {
    delete item[field];
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(saved.items) && saved.items.length) {
      items = saved.items.slice(0, MAX_ITEMS).map(normalizeItem);
    }
  } catch {}

  if (!items.length) {
    items = [createEmptyItem()];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
}

function getActiveItems() {
  return items.filter((item) => isActiveItem(item) && !getItemError(item));
}

function isActiveItem(item) {
  return item.text.trim() || item.kanji.trim() || item.reading.trim();
}

function getItemError(item) {
  const text = item.text.trim();
  const kanji = item.kanji.trim();
  if (!text || !kanji) return "";
  return text.includes(kanji) ? "" : "問題の漢字が問題文に含まれていません";
}

function splitPages(sourceItems) {
  const pages = [];
  for (let index = 0; index < sourceItems.length; index += ITEMS_PER_PAGE) {
    pages.push(sourceItems.slice(index, index + ITEMS_PER_PAGE));
  }
  return pages.length ? pages : [[]];
}

function updateControls() {
  addButton.disabled = items.length >= MAX_ITEMS;
}

function updateAnswerToggleButton() {
  answerToggleButton.setAttribute("aria-pressed", String(showAnswers));
  answerToggleButton.classList.toggle("is-active", showAnswers);
  answerToggleButton.textContent = showAnswers ? "答え非表示" : "答え表示";
}

function renderEntryInputs() {
  entryList.innerHTML = "";

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "entry-row";

    const number = document.createElement("span");
    number.className = "row-number";
    number.textContent = index + 1;

    const textInput = createInput(item.text, "問題文", 18, (value) => {
      item.text = value;
      clearSourceData(item);
    }, () => updateRowValidation(row, item));
    const kanjiInput = createInput(item.kanji, "問題の漢字", 4, (value) => {
      item.kanji = value;
      clearSourceData(item);
    }, () => updateRowValidation(row, item));
    const readingInput = createInput(item.reading, "よみがな", 12, (value) => {
      item.reading = value;
      clearSourceData(item);
    }, () => updateRowValidation(row, item));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "×";
    deleteButton.title = "削除";
    deleteButton.setAttribute("aria-label", `${index + 1}番の問題を削除`);
    deleteButton.disabled = items.length <= 1;
    deleteButton.addEventListener("click", () => {
      items.splice(index, 1);
      renderEntryInputs();
      updateAll();
    });

    const error = document.createElement("p");
    error.className = "entry-error";
    error.setAttribute("role", "alert");

    row.append(number, textInput, kanjiInput, readingInput, deleteButton, error);
    updateRowValidation(row, item);
    entryList.append(row);
  });

  updateControls();
}

function updateRowValidation(row, item) {
  const error = getItemError(item);
  row.classList.toggle("has-error", Boolean(error));
  const message = row.querySelector(".entry-error");
  if (message) {
    message.textContent = error;
  }
}

function createInput(value, label, maxLength, onChange, onInput) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.maxLength = maxLength;
  input.placeholder = label;
  input.setAttribute("aria-label", label);
  input.addEventListener("input", () => {
    onChange(input.value);
    onInput?.();
    updateAll();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const inputs = Array.from(entryList.querySelectorAll("input"));
    const nextInput = inputs[inputs.indexOf(input) + 1];
    if (nextInput) nextInput.focus();
  });
  return input;
}

function createSheet(pageItems, pageIndex) {
  const printArea = document.createElement("div");
  printArea.className = "print-area";

  const sheet = document.createElement("article");
  sheet.className = "sheet";
  sheet.setAttribute("aria-label", `漢字テスト ${pageIndex + 1}ページ`);
  sheet.append(createSheetHeader(), createQuestionGrid(pageItems, pageIndex));
  printArea.append(sheet);
  return printArea;
}

function createSheetHeader() {
  const header = document.createElement("header");
  header.className = "sheet-header";
  header.innerHTML = `
    <div class="sheet-header-spacer" aria-hidden="true"></div>
    <div class="sheet-date-field" aria-label="日付">
      <span class="sheet-date-value"></span><span>がつ</span>
      <span class="sheet-date-value"></span><span>にち</span>
    </div>
    <div class="sheet-name-field" aria-label="名前">
      <span>なまえ（</span><span class="sheet-name-value"></span><span>）</span>
    </div>
  `;
  return header;
}

function createQuestionGrid(pageItems, pageIndex) {
  const grid = document.createElement("div");
  grid.className = "question-grid";

  for (let i = 0; i < ITEMS_PER_PAGE; i += 1) {
    const item = pageItems[i] || { text: "", kanji: "", reading: "" };
    grid.append(createQuestion(item, pageIndex * ITEMS_PER_PAGE + i + 1));
  }

  return grid;
}

function createQuestion(item, number) {
  const question = document.createElement("section");
  question.className = "question";

  const numberEl = document.createElement("span");
  numberEl.className = "question-number";
  numberEl.textContent = number;

  question.append(numberEl);
  buildSentence(item).forEach((part) => question.append(part));

  return question;
}

function buildSentence(item) {
  const text = item.text.trim();
  const kanji = item.kanji.trim();
  const reading = item.reading.trim();
  const parts = [];

  if (!text && !kanji) {
    parts.push(answerBoxes("", reading));
    return parts;
  }

  const target = kanji || Array.from(text)[0] || "";
  const sourceParts = buildSourceWordSentence(item, text, target, reading);
  if (sourceParts) {
    return sourceParts;
  }

  const index = target ? text.indexOf(target) : -1;

  if (index >= 0) {
    const before = text.slice(0, index);
    const after = text.slice(index + target.length);
    if (before) parts.push(textSpan(before));
    parts.push(answerBoxes(target, reading));
    if (after) parts.push(textSpan(after));
  } else {
    parts.push(answerBoxes(target, reading));
    if (text) parts.push(textSpan(text));
  }

  return parts;
}

function buildSourceWordSentence(item, text, target, reading) {
  const sourceWord = String(item.sourceWord || "").trim();
  const wordReading = String(item.sourceWordReading || "").trim();
  const targetReading = String(item.sourceTargetReading || reading || "").trim();
  if (!text || !target || !sourceWord || !wordReading || !targetReading) return null;

  const wordIndex = text.indexOf(sourceWord);
  const targetIndex = sourceWord.indexOf(target);
  if (wordIndex < 0 || targetIndex < 0) return null;

  const splitReading = splitSourceWordReading(sourceWord, wordReading, target, targetReading);
  if (!splitReading) return null;

  const beforeText = text.slice(0, wordIndex);
  const beforeTarget = sourceWord.slice(0, targetIndex);
  const afterTarget = sourceWord.slice(targetIndex + target.length);
  const afterText = text.slice(wordIndex + sourceWord.length);
  const parts = [];

  appendTextPart(parts, beforeText);
  appendTextPart(parts, beforeTarget, splitReading.before);
  parts.push(answerBoxes(target, reading));
  appendTextPart(parts, afterTarget, splitReading.after);
  appendTextPart(parts, afterText);

  return parts;
}

function splitSourceWordReading(word, wordReading, target, targetReading) {
  const targetIndex = word.indexOf(target);
  const targetEndsWord = targetIndex + target.length === word.length;

  if (targetIndex === 0 && wordReading.startsWith(targetReading)) {
    return {
      before: "",
      after: wordReading.slice(targetReading.length)
    };
  }

  if (targetEndsWord && wordReading.endsWith(targetReading)) {
    return {
      before: wordReading.slice(0, wordReading.length - targetReading.length),
      after: ""
    };
  }

  const readingIndexes = findAllIndexes(wordReading, targetReading);
  if (readingIndexes.length !== 1) return null;

  const [readingIndex] = readingIndexes;
  return {
    before: wordReading.slice(0, readingIndex),
    after: wordReading.slice(readingIndex + targetReading.length)
  };
}

function findAllIndexes(value, search) {
  const indexes = [];
  let index = value.indexOf(search);
  while (index >= 0) {
    indexes.push(index);
    index = value.indexOf(search, index + search.length);
  }
  return indexes;
}

function appendTextPart(parts, value, reading = "") {
  if (!value) return;
  parts.push(reading && containsKanji(value) ? rubyTextSpan(value, reading) : textSpan(value));
}

function containsKanji(value) {
  return /\p{Script=Han}/u.test(value);
}

function textSpan(value) {
  const span = document.createElement("span");
  span.className = "question-text";
  span.textContent = value;
  return span;
}

function rubyTextSpan(value, reading) {
  const wrap = document.createElement("span");
  wrap.className = "ruby-wrap";

  const base = document.createElement("span");
  base.className = "ruby-base";
  base.textContent = value;
  wrap.append(base);

  const ruby = document.createElement("span");
  ruby.className = "word-reading";
  ruby.textContent = reading;
  wrap.append(ruby);

  return wrap;
}

function answerBoxes(target, reading) {
  const wrap = document.createElement("span");
  wrap.className = "answer-wrap";
  const characters = Array.from(String(target || ""));
  const boxCount = Math.max(1, characters.length);
  wrap.style.setProperty("--box-count", boxCount);

  if (reading) {
    const ruby = document.createElement("span");
    ruby.className = "reading";
    ruby.textContent = reading;
    wrap.append(ruby);
  }

  const boxStack = document.createElement("span");
  boxStack.className = "answer-box-stack";
  boxStack.append(createAnswerBoxSvg(characters));
  wrap.append(boxStack);
  return wrap;
}

function createAnswerBoxSvg(characters) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const boxCount = Math.max(1, characters.length);
  const height = boxCount * 100;
  svg.classList.add("answer-box-svg");
  svg.setAttribute("viewBox", `0 0 100 ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", "2");
  rect.setAttribute("y", "2");
  rect.setAttribute("width", "96");
  rect.setAttribute("height", String(height - 4));
  rect.setAttribute("fill", "#ffffff");
  rect.setAttribute("stroke", "#555555");
  rect.setAttribute("stroke-width", "1.8");
  rect.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(rect);

  for (let index = 1; index < boxCount; index += 1) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "2");
    line.setAttribute("x2", "98");
    line.setAttribute("y1", String(index * 100));
    line.setAttribute("y2", String(index * 100));
    line.setAttribute("stroke", "#555555");
    line.setAttribute("stroke-width", "1.8");
    line.setAttribute("stroke-dasharray", "2.5 2.5");
    line.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(line);
  }

  if (showAnswers) {
    characters.forEach((character, index) => {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.classList.add("answer-character");
      text.setAttribute("x", "50");
      text.setAttribute("y", String(index * 100 + 54));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.textContent = character;
      svg.append(text);
    });
  }

  return svg;
}

function renderPreview() {
  const pages = splitPages(getActiveItems());
  previewStage.innerHTML = "";
  printRoot.innerHTML = "";

  pages.forEach((pageItems, pageIndex) => {
    const preview = document.createElement("div");
    preview.className = "sheet-preview";
    preview.append(createSheet(pageItems, pageIndex));
    previewStage.append(preview);

    const printPage = document.createElement("div");
    printPage.className = "print-page";
    printPage.append(createSheet(pageItems, pageIndex));
    printRoot.append(printPage);
  });
}

function updateAll() {
  updateControls();
  renderPreview();
  saveState();
}

function addItem() {
  if (items.length >= MAX_ITEMS) return;
  items.push(createEmptyItem());
  renderEntryInputs();
  updateAll();
  const inputs = entryList.querySelectorAll("input");
  inputs[inputs.length - 3]?.focus();
}

function resetAll() {
  items = [createEmptyItem()];
  showAnswers = false;
  updateAnswerToggleButton();
  renderEntryInputs();
  updateAll();
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function itemsToCsv(sourceItems) {
  const rows = [["問題文", "問題の漢字", "よみがな"]];
  sourceItems.filter(isActiveItem).forEach((item) => {
    rows.push([item.text, item.kanji, item.reading]);
  });
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (character !== "\r") {
      value += character;
    }
  }

  if (inQuotes) {
    throw new Error("引用符が閉じられていません。");
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function isCsvHeader(row) {
  const normalized = row.map((value) => value.trim().toLowerCase());
  return (
    normalized[0] === "問題文" ||
    normalized[0] === "text" ||
    normalized[0] === "example_sentence"
  );
}

function csvRowsToItems(rows) {
  const sourceRows = rows.filter((row) => row.some((value) => value.trim()));
  const dataRows = sourceRows.length && isCsvHeader(sourceRows[0]) ? sourceRows.slice(1) : sourceRows;
  return dataRows
    .slice(0, MAX_ITEMS)
    .map((row) => normalizeItem({
      text: String(row[0] || "").trim(),
      kanji: String(row[1] || "").trim(),
      reading: String(row[2] || "").trim()
    }))
    .filter(isActiveItem);
}

function openCsvDialog() {
  lastFocusedElement = document.activeElement;
  csvMessage.textContent = "";
  csvTextArea.value = itemsToCsv(items);
  csvModal.hidden = false;
  csvTextArea.focus();
  csvTextArea.select();
}

function closeCsvDialog() {
  csvModal.hidden = true;
  csvMessage.textContent = "";
  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }
}

function importCsvItems() {
  try {
    const importedItems = csvRowsToItems(parseCsv(csvTextArea.value));
    if (!importedItems.length) {
      csvMessage.textContent = "取り込める問題がありません。";
      return;
    }

    items = importedItems;
    renderEntryInputs();
    updateAll();
    closeCsvDialog();
  } catch (error) {
    csvMessage.textContent = error instanceof Error ? error.message : "CSVを読み込めませんでした。";
  }
}

function getCsvFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  return `kanji-test-${year}${month}${date}.csv`;
}

function downloadCsvFile() {
  const csv = csvTextArea.value;
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getCsvFileName();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  csvMessage.textContent = "CSVファイルをダウンロードしました。";
}

function openRandomDialog() {
  lastFocusedElement = document.activeElement;
  randomMessage.textContent = "";
  randomModal.hidden = false;
  randomCountInput.focus();
  randomCountInput.select();
}

function closeRandomDialog() {
  randomModal.hidden = true;
  randomMessage.textContent = "";
  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }
}

function getSelectedRandomGrade() {
  const selected = randomModal.querySelector("input[name='randomGrade']:checked");
  return Number(selected?.value || 1);
}

function normalizeRandomCount() {
  const value = Math.trunc(Number(randomCountInput.value));
  const count = Number.isFinite(value) ? value : 24;
  return Math.min(MAX_ITEMS, Math.max(1, count));
}

function getKanjiData() {
  return Array.isArray(window.KANJI_DATA) ? window.KANJI_DATA : [];
}

function createItemFromKanjiEntry(entry) {
  const kanji = String(entry.answer || entry.target_kanji || "");
  const exampleSentence = String(entry.example_sentence || "");
  const word = String(entry.word || "");
  const text = exampleSentence.includes(word) ? exampleSentence : word;
  return normalizeItem({
    text,
    kanji,
    reading: String(entry.question_reading || entry.target_reading || entry.reading || ""),
    sourceWord: word,
    sourceWordReading: String(entry.reading || ""),
    sourceTargetReading: String(entry.target_reading || entry.question_reading || "")
  });
}

function shuffle(array) {
  const result = [...array];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function generateRandomItems() {
  const data = getKanjiData();
  if (!data.length) {
    randomMessage.textContent = "漢字データを読み込めませんでした。";
    return;
  }

  const grade = getSelectedRandomGrade();
  const count = normalizeRandomCount();
  randomCountInput.value = count;

  const candidates = data
    .filter((entry) => Number(entry.grade) === grade)
    .filter((entry) => entry.word && entry.reading && (entry.answer || entry.target_kanji))
    .map(createItemFromKanjiEntry)
    .filter((item) => item.text.includes(item.kanji));

  if (!candidates.length) {
    randomMessage.textContent = `${grade}年の候補がありません。`;
    return;
  }

  items = shuffle(candidates).slice(0, Math.min(count, candidates.length));
  renderEntryInputs();
  updateAll();
  closeRandomDialog();
}

function cleanupPrintMode() {
  document.body.classList.remove("is-printing");
  window.removeEventListener("afterprint", cleanupPrintMode);
  window.removeEventListener("focus", cleanupPrintMode);
}

async function printSheets() {
  document.body.classList.add("is-printing");
  if (document.fonts) {
    await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1200))]);
  }
  window.addEventListener("afterprint", cleanupPrintMode, { once: true });
  window.addEventListener("focus", cleanupPrintMode, { once: true });
  setTimeout(cleanupPrintMode, 10000);
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

addButton.addEventListener("click", addItem);
openRandomButton.addEventListener("click", openRandomDialog);
openDataButton.addEventListener("click", openCsvDialog);
closeRandomButton.addEventListener("click", closeRandomDialog);
cancelRandomButton.addEventListener("click", closeRandomDialog);
generateRandomButton.addEventListener("click", generateRandomItems);
closeCsvButton.addEventListener("click", closeCsvDialog);
cancelCsvButton.addEventListener("click", closeCsvDialog);
importCsvButton.addEventListener("click", importCsvItems);
downloadCsvButton.addEventListener("click", downloadCsvFile);
answerToggleButton.addEventListener("click", () => {
  showAnswers = !showAnswers;
  updateAnswerToggleButton();
  renderPreview();
});
randomModal.addEventListener("click", (event) => {
  if (event.target === randomModal) {
    closeRandomDialog();
  }
});
csvModal.addEventListener("click", (event) => {
  if (event.target === csvModal) {
    closeCsvDialog();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !randomModal.hidden) {
    closeRandomDialog();
  } else if (event.key === "Escape" && !csvModal.hidden) {
    closeCsvDialog();
  }
});
document.getElementById("resetButton").addEventListener("click", resetAll);
document.getElementById("printButton").addEventListener("click", printSheets);

loadState();
updateAnswerToggleButton();
renderEntryInputs();
renderPreview();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

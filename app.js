const MAX_ITEMS = 48;
const ITEMS_PER_PAGE = 24;
const STORAGE_KEY = "kanji-test-maker";
const HISTORY_STORAGE_KEY = "kanji-test-maker-print-history";
const MAX_HISTORY_ITEMS = 100;
const PREVIEW_ZOOM_STEP = 0.08;

const DEFAULT_ITEMS = [
  { text: "", kanji: "", reading: "", sentenceReading: "" }
];

let items = DEFAULT_ITEMS.map((item) => ({ ...item }));

const SOURCE_TEXT_FIELDS = [
  "sourceWord",
  "sourceWordReading",
  "sourceTargetReading"
];

const SOURCE_FIELDS = [
  ...SOURCE_TEXT_FIELDS,
  "sourceTargetSpan",
  "sourceWordSpan",
  "sourceReadingSegments"
];

const entryList = document.getElementById("entryList");
const reorderStatus = document.getElementById("reorderStatus");
const previewStage = document.getElementById("previewStage");
const printRoot = document.getElementById("printRoot");
const addButton = document.getElementById("addButton");
const answerToggleButton = document.getElementById("answerToggleButton");
const openRandomButton = document.getElementById("openRandomButton");
const openKanjiSelectButton = document.getElementById("openKanjiSelectButton");
const openDataButton = document.getElementById("openDataButton");
const openHistoryButton = document.getElementById("openHistoryButton");
const resetButton = document.getElementById("resetButton");
const printButton = document.getElementById("printButton");
const historyModal = document.getElementById("historyModal");
const closeHistoryButton = document.getElementById("closeHistoryButton");
const cancelHistoryButton = document.getElementById("cancelHistoryButton");
const restoreHistoryButton = document.getElementById("restoreHistoryButton");
const historyList = document.getElementById("historyList");
const historyHelp = document.getElementById("historyHelp");
const historyMessage = document.getElementById("historyMessage");
const zoomOutButton = document.getElementById("zoomOutButton");
const zoomInButton = document.getElementById("zoomInButton");
const kanjiSelectModal = document.getElementById("kanjiSelectModal");
const closeKanjiSelectButton = document.getElementById("closeKanjiSelectButton");
const cancelKanjiSelectButton = document.getElementById("cancelKanjiSelectButton");
const kanjiSelectInput = document.getElementById("kanjiSelectInput");
const kanjiSelectMessage = document.getElementById("kanjiSelectMessage");
const kanjiChoiceList = document.getElementById("kanjiChoiceList");
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
let pointerReorder = null;
let selectedHistoryId = null;
let previewZoomSteps = 0;
let previewResizeFrame = 0;

function showModal(modal) {
  lastFocusedElement = document.activeElement;
  modal.hidden = false;
}

function hideModal(modal) {
  modal.hidden = true;
  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

function createEmptyItem() {
  return { text: "", kanji: "", reading: "", sentenceReading: "" };
}

function normalizeItem(item) {
  const normalized = {
    text: String(item.text || ""),
    kanji: String(item.kanji || ""),
    reading: String(item.reading || ""),
    sentenceReading: String(item.sentenceReading || "")
  };

  SOURCE_TEXT_FIELDS.forEach((field) => {
    if (item[field] !== undefined && item[field] !== null && item[field] !== "") {
      normalized[field] = String(item[field]);
    }
  });

  ["sourceTargetSpan", "sourceWordSpan"].forEach((field) => {
    const span = item[field];
    if (span && Number.isInteger(span.start) && Number.isInteger(span.length)) {
      normalized[field] = { start: span.start, length: span.length };
    }
  });

  if (Array.isArray(item.sourceReadingSegments)) {
    normalized.sourceReadingSegments = item.sourceReadingSegments
      .filter((segment) => segment && Number.isInteger(segment.start) && Number.isInteger(segment.length))
      .map((segment) => ({
        start: segment.start,
        length: segment.length,
        reading: String(segment.reading || "")
      }));
  }

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

function loadPrintHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((entry) => entry && typeof entry.id === "string" && Array.isArray(entry.items))
      .slice(0, MAX_HISTORY_ITEMS)
      .map((entry) => ({
        id: entry.id,
        printedAt: String(entry.printedAt || ""),
        items: entry.items.slice(0, MAX_ITEMS).map(normalizeItem).filter(isActiveItem)
      }))
      .filter((entry) => entry.items.length);
  } catch {
    return [];
  }
}

function savePrintHistory(history) {
  const remaining = history.slice(0, MAX_HISTORY_ITEMS);
  while (remaining.length) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(remaining));
      return remaining;
    } catch {
      remaining.pop();
    }
  }

  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {}
  return [];
}

function createHistoryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saveCurrentPrintHistory() {
  const historyItems = items.filter(isActiveItem).map((item) => normalizeItem(item));
  if (!historyItems.length) return;

  const itemSignature = JSON.stringify(historyItems);
  const history = loadPrintHistory().filter((entry) => JSON.stringify(entry.items) !== itemSignature);
  history.unshift({
    id: createHistoryId(),
    printedAt: new Date().toISOString(),
    items: historyItems
  });
  savePrintHistory(history);
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderPrintHistory() {
  const history = loadPrintHistory();
  historyList.innerHTML = "";
  historyHelp.textContent = history.length
    ? `印刷した問題を新しい順に保存しています（${history.length}／${MAX_HISTORY_ITEMS}件）。`
    : `印刷した問題を新しい順に最大${MAX_HISTORY_ITEMS}件保存します。`;

  if (!history.some((entry) => entry.id === selectedHistoryId)) {
    selectedHistoryId = null;
  }
  restoreHistoryButton.disabled = !selectedHistoryId;

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "印刷履歴はまだありません。";
    historyList.append(empty);
    return;
  }

  history.forEach((entry) => {
    const formattedDate = formatHistoryDate(entry.printedAt);
    const row = document.createElement("article");
    row.className = "history-item";
    row.dataset.historyId = entry.id;

    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "history-choice";
    choice.setAttribute("aria-pressed", String(entry.id === selectedHistoryId));

    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = formattedDate;

    const count = document.createElement("span");
    count.className = "history-count";
    count.textContent = `${entry.items.length}問`;

    const preview = document.createElement("span");
    preview.className = "history-preview";
    const previewTexts = entry.items.slice(0, 2).map((item) => item.text.trim()).filter(Boolean);
    preview.textContent = `${previewTexts.join(" ／ ")}${entry.items.length > 2 ? " ほか" : ""}`;

    choice.append(date, count, preview);
    choice.addEventListener("click", () => selectPrintHistory(entry.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "history-delete";
    deleteButton.textContent = "削除";
    deleteButton.setAttribute("aria-label", `${formattedDate}の履歴を削除`);
    deleteButton.addEventListener("click", () => deletePrintHistory(entry.id));

    row.append(choice, deleteButton);
    historyList.append(row);
  });
  updateHistorySelection();
}

function updateHistorySelection() {
  historyList.querySelectorAll(".history-item").forEach((row) => {
    const selected = row.dataset.historyId === selectedHistoryId;
    row.classList.toggle("is-selected", selected);
    row.querySelector(".history-choice")?.setAttribute("aria-pressed", String(selected));
  });
  restoreHistoryButton.disabled = !selectedHistoryId;
}

function selectPrintHistory(id) {
  selectedHistoryId = id;
  historyMessage.textContent = "";
  updateHistorySelection();
}

function deletePrintHistory(id) {
  const history = loadPrintHistory();
  const target = history.find((entry) => entry.id === id);
  savePrintHistory(history.filter((entry) => entry.id !== id));
  if (selectedHistoryId === id) selectedHistoryId = null;
  historyMessage.textContent = target
    ? `${formatHistoryDate(target.printedAt)}の履歴を削除しました。`
    : "";
  renderPrintHistory();
}

function restoreSelectedPrintHistory() {
  const entry = loadPrintHistory().find((historyEntry) => historyEntry.id === selectedHistoryId);
  if (!entry) {
    historyMessage.textContent = "復元する履歴を選択してください。";
    selectedHistoryId = null;
    updateHistorySelection();
    return;
  }

  items = entry.items.map((item) => normalizeItem(item));
  if (!items.length) items = [createEmptyItem()];
  renderEntryInputs();
  updateAll();
  closeHistoryDialog();
}

function openHistoryDialog() {
  selectedHistoryId = null;
  historyMessage.textContent = "";
  renderPrintHistory();
  showModal(historyModal);
  const firstChoice = historyList.querySelector(".history-choice");
  (firstChoice || closeHistoryButton).focus();
}

function closeHistoryDialog() {
  selectedHistoryId = null;
  historyMessage.textContent = "";
  hideModal(historyModal);
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

function getSentenceReadingWarning(item) {
  const sentenceReading = String(item.sentenceReading || "").trim();
  if (!sentenceReading) return "";

  const text = item.text.trim();
  const kanji = item.kanji.trim();
  const reading = item.reading.trim();
  if (!text || !kanji || !reading) {
    return "全文の読みを使うには、問題文・問題の漢字・よみがなを入力してください";
  }

  return getManualReadingParts(item, text, kanji, reading)
    ? ""
    : "全文の読みが問題文と対応していません。内容を確認してください";
}

function shouldOfferSentenceReading(item) {
  if (String(item.sentenceReading || "").trim()) return true;
  if (Array.isArray(item.sourceReadingSegments) && item.sourceReadingSegments.length) return false;

  const text = item.text.trim();
  const kanji = item.kanji.trim();
  if (!text) return false;
  const targetIndex = kanji ? text.indexOf(kanji) : -1;
  const context = targetIndex >= 0
    ? text.slice(0, targetIndex) + text.slice(targetIndex + kanji.length)
    : text;
  return containsKanji(context);
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
  openKanjiSelectButton.disabled = items.length >= MAX_ITEMS && items.every(isActiveItem);
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
    row.dataset.index = index;

    const orderControl = document.createElement("div");
    orderControl.className = "row-order-control";

    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "drag-handle";
    dragHandle.setAttribute("aria-label", `${index + 1}番の問題を並べ替え`);
    dragHandle.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
    dragHandle.title = "ドラッグ、または Alt＋↑／↓ で並べ替え";
    dragHandle.disabled = items.length <= 1;
    dragHandle.addEventListener("pointerdown", (event) => beginPointerReorder(event, index, row, dragHandle));
    dragHandle.addEventListener("pointermove", updatePointerReorder);
    dragHandle.addEventListener("pointerup", finishPointerReorder);
    dragHandle.addEventListener("pointercancel", cancelPointerReorder);
    dragHandle.addEventListener("keydown", (event) => handleReorderKeydown(event, index));

    const number = document.createElement("span");
    number.className = "row-number";
    number.textContent = index + 1;
    orderControl.append(dragHandle, number);

    const textInput = createInput(item.text, "問題文", 18, (value) => {
      item.text = value;
      clearSourceData(item);
    }, () => updateRowValidation(row, item));
    textInput.classList.add("entry-text-input");
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

    const sentenceReadingDetails = document.createElement("details");
    sentenceReadingDetails.className = "sentence-reading-details";
    sentenceReadingDetails.open = Boolean(item.sentenceReading && getSentenceReadingWarning(item));

    const sentenceReadingSummary = document.createElement("summary");
    sentenceReadingSummary.textContent = item.sentenceReading
      ? "全文の読みを編集"
      : "全文の読みを設定（任意）";

    const sentenceReadingInput = createInput(item.sentenceReading, "全文の読み", 40, (value) => {
      item.sentenceReading = value;
      sentenceReadingSummary.textContent = value ? "全文の読みを編集" : "全文の読みを設定（任意）";
    }, () => updateRowValidation(row, item));
    sentenceReadingInput.classList.add("sentence-reading-input");

    const sentenceReadingHint = document.createElement("span");
    sentenceReadingHint.className = "sentence-reading-hint";
    sentenceReadingHint.textContent = "例: ぎんこうにちょきんする";
    sentenceReadingDetails.append(sentenceReadingSummary, sentenceReadingInput, sentenceReadingHint);

    const warning = document.createElement("p");
    warning.className = "entry-warning";
    warning.setAttribute("role", "status");

    row.append(
      orderControl,
      textInput,
      kanjiInput,
      readingInput,
      deleteButton,
      error,
      sentenceReadingDetails,
      warning
    );
    updateRowValidation(row, item);
    entryList.append(row);
  });

  updateControls();
}

function moveItem(sourceIndex, targetIndex, focusHandle = true) {
  if (
    sourceIndex === targetIndex
    || sourceIndex < 0
    || sourceIndex >= items.length
    || targetIndex < 0
    || targetIndex >= items.length
  ) {
    return;
  }

  const [movedItem] = items.splice(sourceIndex, 1);
  items.splice(targetIndex, 0, movedItem);
  renderEntryInputs();
  updateAll();
  reorderStatus.textContent = `${sourceIndex + 1}番の問題を${targetIndex + 1}番へ移動しました。`;

  if (focusHandle) {
    requestAnimationFrame(() => {
      entryList.querySelector(`.entry-row[data-index="${targetIndex}"] .drag-handle`)?.focus();
    });
  }
}

function handleReorderKeydown(event, index) {
  if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
  event.preventDefault();
  const targetIndex = event.key === "ArrowUp"
    ? Math.max(0, index - 1)
    : Math.min(items.length - 1, index + 1);
  moveItem(index, targetIndex);
}

function beginPointerReorder(event, index, row, handle) {
  if (event.button !== 0 || items.length <= 1) return;
  event.preventDefault();
  handle.focus();
  handle.setPointerCapture?.(event.pointerId);
  pointerReorder = {
    pointerId: event.pointerId,
    sourceIndex: index,
    insertionIndex: index,
    startY: event.clientY,
    row,
    handle,
    started: false
  };
}

function updatePointerReorder(event) {
  if (!pointerReorder || event.pointerId !== pointerReorder.pointerId) return;
  if (!pointerReorder.started && Math.abs(event.clientY - pointerReorder.startY) < 5) return;

  if (!pointerReorder.started) {
    pointerReorder.started = true;
    pointerReorder.row.classList.add("is-dragging");
    entryList.classList.add("is-reordering");
    reorderStatus.textContent = `${pointerReorder.sourceIndex + 1}番の問題を移動中です。`;
  }

  event.preventDefault();
  const rows = Array.from(entryList.querySelectorAll(".entry-row"));
  let insertionIndex = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const rect = rows[index].getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
      insertionIndex = index;
      break;
    }
  }

  pointerReorder.insertionIndex = insertionIndex;
  rows.forEach((row) => row.classList.remove("drop-before", "drop-after"));
  if (insertionIndex < rows.length) {
    rows[insertionIndex].classList.add("drop-before");
  } else {
    rows[rows.length - 1]?.classList.add("drop-after");
  }
  autoScrollEntryList(event.clientY);
}

function finishPointerReorder(event) {
  if (!pointerReorder || event.pointerId !== pointerReorder.pointerId) return;
  const state = pointerReorder;
  const targetIndex = state.insertionIndex > state.sourceIndex
    ? state.insertionIndex - 1
    : state.insertionIndex;
  clearPointerReorder();

  if (state.started && targetIndex !== state.sourceIndex) {
    moveItem(state.sourceIndex, Math.max(0, Math.min(items.length - 1, targetIndex)));
  } else {
    state.handle.focus();
  }
}

function cancelPointerReorder(event) {
  if (!pointerReorder || event.pointerId !== pointerReorder.pointerId) return;
  const wasStarted = pointerReorder.started;
  clearPointerReorder();
  if (wasStarted) reorderStatus.textContent = "問題の並べ替えをキャンセルしました。";
}

function clearPointerReorder() {
  if (!pointerReorder) return;
  pointerReorder.row.classList.remove("is-dragging");
  entryList.classList.remove("is-reordering");
  entryList.querySelectorAll(".drop-before, .drop-after").forEach((row) => {
    row.classList.remove("drop-before", "drop-after");
  });
  pointerReorder = null;
}

function autoScrollEntryList(clientY) {
  const controls = entryList.closest(".controls");
  if (controls && controls.scrollHeight > controls.clientHeight + 1) {
    const rect = controls.getBoundingClientRect();
    if (clientY < rect.top + 48) controls.scrollTop -= 14;
    if (clientY > rect.bottom - 48) controls.scrollTop += 14;
    return;
  }

  if (clientY < 48) window.scrollBy(0, -14);
  if (clientY > window.innerHeight - 48) window.scrollBy(0, 14);
}

function updateRowValidation(row, item) {
  const error = getItemError(item);
  const warning = getSentenceReadingWarning(item);
  row.classList.toggle("has-error", Boolean(error));
  row.classList.toggle("has-warning", Boolean(warning));
  const message = row.querySelector(".entry-error");
  if (message) {
    message.textContent = error;
  }
  const warningMessage = row.querySelector(".entry-warning");
  if (warningMessage) {
    warningMessage.textContent = warning;
  }
  const details = row.querySelector(".sentence-reading-details");
  if (details) {
    details.hidden = !shouldOfferSentenceReading(item);
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
  const manualReadingParts = getManualReadingParts(item, text, target, reading);
  if (manualReadingParts) {
    manualReadingParts.forEach((part) => {
      if (part.isTarget) {
        parts.push(answerBoxes(target, reading));
      } else {
        appendTextPart(parts, part.text, part.reading);
      }
    });
    return parts;
  }

  const datasetParts = buildDatasetSentence(item, text, target, reading);
  if (datasetParts) {
    return datasetParts;
  }

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

function getManualReadingParts(item, text, target, targetReading) {
  const sentenceReading = String(item.sentenceReading || "").trim();
  if (!sentenceReading || !text || !target || !targetReading) return null;

  const alignedParts = alignKanjiReadings(text, sentenceReading);
  const targetStringIndex = text.indexOf(target);
  if (!alignedParts || targetStringIndex < 0) return null;

  const targetStart = Array.from(text.slice(0, targetStringIndex)).length;
  const targetLength = Array.from(target).length;
  const targetEnd = targetStart + targetLength;
  const result = [];
  let cursor = 0;
  let renderedTarget = false;

  for (const part of alignedParts) {
    const partLength = Array.from(part.text).length;
    const partEnd = cursor + partLength;
    if (targetEnd <= cursor || targetStart >= partEnd) {
      result.push(part);
    } else {
      if (targetStart < cursor || targetEnd > partEnd || renderedTarget || !part.reading) return null;

      const localTargetStart = targetStart - cursor;
      const beforeTarget = sliceCodePoints(part.text, 0, localTargetStart);
      const afterTarget = sliceCodePoints(part.text, localTargetStart + targetLength, partLength);
      const splitReading = splitSourceWordReading(part.text, part.reading, target, targetReading);
      if (!splitReading) return null;

      if (beforeTarget) result.push({ text: beforeTarget, reading: splitReading.before });
      result.push({ isTarget: true });
      if (afterTarget) result.push({ text: afterTarget, reading: splitReading.after });
      renderedTarget = true;
    }
    cursor = partEnd;
  }

  return renderedTarget ? result : null;
}

function buildDatasetSentence(item, text, target, reading) {
  const segments = item.sourceReadingSegments;
  const targetSpan = item.sourceTargetSpan;
  if (!Array.isArray(segments) || !targetSpan) return null;

  const characters = Array.from(text);
  const targetStart = targetSpan.start;
  const targetEnd = targetStart + targetSpan.length;
  if (
    !Number.isInteger(targetStart)
    || !Number.isInteger(targetSpan.length)
    || targetSpan.length < 1
    || sliceCodePoints(text, targetStart, targetEnd) !== target
  ) {
    return null;
  }

  const parts = [];
  let cursor = 0;
  let renderedTarget = false;

  for (const segment of segments) {
    const segmentStart = segment.start;
    const segmentEnd = segmentStart + segment.length;
    const segmentReading = String(segment.reading || "").trim();
    if (
      segmentStart !== cursor
      || segment.length < 1
      || segmentEnd > characters.length
      || !segmentReading
    ) {
      return null;
    }

    const surface = characters.slice(segmentStart, segmentEnd).join("");
    if (targetEnd <= segmentStart || targetStart >= segmentEnd) {
      appendTextPart(parts, surface, segmentReading);
    } else {
      if (targetStart < segmentStart || targetEnd > segmentEnd || renderedTarget) return null;

      const localTargetStart = targetStart - segmentStart;
      const beforeTarget = Array.from(surface).slice(0, localTargetStart).join("");
      const afterTarget = Array.from(surface).slice(localTargetStart + targetSpan.length).join("");
      const splitReading = splitSourceWordReading(surface, segmentReading, target, reading);
      if (!splitReading) return null;

      appendTextPart(parts, beforeTarget, splitReading.before);
      parts.push(answerBoxes(target, reading));
      appendTextPart(parts, afterTarget, splitReading.after);
      renderedTarget = true;
    }

    cursor = segmentEnd;
  }

  return cursor === characters.length && renderedTarget ? parts : null;
}

function sliceCodePoints(value, start, end) {
  return Array.from(value).slice(start, end).join("");
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
  if (!readingIndexes.length) return null;

  let readingIndex = readingIndexes[0];
  if (readingIndexes.length > 1) {
    const precedingKanjiCount = Array.from(word.slice(0, targetIndex)).filter(containsKanji).length;
    readingIndex = readingIndexes[Math.min(precedingKanjiCount, readingIndexes.length - 1)];
  }
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
  if (!reading || !containsKanji(value)) {
    parts.push(textSpan(value));
    return;
  }

  const alignedParts = alignKanjiReadings(value, reading);
  if (!alignedParts) {
    parts.push(textSpan(value));
    return;
  }

  alignedParts.forEach((part) => {
    parts.push(part.reading ? rubyTextSpan(part.text, part.reading) : textSpan(part.text));
  });
}

function containsKanji(value) {
  return /\p{Script=Han}/u.test(value);
}

function alignKanjiReadings(surface, reading) {
  const tokens = [];
  Array.from(surface).forEach((character) => {
    const isKanji = containsKanji(character);
    const previous = tokens[tokens.length - 1];
    if (previous && previous.isKanji === isKanji) {
      previous.text += character;
    } else {
      tokens.push({ text: character, isKanji });
    }
  });

  const normalizedReading = katakanaToHiragana(reading);
  const memo = new Map();

  function align(tokenIndex, readingIndex) {
    const key = `${tokenIndex}:${readingIndex}`;
    if (memo.has(key)) return memo.get(key);

    if (tokenIndex === tokens.length) {
      return readingIndex === normalizedReading.length ? [] : null;
    }

    const token = tokens[tokenIndex];
    if (!token.isKanji) {
      const expected = katakanaToHiragana(token.text);
      const candidateIndexes = [readingIndex];
      if (tokenIndex === 0 && !normalizedReading.startsWith(expected, readingIndex)) {
        let candidate = normalizedReading.indexOf(expected, readingIndex + 1);
        while (candidate >= 0) {
          candidateIndexes.push(candidate);
          candidate = normalizedReading.indexOf(expected, candidate + 1);
        }
      }

      for (const candidateIndex of candidateIndexes) {
        if (!normalizedReading.startsWith(expected, candidateIndex)) continue;
        const rest = align(tokenIndex + 1, candidateIndex + expected.length);
        if (rest) {
          const result = [{ text: token.text, reading: "" }, ...rest];
          memo.set(key, result);
          return result;
        }
      }

      memo.set(key, null);
      return null;
    }

    for (let end = readingIndex + 1; end <= normalizedReading.length; end += 1) {
      const rest = align(tokenIndex + 1, end);
      if (rest) {
        const result = [{ text: token.text, reading: reading.slice(readingIndex, end) }, ...rest];
        memo.set(key, result);
        return result;
      }
    }

    memo.set(key, null);
    return null;
  }

  return align(0, 0);
}

function katakanaToHiragana(value) {
  return Array.from(value).map((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint >= 0x30A1 && codePoint <= 0x30F6
      ? String.fromCodePoint(codePoint - 0x60)
      : character;
  }).join("");
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

function getPreviewBaseScale() {
  const value = Number(getComputedStyle(previewStage).getPropertyValue("--preview-base-scale"));
  return Number.isFinite(value) && value > 0 ? value : 0.63;
}

function getPreviewMaxScale(baseScale) {
  const paperWidthPx = 210 * 96 / 25.4;
  const availableWidth = Math.max(0, previewStage.clientWidth - 4);
  return Math.max(baseScale, Math.min(1, availableWidth / paperWidthPx));
}

function updatePreviewZoom() {
  const baseScale = getPreviewBaseScale();
  const maxScale = getPreviewMaxScale(baseScale);
  const maxSteps = Math.ceil(Math.max(0, maxScale - baseScale) / PREVIEW_ZOOM_STEP);
  previewZoomSteps = Math.min(previewZoomSteps, maxSteps);
  const desiredScale = baseScale + previewZoomSteps * PREVIEW_ZOOM_STEP;
  const scale = Math.min(maxScale, desiredScale);

  if (previewZoomSteps <= 0) {
    previewZoomSteps = 0;
    previewStage.style.removeProperty("--preview-scale");
    previewStage.style.removeProperty("--preview-w");
    previewStage.style.removeProperty("--preview-h");
  } else {
    previewStage.style.setProperty("--preview-scale", scale.toFixed(4));
    previewStage.style.setProperty("--preview-w", `${(210 * scale).toFixed(3)}mm`);
    previewStage.style.setProperty("--preview-h", `${(297 * scale).toFixed(3)}mm`);
  }

  zoomOutButton.disabled = previewZoomSteps === 0;
  zoomInButton.disabled = scale >= maxScale - 0.001;
}

function zoomPreviewIn() {
  previewZoomSteps += 1;
  updatePreviewZoom();
}

function zoomPreviewOut() {
  previewZoomSteps -= 1;
  updatePreviewZoom();
}

function schedulePreviewZoomUpdate() {
  cancelAnimationFrame(previewResizeFrame);
  previewResizeFrame = requestAnimationFrame(updatePreviewZoom);
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
  const textInputs = entryList.querySelectorAll(".entry-text-input");
  textInputs[textInputs.length - 1]?.focus();
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
  const rows = [["問題文", "問題の漢字", "よみがな", "全文の読み"]];
  sourceItems.filter(isActiveItem).forEach((item) => {
    rows.push([item.text, item.kanji, item.reading, item.sentenceReading || ""]);
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
      reading: String(row[2] || "").trim(),
      sentenceReading: String(row[3] || "").trim()
    }))
    .filter(isActiveItem);
}

function openCsvDialog() {
  csvMessage.textContent = "";
  csvTextArea.value = itemsToCsv(items);
  showModal(csvModal);
  csvTextArea.focus();
  csvTextArea.select();
}

function closeCsvDialog() {
  csvMessage.textContent = "";
  hideModal(csvModal);
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

function openKanjiSelectDialog() {
  showModal(kanjiSelectModal);
  renderKanjiChoices();
  kanjiSelectInput.focus();
  kanjiSelectInput.select();
}

function closeKanjiSelectDialog() {
  kanjiSelectMessage.textContent = "";
  hideModal(kanjiSelectModal);
}

function renderKanjiChoices() {
  const query = kanjiSelectInput.value.trim().normalize("NFC");
  kanjiChoiceList.innerHTML = "";

  if (!query) {
    kanjiSelectMessage.textContent = "漢字を1字入力してください。";
    return;
  }

  if (Array.from(query).length !== 1 || !containsKanji(query)) {
    kanjiSelectMessage.textContent = "検索する漢字を1字に絞ってください。";
    return;
  }

  const choices = getKanjiData().filter((entry) => entry.targetKanji === query);
  if (!choices.length) {
    kanjiSelectMessage.textContent = `「${query}」の例文はありません。`;
    return;
  }

  kanjiSelectMessage.textContent = `「${query}」の例文が${choices.length}件あります。`;
  choices.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kanji-choice-button";

    const sentence = document.createElement("span");
    sentence.className = "kanji-choice-sentence";
    appendHighlightedTarget(sentence, entry);

    const meta = document.createElement("span");
    meta.className = "kanji-choice-meta";
    meta.textContent = `${entry.grade}年・${entry.word}（${entry.wordReading}）`;

    const action = document.createElement("span");
    action.className = "kanji-choice-action";
    action.textContent = "追加する";

    button.append(sentence, meta, action);
    button.addEventListener("click", () => addKanjiChoice(entry));
    kanjiChoiceList.append(button);
  });
}

function appendHighlightedTarget(container, entry) {
  const sentence = String(entry.sentence || "");
  const characters = Array.from(sentence);
  const start = Number(entry.targetSpan?.start);
  const length = Number(entry.targetSpan?.length);
  if (!Number.isInteger(start) || !Number.isInteger(length) || length < 1) {
    container.textContent = sentence;
    return;
  }

  const before = characters.slice(0, start).join("");
  const target = characters.slice(start, start + length).join("");
  const after = characters.slice(start + length).join("");
  container.append(document.createTextNode(before));
  const mark = document.createElement("mark");
  mark.textContent = target;
  container.append(mark, document.createTextNode(after));
}

function addKanjiChoice(entry) {
  const item = createItemFromKanjiEntry(entry);
  const emptyIndex = items.findIndex((current) => !isActiveItem(current));
  if (emptyIndex >= 0) {
    items[emptyIndex] = item;
  } else if (items.length < MAX_ITEMS) {
    items.push(item);
  } else {
    kanjiSelectMessage.textContent = `問題は最大${MAX_ITEMS}問までです。`;
    return;
  }

  renderEntryInputs();
  updateAll();
  closeKanjiSelectDialog();
}

function openRandomDialog() {
  randomMessage.textContent = "";
  showModal(randomModal);
  randomModal.querySelector("input[name='randomGrade']:checked")?.focus();
}

function closeRandomDialog() {
  randomMessage.textContent = "";
  hideModal(randomModal);
}

function getSelectedRandomGrade() {
  const selected = randomModal.querySelector("input[name='randomGrade']:checked");
  return Number(selected?.value || 1);
}

function getSelectedRandomMode() {
  return randomModal.querySelector("input[name='randomMode']:checked")?.value || "replace";
}

function normalizeRandomCount() {
  const value = Math.trunc(Number(randomCountInput.value));
  const count = Number.isFinite(value) ? value : 24;
  return Math.min(MAX_ITEMS, Math.max(1, count));
}

function getKanjiData() {
  const dataset = window.KANJI_WRITING_QUESTION_DATASET;
  if (!dataset || !Array.isArray(dataset.grades)) return [];

  return dataset.grades.flatMap((group) => {
    if (!Array.isArray(group.questions)) return [];
    return group.questions
      .filter((question) => question.isActive)
      .map((question) => ({ ...question, grade: Number(group.grade) }));
  });
}

function createItemFromKanjiEntry(entry) {
  const kanji = String(entry.targetKanji || "");
  const exampleSentence = String(entry.sentence || "");
  const word = String(entry.word || "");
  const text = exampleSentence.includes(word) ? exampleSentence : word;
  return normalizeItem({
    text,
    kanji,
    reading: String(entry.targetReading || ""),
    sourceWord: word,
    sourceWordReading: String(entry.wordReading || ""),
    sourceTargetReading: String(entry.targetReading || ""),
    sourceTargetSpan: entry.targetSpan,
    sourceWordSpan: entry.wordSpan,
    sourceReadingSegments: entry.readingSegments
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
  const mode = getSelectedRandomMode();
  randomCountInput.value = count;

  const candidates = data
    .filter((entry) => Number(entry.grade) === grade)
    .filter((entry) => entry.word && entry.wordReading && entry.targetKanji)
    .map(createItemFromKanjiEntry)
    .filter((item) => item.text.includes(item.kanji));

  if (!candidates.length) {
    randomMessage.textContent = `${grade}年の候補がありません。`;
    return;
  }

  const availableCount = mode === "append"
    ? MAX_ITEMS - items.filter(isActiveItem).length
    : MAX_ITEMS;
  if (availableCount <= 0) {
    randomMessage.textContent = `問題は最大${MAX_ITEMS}問までです。`;
    return;
  }

  const generatedItems = shuffle(candidates)
    .slice(0, Math.min(count, candidates.length, availableCount));

  if (mode === "append") {
    generatedItems.forEach((item) => {
      const emptyIndex = items.findIndex((current) => !isActiveItem(current));
      if (emptyIndex >= 0) {
        items[emptyIndex] = item;
      } else {
        items.push(item);
      }
    });
  } else {
    items = generatedItems;
  }
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
  saveCurrentPrintHistory();
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
openKanjiSelectButton.addEventListener("click", openKanjiSelectDialog);
openRandomButton.addEventListener("click", openRandomDialog);
openDataButton.addEventListener("click", openCsvDialog);
openHistoryButton.addEventListener("click", openHistoryDialog);
closeHistoryButton.addEventListener("click", closeHistoryDialog);
cancelHistoryButton.addEventListener("click", closeHistoryDialog);
restoreHistoryButton.addEventListener("click", restoreSelectedPrintHistory);
zoomInButton.addEventListener("click", zoomPreviewIn);
zoomOutButton.addEventListener("click", zoomPreviewOut);
closeKanjiSelectButton.addEventListener("click", closeKanjiSelectDialog);
cancelKanjiSelectButton.addEventListener("click", closeKanjiSelectDialog);
kanjiSelectInput.addEventListener("input", renderKanjiChoices);
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
const modalDialogs = [
  [historyModal, closeHistoryDialog],
  [kanjiSelectModal, closeKanjiSelectDialog],
  [randomModal, closeRandomDialog],
  [csvModal, closeCsvDialog]
];

modalDialogs.forEach(([modal, closeDialog]) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeDialog();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  modalDialogs.find(([modal]) => !modal.hidden)?.[1]();
});
resetButton.addEventListener("click", resetAll);
printButton.addEventListener("click", printSheets);
window.addEventListener("resize", schedulePreviewZoomUpdate);

loadState();
updateAnswerToggleButton();
renderEntryInputs();
renderPreview();
updatePreviewZoom();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

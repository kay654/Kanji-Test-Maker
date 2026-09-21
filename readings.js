// Shared by manual input, presets, and dataset validation.
(function (root) {
"use strict";
function getManualReadingParts(item, text, target, targetReading) {
  const sentenceReading = String(item.sentenceReading || "").trim();
  if (!sentenceReading || !text || !target || !targetReading) return null;
  const targetIndex = text.indexOf(target);
  if (targetIndex < 0) return null;
  const before = text.slice(0, targetIndex);
  const after = text.slice(targetIndex + target.length);
  const normalized = katakanaToHiragana(sentenceReading);
  const expected = katakanaToHiragana(targetReading);
  // Anchor alignment on the known answer reading before splitting surrounding words.
  // This distinguishes 五つ（いつ・つ） and 弟と（おとうと・と） correctly.
  for (const index of findAllIndexes(normalized, expected)) {
    const beforeParts = alignKanjiReadings(before, sentenceReading.slice(0, index));
    if (!beforeParts) continue;
    const afterParts = alignKanjiReadings(after, sentenceReading.slice(index + expected.length));
    if (afterParts) return [...beforeParts, { isTarget: true }, ...afterParts];
  }
  return null;
}

function sliceCodePoints(value, start, end) {
  return Array.from(value).slice(start, end).join("");
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

function containsKanji(value) {
  return /\p{Script=Han}/u.test(value);
}

function alignKanjiReadings(surface, reading) {
  const literalKanjiRuns = Array.from(reading.matchAll(/\p{Script=Han}+/gu));
  if (!literalKanjiRuns.length) {
    return alignKanjiReadingSegment(surface, reading);
  }

  function alignFrom(runIndex, surfaceIndex, readingIndex) {
    if (runIndex >= literalKanjiRuns.length) {
      return alignKanjiReadingSegment(surface.slice(surfaceIndex), reading.slice(readingIndex));
    }

    const run = literalKanjiRuns[runIndex];
    const literal = run[0];
    const beforeReading = reading.slice(readingIndex, run.index);
    let literalIndex = surface.indexOf(literal, surfaceIndex);

    while (literalIndex >= 0) {
      const beforeSurface = surface.slice(surfaceIndex, literalIndex);
      const beforeParts = alignKanjiReadingSegment(beforeSurface, beforeReading);
      if (beforeParts) {
        const rest = alignFrom(runIndex + 1, literalIndex + literal.length, run.index + literal.length);
        if (rest) {
          return [...beforeParts, { text: literal, reading: "" }, ...rest];
        }
      }
      literalIndex = surface.indexOf(literal, literalIndex + literal.length);
    }

    return null;
  }

  return alignFrom(0, 0, 0);
}

function alignKanjiReadingSegment(surface, reading) {
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
      if (normalizedReading.startsWith(expected, readingIndex)) {
        const rest = align(tokenIndex + 1, readingIndex + expected.length);
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
      if (!/^[ぁ-ゖー]+$/u.test(normalizedReading.slice(readingIndex, end))) continue;
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
const api = {getManualReadingParts,sliceCodePoints,findAllIndexes,containsKanji,alignKanjiReadings,alignKanjiReadingSegment,katakanaToHiragana};
if (typeof module === "object" && module.exports) module.exports = api;
else root.KanjiReadings = api;
})(globalThis);

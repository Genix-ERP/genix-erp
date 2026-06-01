// sortLines.js
//
// ONE rule for ordering estimate-line arrays anywhere in the construction
// module. Adopted after a week of case-by-case fixes that each undid
// part of the previous one:
//
//   1. Items the user added manually go to the TOP of the list.
//      "Manual" = is_manual === true   (migration 417 flag)
//                OR   no item_number   (top-level "+ Ish" doesn't assign one)
//
//   2. Imported items (everything else) come AFTER, in printed-page order
//      (item_number natural-ASC, so "1" < "2" < "10").
//
//   3. Within each bucket:
//        • If both rows have an item_number → sort natural-ASC. This keeps
//          sub-stages 1-1, 1-2, 1-3 in the order the user expects to read
//          them, even when they're all manual.
//        • Otherwise → id-DESC (newest first), so a freshly added row is
//          the very first thing the user sees.
//
// Apply to: subByParent (sub-lines of one parent), subResourcesByWork
// (same on the Bosqichlar side), the top-level work list inside a
// section, and the stage's directWorks list. Higher-level groupings
// (sub-section bucket order, top-level section order, stages-within-
// block order) keep their own logic — they use a different "manual"
// detector (recently-added section ids in localStorage) and shouldn't
// flow through here.

const naturalKey = (s) => String(s || '').trim();

const isManualLine = (ln) =>
  ln?.is_manual === true || !naturalKey(ln?.item_number);

export function sortLinesManualFirst(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return arr;
  const out = arr.slice();
  out.sort((a, b) => {
    const aM = isManualLine(a);
    const bM = isManualLine(b);
    if (aM !== bM) return aM ? -1 : 1; // manuals come first

    const ia = naturalKey(a.item_number);
    const ib = naturalKey(b.item_number);
    if (ia && ib) {
      const c = ia.localeCompare(ib, undefined, { numeric: true, sensitivity: 'base' });
      if (c !== 0) return c;
    } else if (ia && !ib) {
      // Inside the manual bucket only — favour rows that DO carry an
      // item_number (e.g. an auto-assigned "1-2") over ones that don't.
      return -1;
    } else if (!ia && ib) {
      return 1;
    }
    // Tiebreaker — newest first for manuals (so "+ Ish" lands at top),
    // oldest first for imports (printed-page order).
    return aM
      ? Number(b.id || 0) - Number(a.id || 0)
      : Number(a.id || 0) - Number(b.id || 0);
  });
  return out;
}

// In-place sort variant — handy when the caller built the array in a
// loop and wants to keep the same reference (e.g. subByParent map values).
export function sortLinesManualFirstInPlace(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return arr;
  const sorted = sortLinesManualFirst(arr);
  arr.length = 0;
  arr.push(...sorted);
  return arr;
}

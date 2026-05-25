// naturalSort.js
//
// "Natural" string comparison — the kind where "block 10" sorts AFTER
// "block 2", not after "block 1" as plain lexicographic compare would have
// it. Used across the construction module to keep the per-building tab row
// ("block 1 / block 2 / block 3 …") in an order that matches human
// expectation instead of the backend's ORDER BY (which defaults to
// sort_order → code and produces the wrong visual order when sort_order is
// all-zero and code doesn't match the display name).
//
// Implemented on top of the browser-native `Intl.Collator` with the
// `numeric` option, which handles:
//   "block 1" < "block 2" < "block 10" < "block 11"          ✓
//   "Section A-12" < "Section A-102"                         ✓
//   "Annex" < "block 1" (digits-less names still compare)    ✓
//
// Case-insensitive (`sensitivity: 'base'`) so "Block 1" and "block 1" are
// treated equally in the tiebreak.

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function naturalCompare(a, b) {
  return collator.compare(String(a ?? ''), String(b ?? ''));
}

// Sort helper for the building array returned by
// `constructionService.listBuildings`. `keyFn` picks the string to compare;
// defaults to the same fallback chain used by the tab labels
// (`name || code || #id`) so the pill order matches what's rendered.
export function sortBuildings(
  buildings,
  keyFn = (b) => b?.name || b?.code || `#${b?.id ?? ''}`,
) {
  return [...(buildings || [])].sort((a, b) => naturalCompare(keyFn(a), keyFn(b)));
}

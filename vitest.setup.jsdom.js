// Node 22+ reserves a `localStorage` global (undefined without
// --experimental-webstorage), so vitest's jsdom environment skips copying
// jsdom's real implementation onto globalThis. Wire it up explicitly.
if (globalThis.jsdom?.window) {
  const { window } = globalThis.jsdom
  for (const key of ['localStorage', 'sessionStorage']) {
    if (window[key] && globalThis[key] !== window[key]) {
      Object.defineProperty(globalThis, key, {
        value: window[key],
        writable: true,
        configurable: true,
      })
    }
  }
}

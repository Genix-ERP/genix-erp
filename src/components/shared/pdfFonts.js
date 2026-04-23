// Loads Unicode fonts into jsPDF so Cyrillic / Latin-extended render correctly.
// Without this, jsPDF falls back to Helvetica which has no Cyrillic glyphs and
// produces garbage like "* + + \" 1 5 2 . 1 2 - 8".

let fontsPromise = null;
let cachedFonts = null; // { regular, bold } base64 — populated after preload resolves

const toBase64 = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize)
    );
  }
  return btoa(binary);
};

const loadFontBase64 = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load font: ${url} (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  return toBase64(buf);
};

const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      loadFontBase64("/fonts/Roboto-Regular.ttf"),
      loadFontBase64("/fonts/Roboto-Bold.ttf"),
    ])
      .then(([regular, bold]) => {
        cachedFonts = { regular, bold };
        return cachedFonts;
      })
      .catch((err) => {
        // Reset so a later attempt can retry.
        fontsPromise = null;
        throw err;
      });
  }
  return fontsPromise;
};

// Pre-warm font cache so that the first PDF render is instant. Safe to call
// multiple times. We kick this off when any PDF-related module imports us.
export const preloadPdfFonts = () => {
  try {
    loadFonts().catch(() => {
      /* handled on real use */
    });
  } catch (e) {
    // Non-fatal.
  }
};

// Wait until fonts are loaded. Call this before generating a PDF if you want
// to guarantee the first render uses Unicode fonts. For subsequent renders the
// cache is warm and registerPdfFontsSync() is sufficient.
export const ensurePdfFonts = () => loadFonts();

// Register Roboto Regular + Bold into a jsPDF document and set it as default.
// If the cache isn't primed yet, this is a no-op and jsPDF keeps its default
// Helvetica font (which renders Latin correctly but breaks on Cyrillic).
// Callers that must have Cyrillic should `await ensurePdfFonts()` first.
export const registerPdfFontsSync = (doc) => {
  if (!cachedFonts) return false;
  doc.addFileToVFS("Roboto-Regular.ttf", cachedFonts.regular);
  doc.addFileToVFS("Roboto-Bold.ttf", cachedFonts.bold);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");
  return true;
};

// Start loading immediately on import so the fonts are usually ready by the
// time the user clicks "Chop etish".
preloadPdfFonts();

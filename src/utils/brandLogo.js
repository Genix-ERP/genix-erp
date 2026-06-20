// Intentionally not prefixed with `genix_` — login-page brand assets must
// survive logout, while AuthContext clears all `genix_*` keys on sign-out.
export const PUBLIC_LOGO_STORAGE_KEY = 'brand_logo_url';
export const PUBLIC_FAVICON_STORAGE_KEY = 'brand_favicon_url';
export const PUBLIC_TITLE_STORAGE_KEY = 'brand_title';
export const FALLBACK_LOGO_URL = '/genix-logo.png';
export const FALLBACK_FAVICON_URL = '/favicon.png';
export const DEFAULT_BROWSER_TITLE = 'Genix';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

function getApiOrigin() {
  try {
    return new URL(API_URL).origin;
  } catch {
    return '';
  }
}

const API_ORIGIN = getApiOrigin();

// Resolves a stored brand-asset path into a renderable URL, falling back to
// `fallback` when nothing custom is set. An uploaded `/api/...` URL is resolved
// against the API origin so the browser fetches it from the backend (not the
// Vite dev server); absolute and data URLs pass through untouched.
function resolveAssetUrl(url, fallback) {
  if (!url || typeof url !== 'string') return fallback;
  if (url.startsWith('data:') || /^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api/')) return `${API_ORIGIN}${url}`;
  return url;
}

export function resolveBrandLogoUrl(url) {
  return resolveAssetUrl(url, FALLBACK_LOGO_URL);
}

export function resolveBrandFaviconUrl(url) {
  return resolveAssetUrl(url, FALLBACK_FAVICON_URL);
}

function readStored(key) {
  try {
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function readStoredBrandLogo() {
  return readStored(PUBLIC_LOGO_STORAGE_KEY);
}

export function writeStoredBrandLogo(url) {
  writeStored(PUBLIC_LOGO_STORAGE_KEY, url);
}

export function readStoredFavicon() {
  return readStored(PUBLIC_FAVICON_STORAGE_KEY);
}

export function writeStoredFavicon(url) {
  writeStored(PUBLIC_FAVICON_STORAGE_KEY, url);
}

export function readStoredTitle() {
  return readStored(PUBLIC_TITLE_STORAGE_KEY);
}

export function writeStoredTitle(title) {
  writeStored(PUBLIC_TITLE_STORAGE_KEY, title);
}

// Side-effect helpers that push branding to the live document. Both accept the
// raw stored value (or null) and apply the resolved/fallback result.
export function applyFavicon(url) {
  if (typeof document === 'undefined') return;
  const href = resolveBrandFaviconUrl(url);
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

export function applyBrowserTitle(title) {
  if (typeof document === 'undefined') return;
  const trimmed = typeof title === 'string' ? title.trim() : '';
  document.title = trimmed || DEFAULT_BROWSER_TITLE;
}

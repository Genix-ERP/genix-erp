// Intentionally not prefixed with `genix_` — login-page brand asset must
// survive logout, while AuthContext clears all `genix_*` keys on sign-out.
export const PUBLIC_LOGO_STORAGE_KEY = 'brand_logo_url';
export const FALLBACK_LOGO_URL = '/genix-logo.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

function getApiOrigin() {
  try {
    return new URL(API_URL).origin;
  } catch {
    return '';
  }
}

const API_ORIGIN = getApiOrigin();

// Resolves the input into a renderable URL. Returns FALLBACK_LOGO_URL when no
// custom logo is set. Uploaded URL is resolved with the API origin so the
// browser fetches it from the backend (not the Vite dev server).
export function resolveBrandLogoUrl(url) {
  if (!url || typeof url !== 'string') return FALLBACK_LOGO_URL;
  if (url.startsWith('data:') || /^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api/')) return `${API_ORIGIN}${url}`;
  return url;
}

export function readStoredBrandLogo() {
  try {
    return localStorage.getItem(PUBLIC_LOGO_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function writeStoredBrandLogo(url) {
  try {
    if (url) localStorage.setItem(PUBLIC_LOGO_STORAGE_KEY, url);
    else localStorage.removeItem(PUBLIC_LOGO_STORAGE_KEY);
  } catch {
    // ignore quota / privacy-mode errors
  }
}

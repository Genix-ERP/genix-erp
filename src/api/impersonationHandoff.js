import { setTokens, clearTokens } from '@/api/client';

// Receiving a support session from the control plane.
//
// The admin panel is a separate site now, so an impersonation token has to
// cross an origin boundary to get here. It arrives in the URL FRAGMENT:
//
//     https://app.genixerp.com/#impersonate=<token>
//
// A fragment is never sent to the server, so the token stays out of access
// logs, out of the Referer header, and out of any proxy in between. A query
// string would have put a live credential into all three.
//
// Called once, before the app mounts.
export function consumeImpersonationHandoff() {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#impersonate=')) return false;

  const token = decodeURIComponent(hash.slice('#impersonate='.length));
  // Strip it immediately, whatever happens next. Leaving it in the address bar
  // means it survives a copy-pasted link, a screenshot, and the browser's own
  // history — and it is a credential for someone else's company.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  if (!token || token.split('.').length !== 3) return false;

  // Any existing session is replaced, not merged. Landing in a support session
  // while still holding your own tokens is how a refresh silently swaps you
  // back to your own account halfway through looking at someone else's data.
  //
  // No refresh token is stored on purpose: the impersonation token is
  // deliberately short-lived, and a support session that renews itself
  // indefinitely is not a support session.
  clearTokens();
  setTokens(token, null);
  return true;
}

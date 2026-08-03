// The backend has two error envelopes: the standard
// {success:false, error:{code, message}} from pkg/response, and a few legacy
// handlers that send {"error": "plain string"}. `data.error` is therefore an
// OBJECT on most endpoints — rendering it (or passing it to toast) crashes
// React with "Objects are not valid as a React child". Always go through this
// helper instead of `err?.response?.data?.error`.
export function getApiErrorMessage(err, fallback = 'Xatolik yuz berdi') {
  const apiError = err?.response?.data?.error;
  const message =
    (typeof apiError === 'string' ? apiError : apiError?.message) ||
    err?.response?.data?.message ||
    err?.message;
  return typeof message === 'string' && message ? message : fallback;
}

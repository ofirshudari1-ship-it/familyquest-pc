// Electron wraps a thrown IPC handler error as:
//   Error invoking remote method '<channel>': Error: <original message>
// The channel names in this app are colon-namespaced (e.g. "sessions:redeem"),
// so a naive "match up to the first colon" strip leaves the wrapper text intact.
// Stripping through the LAST "Error: " instead is robust regardless of how many
// colons appear earlier in the string.
export function ipcErrorMessage(e: unknown, fallback = 'שגיאה'): string {
  const raw = (e as { message?: string })?.message;
  if (!raw) return fallback;
  return raw.replace(/.*Error:\s*/, '') || fallback;
}

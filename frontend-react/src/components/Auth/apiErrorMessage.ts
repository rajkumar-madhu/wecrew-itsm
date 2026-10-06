/** Pull the API's `{ error }` message out of an axios failure. */
export default function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: { error?: unknown; details?: { msg?: string }[] } } };
  if (e?.response?.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  const data = e?.response?.data;
  // express-validator failures carry the useful text in details[].msg.
  if (Array.isArray(data?.details) && data.details[0]?.msg && data.details[0].msg !== 'Invalid value') {
    return data.details[0].msg;
  }
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

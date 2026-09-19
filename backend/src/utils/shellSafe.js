// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Allowlists for values interpolated into shell commands
//
// k8sService / apmService build `ssh ... "kubectl ..."` strings for exec().
// Inside those double quotes `$(...)` and backticks still expand LOCALLY, on
// the API pod — so any request-supplied namespace/pod/label, or tenant-set
// host/user/port, is remote code execution unless it matches a strict
// allowlist. Validate; never escape. A failure throws with `clientMessage`,
// which the K8s controllers already surface as a safe, generic error.
// ═══════════════════════════════════════════════════════════

function reject(field) {
  const err = new Error(`Unsafe value for ${field}`);
  err.clientMessage = `Invalid ${field}.`;
  err.statusCode = 400;
  return err;
}

const RE = {
  host: /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$|^[0-9A-Fa-f:]{2,39}$/,
  user: /^[a-z_][a-z0-9_-]{0,31}$/,
  k8sName: /^[a-z0-9](?:[-a-z0-9.]{0,251}[a-z0-9])?$/, // DNS-1123 (namespaces, pods, containers)
  label: /^[A-Za-z_][A-Za-z0-9_]{0,127}$/,             // Prometheus/Loki label name
  digits: /^\d{1,20}$/,
  urlPath: /^\/[A-Za-z0-9/_.~%:,=&?-]*$/,              // no quotes, spaces, $, `, ;, |, (, )
  token: /^[A-Za-z0-9_.=+/:-]{1,512}$/,
};

function safeHost(v, field = 'serverIp') {
  if (typeof v !== 'string' || v.length > 253 || !RE.host.test(v)) throw reject(field);
  return v;
}
function safeUser(v, field = 'sshUser') {
  if (typeof v !== 'string' || !RE.user.test(v)) throw reject(field);
  return v;
}
function safePort(v, field = 'port') {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw reject(field);
  return n;
}
function safeInt(v, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw reject(field);
  return n;
}
function safeK8sName(v, field = 'namespace') {
  if (typeof v !== 'string' || !RE.k8sName.test(v)) throw reject(field);
  return v;
}
function safeLabel(v, field = 'label') {
  if (typeof v !== 'string' || !RE.label.test(v)) throw reject(field);
  return v;
}
function safeDigits(v, field) {
  if (!RE.digits.test(String(v))) throw reject(field);
  return String(v);
}
function safeUrlPath(v, field = 'apiPath') {
  if (typeof v !== 'string' || !RE.urlPath.test(v)) throw reject(field);
  return v;
}
function safeToken(v, field = 'apiKey') {
  if (typeof v !== 'string' || !RE.token.test(v)) throw reject(field);
  return v;
}

module.exports = {
  safeHost, safeUser, safePort, safeInt, safeK8sName, safeLabel, safeDigits, safeUrlPath, safeToken,
};

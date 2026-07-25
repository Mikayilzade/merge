export function safeParse(raw, fallback = null) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

export function readJsonStorage(key, fallback = null) {
  try {
    const raw = globalThis.localStorage?.getItem?.(key);
    return raw == null ? fallback : safeParse(raw, fallback);
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(key, value) {
  try {
    globalThis.localStorage?.setItem?.(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function cloneJson(value) {
  return value == null ? value : safeParse(JSON.stringify(value), value);
}

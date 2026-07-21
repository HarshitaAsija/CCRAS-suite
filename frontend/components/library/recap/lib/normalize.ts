// Normalizes the many shapes `authors`/`keywords` can take from the DB into a clean string[].
//
// Confirmed shapes in production data (via `SELECT jsonb_typeof(...), COUNT(*) ...`):
//   - array of objects   e.g. [{"name": "Larry Bull"}, ...]
//   - array of strings   e.g. ["Larry Bull", "John Doe"]
//   - empty array        []
//   - scalar string       — this bucket has (at least) two different sub-shapes:
//       (a) double-encoded JSON: a JSON string whose content is itself a JSON
//           array of Python dict-repr strings, e.g. one JSON.parse yields the
//           text `["{'name': 'Philip Cornford', 'institution': None}", ...]`,
//           which needs a second JSON.parse, and then each element needs
//           regex extraction since it's Python repr (single quotes, None),
//           not valid JSON.
//       (b) a genuinely plain, comma-joined string, e.g. "Larry Bull, John Doe"
//           — never valid JSON at all.
//   - null
//
// Strategy: try to JSON.parse up to a few times (handles the clean array
// shapes and the double-encoded shape). The moment JSON.parse fails, that's
// the signal it was never JSON — fall back to a comma split for that case.

function extractNameFromPyDictLike(s: string): string | null {
  const match = s.match(/'name'\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
  if (!match) return null;
  return match[1].slice(1, -1).replace(/\\(['"])/g, "$1");
}

function unwrapJson(raw: unknown): { value: unknown; everParsed: boolean } {
  let value = raw;
  let everParsed = false;
  for (let i = 0; i < 3 && typeof value === "string"; i++) {
    try {
      value = JSON.parse(value as string);
      everParsed = true;
    } catch {
      break;
    }
  }
  return { value, everParsed };
}

function elementToName(el: unknown): string {
  if (el == null) return "";
  if (typeof el === "object") return (el as any).name ?? "";
  if (typeof el === "string") {
    const trimmed = el.trim();
    if (trimmed.startsWith("{")) return extractNameFromPyDictLike(trimmed) ?? trimmed;
    return trimmed;
  }
  return String(el);
}

export function normalizeAuthors(raw: unknown): string[] {
  if (raw == null) return [];

  const { value, everParsed } = unwrapJson(raw);

  if (Array.isArray(value)) {
    return value.map(elementToName).map((s) => s.trim()).filter(Boolean);
  }

  if (typeof value === "object" && value && "name" in (value as any)) {
    const name = (value as any).name;
    return name ? [String(name).trim()] : [];
  }

  if (typeof value === "string") {
    // Never became valid JSON (or JSON.parse succeeded but just returned a
    // plain string, e.g. a single unquoted name) — treat as a plain,
    // possibly comma-joined list.
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }

  return [];
}

export function normalizeKeywords(raw: unknown): string[] {
  if (raw == null) return [];

  const { value } = unwrapJson(raw);

  if (Array.isArray(value)) {
    return value.map(elementToName).map((s) => s.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }

  return [];
}
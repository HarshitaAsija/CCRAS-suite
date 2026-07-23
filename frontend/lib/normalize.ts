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

  const { value } = unwrapJson(raw);

  if (Array.isArray(value)) {
    return value.map(elementToName).map((s) => s.trim()).filter(Boolean);
  }

  if (typeof value === "object" && value && "name" in (value as any)) {
    const name = (value as any).name;
    return name ? [String(name).trim()] : [];
  }

  if (typeof value === "string") {
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

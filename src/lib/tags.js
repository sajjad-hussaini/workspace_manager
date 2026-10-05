export function normalizeTag(tag) {
  return String(tag ?? "").trim().replace(/^#+\s*/, "").trim();
}

export function parseTags(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map(normalizeTag)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function tagsMatchSearch(tags, query) {
  const term = normalizeTag(query).toLowerCase();
  return Boolean(term) && parseTags(tags).some((tag) => tag.toLowerCase() === term);
}

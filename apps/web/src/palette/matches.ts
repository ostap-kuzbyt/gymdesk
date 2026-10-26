export function matchesQuery(label: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = label.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

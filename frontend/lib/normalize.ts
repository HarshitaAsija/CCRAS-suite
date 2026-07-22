export function normalizeAuthors(authors: string[] | string): string {
  if (typeof authors === 'string') {
    return authors;
  }
  if (Array.isArray(authors)) {
    return authors.join(', ');
  }
  return '';
}

export function normalizeKeywords(keywords: string[] | string): string {
  if (typeof keywords === 'string') {
    return keywords;
  }
  if (Array.isArray(keywords)) {
    return keywords.join(', ');
  }
  return '';
}
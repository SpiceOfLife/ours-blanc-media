// Amazon Associates. PA-API 5 was retired in 2026 (successor: Creators API, which unlocks after qualifying sales).
// Until Creators API credentials exist we use tagged search-result text links, which the Associates program permits.
export function amazonSearchUrl(query) {
  const tag = process.env.AMAZON_ASSOCIATE_TAG;
  if (!tag) return undefined;
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}&tag=${encodeURIComponent(tag)}`;
}

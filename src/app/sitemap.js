export default function sitemap() {
  const base = 'https://northbooks.ca';
  const now = new Date().toISOString();

  const marketingPages = [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1.0 },
    { url: `${base}/features`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/about`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/blog`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ].map((page) => ({ ...page, lastModified: now }));

  return marketingPages;
}

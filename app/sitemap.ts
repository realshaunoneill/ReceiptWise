import type { MetadataRoute } from 'next';

// A fixed date, bumped by hand when the public pages change. `new Date()` stamped every page as
// modified on every build, which teaches crawlers to ignore lastModified.
const LAST_MODIFIED = new Date('2026-09-29');

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.receiptwise.io';

  // Public routes that should be indexed
  const routes = [
    { path: '', changeFreq: 'weekly' as const, priority: 1 },
    { path: '/support', changeFreq: 'monthly' as const, priority: 0.7 },
    { path: '/privacy', changeFreq: 'monthly' as const, priority: 0.5 },
    { path: '/terms', changeFreq: 'monthly' as const, priority: 0.5 },
    { path: '/refund', changeFreq: 'monthly' as const, priority: 0.5 },
    { path: '/sign-up', changeFreq: 'monthly' as const, priority: 0.6 },
  ].map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: route.changeFreq,
    priority: route.priority,
  }));

  return routes;
}

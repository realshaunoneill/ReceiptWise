import { initAnalytics } from '@/lib/analytics/consent';

// PostHog only starts for visitors who have accepted analytics in the consent banner; everyone
// else gets no PostHog cookies, events or session replay. See lib/analytics/consent.ts.
initAnalytics();

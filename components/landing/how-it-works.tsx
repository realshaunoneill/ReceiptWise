'use client';

import { Camera, ScanLine, Users } from 'lucide-react';
import { SectionLabel } from '@/components/layout/section-label';

/**
 * Replaces the previous testimonials/social-proof section.
 *
 * The old version shipped invented users, an invented rating and invented usage stats.
 * Until there are real customers willing to be quoted, this section explains the product
 * instead of inventing proof for it. Add real, permissioned testimonials here.
 */

const steps = [
  {
    icon: Camera,
    step: '01',
    title: 'Snap or upload',
    description:
      'Photograph a paper receipt, upload a PDF or screenshot, or clip an online receipt straight from your browser with the Chrome extension.',
  },
  {
    // Was a Sparkles icon. A scan line says "this is being read" without the
    // fairy dust that every AI feature in every app is decorated with.
    icon: ScanLine,
    step: '02',
    title: 'It gets read',
    description:
      'Merchant, date, total, tax and every line item are extracted automatically and sorted into a spending category. No manual typing.',
  },
  {
    icon: Users,
    step: '03',
    title: 'Everyone sees it',
    description:
      'Receipts land in your shared household, so a partner, family or roommates all see the same picture of what was spent and by whom.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-t px-4 py-20"
      aria-labelledby="how-it-works-title"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-2xl">
          <SectionLabel index="03">How it works</SectionLabel>
          <h2
            id="how-it-works-title"
            className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Three steps, then it&apos;s automatic
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From a crumpled receipt in your pocket to a shared, searchable spending
            history — without a spreadsheet in sight.
          </p>
        </div>

        <ol className="grid gap-10 md:grid-cols-3">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.step} className="border-t-2 border-primary/25 pt-6">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-primary" aria-hidden="true">
                    {item.step}
                  </span>
                  <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

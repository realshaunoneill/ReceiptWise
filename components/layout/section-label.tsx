import { cn } from '@/lib/utils';

/**
 * Small monospaced label that opens a marketing section.
 *
 * Replaces the tinted pill-with-a-sparkle that used to sit above every section
 * heading. Six near-identical "✨ Features" / "✨ Benefits" / "✨ How it works"
 * badges down one page is the most recognisable tell of a generated landing
 * page; a numbered mono label does the same navigational job, ties into the
 * IBM Plex Mono already loaded for figures, and stays out of the way.
 */
export function SectionLabel({
  index,
  children,
  className,
}: {
  index?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground',
        className,
      )}
    >
      {index && <span className="text-primary">{index} </span>}
      {children}
    </p>
  );
}

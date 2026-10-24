'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addDays, formatLocalDate } from '@/lib/dates/local-date';
import { type Period } from '@/lib/schedule/pay-schedule';

type PeriodSwitcherProps = {
  period: Period | undefined;
  offset: number;
  onOffsetChange: (offset: number) => void;
  /** Browsing is capped server-side; the arrows stop here too. */
  maxOffset?: number;
};

/** "‹ November 2026 ›", like the month tabs of a budget sheet, with the exact dates underneath. */
export function PeriodSwitcher({ period, offset, onOffsetChange, maxOffset = 24 }: PeriodSwitcherProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0"
        onClick={() => onOffsetChange(offset - 1)}
        disabled={offset <= -maxOffset}
        aria-label="Previous period"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div className="min-w-0 text-center">
        <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{period?.label ?? ' '}</h2>
        {period && (
          <p className="text-xs text-muted-foreground sm:text-sm">
            {period.calendarMonth
              ? 'Calendar month · add your pay to plan payday to payday'
              : `${formatLocalDate(period.start, { day: 'numeric', month: 'short' }, 'en-IE')} – ${formatLocalDate(addDays(period.end, -1), { day: 'numeric', month: 'short' }, 'en-IE')}`}
            {offset !== 0 && (
              <>
                {' · '}
                <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => onOffsetChange(0)}>
                  Back to now
                </button>
              </>
            )}
          </p>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0"
        onClick={() => onOffsetChange(offset + 1)}
        disabled={offset >= maxOffset}
        aria-label="Next period"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

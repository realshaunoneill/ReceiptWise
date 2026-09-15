import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90',
        /*
         * Callout variants. Before these existed, every informational box in the
         * app hand-rolled its own colours — `bg-blue-50 dark:bg-blue-950/30`,
         * `border-green-500 bg-green-50`, `border-amber-500/30 bg-amber-500/10` —
         * so no two notices matched and several were unreadable in dark mode.
         */
        info:
          'text-info bg-info/8 border-info/25 *:data-[slot=alert-description]:text-info/85',
        success:
          'text-success bg-success/8 border-success/25 *:data-[slot=alert-description]:text-success/85',
        warning:
          'text-warning bg-warning/10 border-warning/30 *:data-[slot=alert-description]:text-warning/85',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        // Not line-clamped: titles here are short sentences that must be allowed
        // to wrap on narrow screens rather than be silently truncated.
        'col-start-2 min-h-4 font-medium tracking-tight',
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };

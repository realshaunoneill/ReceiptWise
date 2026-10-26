import React from 'react';
import { type TextStyle } from 'react-native';
import { formatCurrency } from '@shared/currency';
import Text, { type TextVariant } from './Text';

type Ink = React.ComponentProps<typeof Text>['ink'];

/**
 * An amount: tabular figures (so columns line up and changing figures don't jiggle), the item's own
 * currency, en-IE formatting, as on the website. VoiceOver reads the formatted string, which says
 * the currency.
 */
export default function Amount({
  value, currency, variant = 'callout', ink, weight = 'semibold', prefix = '', style,
}: {
  value: number;
  currency?: string | null;
  variant?: TextVariant;
  ink?: Ink;
  weight?: React.ComponentProps<typeof Text>['weight'];
  /** '~' for an estimate. */
  prefix?: string;
  style?: TextStyle;
}) {
  return (
    <Text variant={variant} ink={ink} weight={weight} tabular style={style}>
      {prefix}{formatCurrency(value, currency ?? 'EUR')}
    </Text>
  );
}

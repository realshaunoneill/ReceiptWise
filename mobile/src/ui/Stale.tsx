import React from 'react';
import { View } from 'react-native';

/**
 * Last-known content while what replaces it loads (another household's plan, another month): kept
 * on screen so nothing jumps, but dimmed and not tappable, so a tick can't land on the old one.
 */
export default function Stale({ stale, children }: { stale: boolean; children: React.ReactNode }) {
  return (
    <View style={{ opacity: stale ? 0.4 : 1 }} pointerEvents={stale ? 'none' : 'auto'} aria-busy={stale}>
      {children}
    </View>
  );
}

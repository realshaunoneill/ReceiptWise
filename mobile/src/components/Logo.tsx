import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** The mark, from brand/mark.svg (keep the two in step): a receipt, torn off, read and ticked. */
export default function Logo({ size = 40, dark = false }: { size?: number; dark?: boolean }) {
  const paper = dark ? '#1B1F1E' : '#F2EFEA';
  const print = dark ? '#3FB8A8' : '#04756F';
  const tick = dark ? '#54C98F' : '#2C9A6E';
  return (
    // Decorative: the name is always beside it.
    <View aria-hidden style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Path d="M104 28H408A48 48 0 0 1 456 76V458L389 414L323 458L256 414L189 458L122 414L56 458V76A48 48 0 0 1 104 28Z" fill={paper} stroke={print} strokeWidth={32} strokeLinejoin="round" />
      <Path d="M126 120H380M126 196H300M126 272H230" fill="none" stroke={print} strokeWidth={30} strokeLinecap="round" />
      <Path d="M218 330L270 382L394 232" fill="none" stroke={tick} strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
    </View>
  );
}

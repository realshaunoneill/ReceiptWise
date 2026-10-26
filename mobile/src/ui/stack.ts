import { Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { FONT } from './Text';

/**
 * Header options for every stack: iOS large titles that collapse as the list scrolls, the theme's
 * colours (so a push in dark mode never flashes white), and back buttons with no label.
 */
export function useStackOptions() {
  const { colors } = useTheme();
  return {
    headerLargeTitle: Platform.OS === 'ios',
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerLargeStyle: { backgroundColor: colors.background },
    headerTintColor: colors.accent,
    headerTitleStyle: { fontFamily: FONT.semibold, color: colors.text },
    headerLargeTitleStyle: { fontFamily: FONT.bold, color: colors.text },
    headerBackButtonDisplayMode: 'minimal' as const,
    contentStyle: { backgroundColor: colors.background },
  };
}

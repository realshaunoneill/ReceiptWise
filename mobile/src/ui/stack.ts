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

/**
 * How sheets and modals are presented (registered in app/_layout.tsx): a sheet with detents for a
 * small edit, a modal with Cancel and Save for a long form. Each draws its own header
 * (src/ui/Sheet.tsx).
 */
export function usePresentations() {
  const { colors } = useTheme();
  const contentStyle = { backgroundColor: colors.background };
  return {
    sheet: {
      presentation: 'formSheet' as const,
      sheetAllowedDetents: [0.6, 1],
      sheetGrabberVisible: true,
      sheetCornerRadius: 16,
      headerShown: false,
      contentStyle,
    },
    tallSheet: {
      presentation: 'formSheet' as const,
      sheetAllowedDetents: [0.9],
      sheetGrabberVisible: true,
      sheetCornerRadius: 16,
      headerShown: false,
      contentStyle,
    },
    modal: { presentation: 'modal' as const, headerShown: false, contentStyle },
  };
}

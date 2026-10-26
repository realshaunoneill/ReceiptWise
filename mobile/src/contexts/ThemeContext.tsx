import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette, type ThemeColors } from '../theme';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  themeMode: 'system',
  colors: palette.light,
  setThemeMode: () => {},
});

const THEME_KEY = 'theme_mode';

/** Light, dark, or the phone's setting, remembered on the device (Settings › Appearance). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setThemeModeState(stored);
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void AsyncStorage.setItem(THEME_KEY, mode);
  }, []);

  // React Native reports "unspecified" (as well as null) with no preference: light, like the web.
  const theme: 'light' | 'dark' = themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const value = useMemo(() => ({ theme, themeMode, colors: palette[theme], setThemeMode }), [theme, themeMode, setThemeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

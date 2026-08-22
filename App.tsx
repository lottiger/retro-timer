import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { TimerScreen } from './src/screens/TimerScreen';
import { ChessScreen } from './src/screens/ChessScreen';
import { ChessSettingsScreen } from './src/screens/ChessSettingsScreen';
import { CustomTimeScreen } from './src/screens/CustomTimeScreen';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './src/settings';
import { darkTheme, ThemeModeContext, useTheme } from './src/theme';

type Screen =
  | { kind: 'home' }
  | { kind: 'timer'; seconds: number }
  | { kind: 'custom' }
  | { kind: 'chess' }
  | { kind: 'chessSettings' };

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  return (
    <ThemeModeContext.Provider value={settings.themeMode}>
      <AppInner settings={settings} updateSettings={updateSettings} />
    </ThemeModeContext.Provider>
  );
}

interface AppInnerProps {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

function AppInner({ settings, updateSettings }: AppInnerProps) {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const theme = useTheme();

  return (
    <SafeAreaProvider>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <StatusBar
          style={theme === darkTheme ? 'light' : 'dark'}
          hidden={screen.kind === 'timer' || screen.kind === 'chess'}
        />
        {screen.kind === 'home' && (
          <HomeScreen
            settings={settings}
            onChangeSettings={updateSettings}
            onPickDuration={(seconds) => setScreen({ kind: 'timer', seconds })}
            onPickCustom={() => setScreen({ kind: 'custom' })}
            onPickChess={() => setScreen({ kind: 'chess' })}
          />
        )}
        {screen.kind === 'custom' && (
          <CustomTimeScreen
            settings={settings}
            onStart={(seconds) => {
              updateSettings({ customSeconds: seconds });
              setScreen({ kind: 'timer', seconds });
            }}
            onBack={() => setScreen({ kind: 'home' })}
          />
        )}
        {screen.kind === 'timer' && (
          <TimerScreen
            seconds={screen.seconds}
            settings={settings}
            onBack={() => setScreen({ kind: 'home' })}
          />
        )}
        {screen.kind === 'chess' && (
          <ChessScreen
            settings={settings}
            onBack={() => setScreen({ kind: 'home' })}
            onOpenSettings={() => setScreen({ kind: 'chessSettings' })}
          />
        )}
        {screen.kind === 'chessSettings' && (
          <ChessSettingsScreen
            settings={settings}
            onChange={updateSettings}
            onBack={() => setScreen({ kind: 'chess' })}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

interface AppSettings {
  appName: string;
  appSubtitle: string;
  logoText: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'DTR Management System',
  appSubtitle: 'Daily Time Record',
  logoText: 'DTR',
};

const STORAGE_KEY = 'dtr_app_settings';

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.title = settings.appName;
  }, [settings]);

  const value = useMemo<SettingsContextValue>(() => ({
    settings,
    updateSettings: (patch) => setSettings((current) => ({ ...current, ...patch })),
  }), [settings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}

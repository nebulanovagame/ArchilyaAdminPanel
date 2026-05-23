import Store from 'electron-store';
import type { LauncherSettings } from '../../shared/types';

export const defaultSettings: LauncherSettings = {
  autoStart: true,
  backgroundSync: true,
  wifiOnly: false,
  notifSync: true,
  notifLock: true,
  notifProject: false,
  notifSystem: true,
  syncSpeed: 'unlimited',
  themeMode: 'dark',
  storagePath: 'C:\\Belgelerim\\Archilya',
};

const store = new Store<LauncherSettings>({
  name: 'launcher-settings',
  defaults: defaultSettings,
});

export function getSettings(): LauncherSettings {
  return {
    autoStart: store.get('autoStart', defaultSettings.autoStart),
    backgroundSync: store.get('backgroundSync', defaultSettings.backgroundSync),
    wifiOnly: store.get('wifiOnly', defaultSettings.wifiOnly),
    notifSync: store.get('notifSync', defaultSettings.notifSync),
    notifLock: store.get('notifLock', defaultSettings.notifLock),
    notifProject: store.get('notifProject', defaultSettings.notifProject),
    notifSystem: store.get('notifSystem', defaultSettings.notifSystem),
    syncSpeed: store.get('syncSpeed', defaultSettings.syncSpeed),
    themeMode: store.get('themeMode', defaultSettings.themeMode),
    storagePath: store.get('storagePath', defaultSettings.storagePath),
  };
}

export function updateSettings(settings: Partial<LauncherSettings>): LauncherSettings {
  store.set(settings);
  return getSettings();
}

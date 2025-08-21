import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AlarmSettings, AppSettings } from '../../types';

interface SettingsState {
  alarm: AlarmSettings;
  app: AppSettings;
}

const initialState: SettingsState = {
  alarm: {
    volume: 80, // Default volume 80% (0-150 range)
    alarmSound: 'default' as 'default' | 'notification' | 'phone',
    debugMode: false, // Debug mode off by default
  },
  app: {
    // Empty for now, keeping for potential future settings
  },
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateAlarmSettings: (state, action: PayloadAction<Partial<AlarmSettings>>) => {
      state.alarm = { ...state.alarm, ...action.payload };
    },
    updateAppSettings: (state, action: PayloadAction<Partial<AppSettings>>) => {
      state.app = { ...state.app, ...action.payload };
    },
    toggleNotificationListener: (state) => {
      state.app.notificationListenerEnabled = !state.app.notificationListenerEnabled;
    },
    toggleShareIntent: (state) => {
      state.app.shareIntentEnabled = !state.app.shareIntentEnabled;
    },
  },
});

export const { updateAlarmSettings, updateAppSettings, toggleNotificationListener, toggleShareIntent } = settingsSlice.actions;
export default settingsSlice.reducer;
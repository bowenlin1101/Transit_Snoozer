import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NotificationData } from '../../types';

interface NotificationState {
  recentNotifications: NotificationData[];
  lastProcessedNotification: NotificationData | null;
  isListening: boolean;
  selectedApp: string | null;
}

const initialState: NotificationState = {
  recentNotifications: [],
  lastProcessedNotification: null,
  isListening: false,
  selectedApp: null,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<NotificationData>) => {
      state.recentNotifications.unshift(action.payload);
      // Keep only last 50 notifications
      if (state.recentNotifications.length > 50) {
        state.recentNotifications = state.recentNotifications.slice(0, 50);
      }
      state.lastProcessedNotification = action.payload;
    },
    clearNotifications: (state) => {
      state.recentNotifications = [];
      state.lastProcessedNotification = null;
    },
    setListeningStatus: (state, action: PayloadAction<boolean>) => {
      state.isListening = action.payload;
    },
    setSelectedApp: (state, action: PayloadAction<string | null>) => {
      state.selectedApp = action.payload;
    },
  },
});

export const { addNotification, clearNotifications, setListeningStatus, setSelectedApp } = notificationSlice.actions;
export default notificationSlice.reducer;
import { configureStore } from '@reduxjs/toolkit';
import routeReducer from './slices/routeSlice';
import settingsReducer from './slices/settingsSlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
  reducer: {
    routes: routeReducer,
    settings: settingsReducer,
    notifications: notificationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
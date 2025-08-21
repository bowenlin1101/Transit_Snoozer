import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TransitRoute, RouteSegment } from '../../types';

interface RouteState {
  activeRoute: TransitRoute | null;
  routeHistory: TransitRoute[];
  isTracking: boolean;
}

const initialState: RouteState = {
  activeRoute: null,
  routeHistory: [],
  isTracking: false,
};

const routeSlice = createSlice({
  name: 'routes',
  initialState,
  reducers: {
    addRoute: (state, action: PayloadAction<TransitRoute>) => {
      state.routeHistory.push(action.payload);
    },
    setActiveRoute: (state, action: PayloadAction<string>) => {
      const route = state.routeHistory.find(r => r.id === action.payload);
      if (route) {
        state.activeRoute = route;
        state.isTracking = true;
      }
    },
    updateRouteProgress: (state, action: PayloadAction<{ segmentId: string; currentStop: number }>) => {
      if (state.activeRoute) {
        const segment = state.activeRoute.segments.find(s => s.id === action.payload.segmentId);
        if (segment) {
          segment.currentStop = action.payload.currentStop;
          segment.stopsRemaining = segment.totalStops - action.payload.currentStop;
        }
      }
    },
    completeRoute: (state) => {
      if (state.activeRoute) {
        state.routeHistory.push({
          ...state.activeRoute,
          isActive: false,
        });
        state.activeRoute = null;
        state.isTracking = false;
      }
    },
    cancelRoute: (state) => {
      state.activeRoute = null;
      state.isTracking = false;
    },
    addSegment: (state, action: PayloadAction<RouteSegment>) => {
      if (state.activeRoute) {
        state.activeRoute.segments.push(action.payload);
      }
    },
  },
});

export const { addRoute, setActiveRoute, updateRouteProgress, completeRoute, cancelRoute, addSegment } = routeSlice.actions;
export default routeSlice.reducer;
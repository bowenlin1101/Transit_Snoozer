export interface TransitRoute {
  id: string;
  origin: string;
  destination: string;
  totalStops: number;
  currentStop: number;
  segments: RouteSegment[];
  isActive: boolean;
  createdAt: Date;
}

export interface RouteSegment {
  id: string;
  routeId: string;
  transportType: 'bus' | 'train' | 'subway';
  line: string;
  direction: string;
  totalStops: number;
  currentStop: number;
  stopsRemaining: number;
  nextStopName?: string;
}

export interface NotificationData {
  packageName: string;
  appName: string;
  title: string;
  text: string;
  subText: string;
  bigText: string;
  timestamp: number;
  parsedData?: {
    nextStop?: string;
    stopsRemaining?: number;
    line?: string;
  };
}

export interface AlarmSettings {
  volume: number; // Volume level 0-150
  alarmSound: 'default' | 'notification' | 'phone'; // Ringtone selection
  debugMode: boolean; // Trigger alarm on any Google Maps notification
}

export interface AppSettings {
  // Empty for now, keeping for potential future settings
}

export type RootStackParamList = {
  Home: undefined;
  ActiveRoute: { routeId: string };
  Settings: undefined;
  Permissions: undefined;
};

export type NavigationApp = 'google_maps' | 'apple_maps' | 'transit' | 'citymapper';
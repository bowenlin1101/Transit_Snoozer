import GoogleMapsIcon from '../assets/images/google_map.png';
import TransitIcon from '../assets/images/Transit-Logo.jpg';

export interface TransitApp {
  id: string;
  packageName: string;
  displayName: string;
  color: string;
  available: boolean;
  icon: any;
}

export const TRANSIT_APPS: TransitApp[] = [
  {
    id: 'google_maps',
    packageName: 'com.google.android.apps.maps',
    displayName: 'Google Maps',
    color: '#4285F4',
    available: true,
    icon: GoogleMapsIcon,
  },
  {
    id: 'transit',
    packageName: 'com.thetransitapp.droid', // Updated to correct package name
    displayName: 'Transit',
    color: '#5BC500',
    available: true,
    icon: TransitIcon,
  },
];

export const getAppDisplayName = (packageName: string): string => {
  const app = TRANSIT_APPS.find(a => a.packageName === packageName);
  return app?.displayName || 'Transit App';
};

export const getAppColor = (packageName: string): string => {
  const app = TRANSIT_APPS.find(a => a.packageName === packageName);
  return app?.color || '#666666';
};
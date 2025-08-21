# Transit Snoozer 🚌💤

Transit Snoozer is an Android app that helps commuters wake up at the right stop by monitoring transit app notifications and triggering alarms when approaching their destination.

## Features

- **Transit App Integration**: Works with popular transit apps like Google Maps, and Transit
- **Smart Notifications**: Monitors real-time transit notifications to track your journey
- **Multiple Alert Options**: Choose from different alarm sounds and volume levels
- **Background Monitoring**: Continues tracking even when the app is in the background

## Requirements

- Android device (minimum SDK 24 / Android 7.0)
- Node.js 20 or higher
- React Native development environment

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/bowenlin1101/Transit_Snoozer 
   cd TransitAlarm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## Building the App

### Development Build

1. **Start Metro bundler**
   ```bash
   npm start
   ```

2. **Run on Android device/emulator**
   ```bash
   npm run android
   ```

### Debug APK

To build a debug APK for testing:

```bash
cd android
./gradlew assembleDebug
```

The APK will be generated at: `android/app/build/outputs/apk/debug/app-debug.apk`

## How It Works

1. **Select Transit App**: Choose which transit app you're using (Google Maps, or Transit)
2. **Grant Permissions**: Allow notification access, and running in background permissions so the app can monitor transit updates
3. **Start Tracking**: Begin your journey on the selected Transit app and Transit Snoozer will monitor notifications
4. **Automatic Alarm**: When you're one stop away, the alarm triggers
5. **Wake Up**: Tap "Stop Alarm" to stop the alarm and continue your journey

## App Structure

- `/src` - React Native source code
  - `/components` - Reusable UI components
  - `/screens` - Main app screens (Home, Active Route, Settings, Permissions)
  - `/services` - Core services (AlarmService, NotificationParser)
  - `/store` - Redux store and slices
  - `/native` - Native module bridges
- `/android` - Android-specific code
  - `/app/src/main/java/com/transitalarm` - Kotlin native modules
    - `NotificationListenerModule.kt` - Handles notification monitoring
    - `TransitNotificationListenerService.kt` - Background notification service

## Troubleshooting

- **App crashes on start**: Make sure you've run `npm install` and rebuilt the app
- **Notifications not detected**: Ensure notification access is granted in Android settings
- **No sound**: Check device volume and that the app has media playback permissions

## Development

- **Lint**: `npm run lint`
- **Clean build**: `cd android && ./gradlew clean`


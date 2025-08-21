# Transit Snoozer 🚌💤

Transit Snoozer is an Android app that helps commuters wake up at the right stop by monitoring transit app notifications and triggering alarms when approaching their destination.

## Features

- **Transit App Integration**: Works with popular transit apps like Google Maps, Citymapper, Moovit, and Transit
- **Smart Notifications**: Monitors real-time transit notifications to track your journey
- **Customizable Alarms**: Set alarms to trigger when you're a specific number of stops away from your destination
- **Multiple Alert Options**: Choose from different alarm sounds and volume levels
- **Background Monitoring**: Continues tracking even when the app is in the background
- **Sound Effects**: Audio feedback when starting/stopping tracking

## Requirements

- Android device (minimum SDK 24 / Android 7.0)
- Node.js 18 or higher
- React Native development environment
- Android Studio (for building release APKs)

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TransitAlarm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Android-specific setup**
   
   The app requires notification access permission to monitor transit app notifications. This will be requested when you first run the app.

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

### Release Build

1. **Generate a signed release APK**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

   Note: You'll need to set up signing keys first. See [React Native's signing guide](https://reactnative.dev/docs/signed-apk-android).

2. **Build a release bundle for Play Store**
   ```bash
   cd android
   ./gradlew bundleRelease
   ```

## How It Works

1. **Select Transit App**: Choose which transit app you're using (Google Maps, Citymapper, etc.)
2. **Grant Permissions**: Allow notification access so the app can monitor transit updates
3. **Start Tracking**: Begin your journey and the app will monitor notifications
4. **Automatic Alarm**: When you're the specified number of stops away, the alarm triggers
5. **Wake Up**: Tap "I'm Awake!" to stop the alarm and continue your journey

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

## Permissions

The app requires the following permissions:
- **Notification Access**: To read transit app notifications
- **Vibration**: For alarm alerts
- **Run at Startup** (optional): To resume monitoring after device restart

## Troubleshooting

- **App crashes on start**: Make sure you've run `npm install` and rebuilt the app
- **Notifications not detected**: Ensure notification access is granted in Android settings
- **No sound**: Check device volume and that the app has media playback permissions

## Development

- **Lint**: `npm run lint`
- **Clean build**: `cd android && ./gradlew clean`

## License

This project is private and proprietary.
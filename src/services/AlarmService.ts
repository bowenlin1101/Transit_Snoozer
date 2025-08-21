import { Vibration, Platform, NativeEventEmitter, NativeModules } from 'react-native';
import notifee, { AndroidImportance, AndroidCategory, EventType } from '@notifee/react-native';
import Sound from 'react-native-sound';
import NotificationListener from '../native/NotificationListener';
import { AlarmSettings } from '../types';

export class AlarmService {
  private static instance: AlarmService;
  private isAlarming: boolean = false;
  private alarmInterval: NodeJS.Timeout | null = null;
  private alarmSound: Sound | null = null;
  private currentAlarmMessage: string = '';
  private currentAlarmTitle: string = '';
  private lastStopTime: number = 0;
  private cooldownDuration: number = 30000; // 30 seconds in milliseconds
  private eventEmitter: NativeEventEmitter;
  private lastDismissedNotificationTitle: string = '';

  constructor() {
    // Set up notification event handlers
    this.setupNotificationHandlers();
    // Create event emitter for alarm state changes
    this.eventEmitter = new NativeEventEmitter();
    // Listen for native alarm state changes
    this.setupNativeAlarmListener();
  }

  static getInstance(): AlarmService {
    if (!AlarmService.instance) {
      AlarmService.instance = new AlarmService();
    }
    return AlarmService.instance;
  }

  isAlarmActive(): boolean {
    return this.isAlarming;
  }

  getCurrentAlarmMessage(): string {
    return this.currentAlarmMessage;
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase().trim();
  }

  clearDismissedNotification(): void {
    console.log('AlarmService: Clearing dismissed notification memory');
    this.lastDismissedNotificationTitle = '';
  }

  private setupNotificationHandlers() {
    // Handle notification press events
    notifee.onForegroundEvent(({ type, detail }) => {
      console.log('AlarmService: Notification event type:', type);
      
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        if (detail.pressAction?.id === 'stop-alarm' || detail.pressAction?.id === 'default') {
          console.log('AlarmService: Stop alarm triggered from notification');
          this.stopAlarm();
        }
      }
    });
  }

  private setupNativeAlarmListener() {
    // Listen for alarm state changes from native module
    const nativeEmitter = new NativeEventEmitter();
    nativeEmitter.addListener('nativeAlarmStateChanged', (state) => {
      console.log('AlarmService: Native alarm state changed:', state);
      
      // Update our state to match native state
      this.isAlarming = state.isActive;
      this.currentAlarmMessage = state.message || '';
      
      // Re-emit for UI components
      this.eventEmitter.emit('alarmStateChanged', { 
        isActive: state.isActive, 
        message: state.message || '' 
      });
    });
  }

  async triggerAlarm(settings: AlarmSettings, message: string, isManualTest: boolean = false, notificationTitle?: string) {
    console.log('AlarmService: triggerAlarm called with message:', message);
    console.log('AlarmService: notification title:', notificationTitle);
    console.log('AlarmService: settings:', JSON.stringify(settings));
    console.log('AlarmService: isManualTest:', isManualTest);
    
    // Check if alarm is already active
    if (this.isAlarming) {
      console.log('AlarmService: Alarm already active, ignoring new trigger');
      return;
    }
    
    // Check if this notification was just dismissed (only for notification-triggered alarms)
    if (!isManualTest && notificationTitle) {
      const normalizedTitle = this.normalizeTitle(notificationTitle);
      if (normalizedTitle === this.lastDismissedNotificationTitle) {
        console.log('AlarmService: This notification title was just dismissed, ignoring:', notificationTitle);
        return;
      }
    }
    
    // Check cooldown period only for notification-triggered alarms
    if (!isManualTest) {
      const currentTime = Date.now();
      const timeSinceLastStop = currentTime - this.lastStopTime;
      if (timeSinceLastStop < this.cooldownDuration) {
        const remainingCooldown = Math.ceil((this.cooldownDuration - timeSinceLastStop) / 1000);
        console.log(`AlarmService: In cooldown period. ${remainingCooldown} seconds remaining`);
        return;
      }
    }

    this.isAlarming = true;
    this.currentAlarmMessage = message;
    this.currentAlarmTitle = notificationTitle || '';
    
    // Emit alarm state change event
    this.eventEmitter.emit('alarmStateChanged', { isActive: true, message });

    // Show notification
    console.log('AlarmService: Showing notification');
    await this.showAlarmNotification(message);

    // Play alarm sound (always enabled, volume controls intensity)
    console.log('AlarmService: Playing alarm sound with volume:', settings.volume);
    this.playAlarmSound(settings.volume, settings.alarmSound);

    // Always vibrate
    console.log('AlarmService: Starting vibration');
    this.startVibration();
  }

  private async showAlarmNotification(message: string) {
    // Request permissions if needed
    if (Platform.OS === 'android') {
      await notifee.requestPermission();
    }

    // Create a channel for alarm notifications
    const channelId = await notifee.createChannel({
      id: 'transit-alarm',
      name: 'Transit Snoozer Alarms',
      importance: AndroidImportance.HIGH,
      sound: 'alarm',
      vibration: true,
      vibrationPattern: [300, 500, 300, 500],
      bypassDnd: true,
    });

    // Display the notification
    await notifee.displayNotification({
      title: '🚨 Transit Alarm',
      body: message,
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.ALARM,
        pressAction: {
          id: 'default',
        },
        ongoing: true,
        autoCancel: false,
        sound: 'alarm',
        loopSound: true,
        actions: [
          {
            title: 'Stop Alarm',
            pressAction: {
              id: 'stop-alarm',
            },
          },
        ],
      },
    });
  }

  private playAlarmSound(volume?: number, alarmSound?: 'default' | 'notification' | 'phone') {
    console.log('AlarmService: playAlarmSound called with volume:', volume, 'sound type:', alarmSound);
    
    // Use native alarm sound as primary method
    try {
      console.log('AlarmService: Using native alarm sound');
      // Volume is 0-150%, convert to 0-1.5 for native module
      const alarmVolume = volume !== undefined ? volume / 100 : 0.8;
      NotificationListener.playAlarmSound(alarmVolume, alarmSound);
      // Native sound is now playing, no need for backup
    } catch (error) {
      console.error('AlarmService: Error playing native alarm:', error);
      // Only try react-native-sound if native fails
      this.tryReactNativeSound(volume);
    }
  }
  
  private tryReactNativeSound(volume?: number) {
    console.log('AlarmService: Trying react-native-sound with volume:', volume);
    try {
      // Enable playback in silence mode
      Sound.setCategory('Alarm');
      console.log('AlarmService: Sound category set to Alarm');
      
      // First try to use a bundled sound if available
      this.alarmSound = new Sound('notification.mp3', Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.log('AlarmService: No bundled sound, trying system ringtone');
          // Try using system ringtone
          this.alarmSound = new Sound('ringtone.mp3', Sound.SYSTEM, (error2) => {
            if (error2) {
              console.log('AlarmService: No system ringtone, trying notification sound');
              // Final fallback to notification
              this.alarmSound = new Sound('notification.mp3', Sound.SYSTEM, (error3) => {
                if (error3) {
                  console.error('AlarmService: Failed to load any sound:', error3);
                  // As a last resort, try to play through notification only
                  console.log('AlarmService: All sound loading failed, relying on notification channel');
                  return;
                }
                console.log('AlarmService: Loaded system notification sound');
                this.playSound(volume);
              });
            } else {
              console.log('AlarmService: Loaded system ringtone');
              this.playSound(volume);
            }
          });
        } else {
          console.log('AlarmService: Loaded bundled notification sound');
          this.playSound(volume);
        }
      });
    } catch (error) {
      console.error('AlarmService: Error in tryReactNativeSound:', error);
    }
  }

  private playSound(volume?: number) {
    console.log('AlarmService: playSound called with volume:', volume);
    if (!this.alarmSound) {
      console.log('AlarmService: No alarm sound object');
      return;
    }
    if (!this.isAlarming) {
      console.log('AlarmService: Not alarming anymore');
      return;
    }
    
    try {
      // Set volume based on settings (0-150 converted to 0-1, capped at 1.0 for react-native-sound)
      const soundVolume = volume !== undefined ? Math.min(volume / 100, 1.0) : 0.8;
      this.alarmSound.setVolume(soundVolume);
      console.log('AlarmService: Volume set to', soundVolume);
      
      // Play the sound in a loop
      this.alarmSound.setNumberOfLoops(-1);
      console.log('AlarmService: Set to loop indefinitely');
      
      this.alarmSound.play((success) => {
        if (success) {
          console.log('AlarmService: Sound playback completed successfully');
        } else {
          console.error('AlarmService: Sound playback failed');
        }
      });
      console.log('AlarmService: play() called');
    } catch (error) {
      console.error('AlarmService: Error in playSound:', error);
    }
  }

  private startVibration() {
    // Vibration pattern: [wait, vibrate, wait, vibrate, ...]
    const pattern = [0, 500, 300, 500, 300, 500];
    
    if (Platform.OS === 'android') {
      // Android supports repeating patterns
      Vibration.vibrate(pattern, true);
    } else {
      // iOS doesn't support repeating, so we'll do it manually
      this.vibrateContinuously(pattern);
    }
  }

  private vibrateContinuously(pattern: number[]) {
    let index = 0;
    
    const vibrateNext = () => {
      if (!this.isAlarming) {
        return;
      }

      const duration = pattern[index % pattern.length];
      
      if (index % 2 === 1) {
        // Odd indices are vibration durations
        Vibration.vibrate(duration);
      }

      index++;
      this.alarmInterval = setTimeout(vibrateNext, duration);
    };

    vibrateNext();
  }

  stopAlarm() {
    console.log('AlarmService: stopAlarm called');
    
    // Save the normalized title of the dismissed notification
    if (this.currentAlarmTitle) {
      this.lastDismissedNotificationTitle = this.normalizeTitle(this.currentAlarmTitle);
      console.log('AlarmService: Saved dismissed notification title:', this.lastDismissedNotificationTitle);
    }
    
    this.isAlarming = false;
    this.currentAlarmMessage = '';
    this.currentAlarmTitle = '';
    this.lastStopTime = Date.now(); // Record stop time for cooldown
    
    // Emit alarm state change event
    this.eventEmitter.emit('alarmStateChanged', { isActive: false, message: '' });
    
    // Stop native alarm sound
    NotificationListener.stopAlarmSound();
    
    // Stop react-native-sound if playing
    if (this.alarmSound) {
      try {
        this.alarmSound.stop();
        this.alarmSound.release();
      } catch (error) {
        console.error('AlarmService: Error stopping sound:', error);
      }
      this.alarmSound = null;
    }
    
    // Stop vibration
    Vibration.cancel();
    
    // Clear interval if exists
    if (this.alarmInterval) {
      clearTimeout(this.alarmInterval);
      this.alarmInterval = null;
    }

    // Cancel notifications
    notifee.cancelAllNotifications();
    
    console.log('AlarmService: Alarm stopped');
  }

  async testAlarm(settings: AlarmSettings) {
    await this.triggerAlarm(settings, 'This is a test alarm!', true);
    // Don't auto-stop - let user dismiss it
  }

  onAlarmStateChange(callback: (state: { isActive: boolean; message: string }) => void): () => void {
    const subscription = this.eventEmitter.addListener('alarmStateChanged', callback);
    return () => subscription.remove();
  }
}

export default AlarmService.getInstance();
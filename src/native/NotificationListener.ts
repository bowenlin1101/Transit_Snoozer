import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { NotificationData } from '../types';

const { NotificationListener } = NativeModules;

class NotificationListenerService {
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Map<string, any> = new Map();

  constructor() {
    if (Platform.OS === 'android' && NotificationListener) {
      // Create NativeEventEmitter without passing the module
      // This is the correct way for newer React Native versions
      this.eventEmitter = new NativeEventEmitter();
      console.log('NotificationListener initialized');
    }
  }

  async isEnabled(): Promise<boolean> {
    if (Platform.OS !== 'android' || !NotificationListener) {
      return false;
    }
    return NotificationListener.isNotificationListenerEnabled();
  }

  async openSettings(): Promise<void> {
    if (Platform.OS === 'android' && NotificationListener) {
      NotificationListener.openNotificationListenerSettings();
    }
  }

  async openAppSettings(): Promise<void> {
    if (Platform.OS === 'android' && NotificationListener) {
      NotificationListener.openAppSettings();
    }
  }

  async startListening(packageName?: string): Promise<void> {
    if (Platform.OS === 'android' && NotificationListener) {
      NotificationListener.startListening(packageName);
    }
  }

  async stopListening(): Promise<void> {
    if (Platform.OS === 'android' && NotificationListener) {
      NotificationListener.stopListening();
    }
  }

  onNotificationReceived(callback: (notification: NotificationData) => void): () => void {
    if (!this.eventEmitter) {
      console.log('No event emitter available');
      return () => {};
    }

    console.log('Setting up notification listener');
    const listener = this.eventEmitter.addListener(
      'onNotificationReceived',
      (notification) => {
        console.log('Notification received in JS:', notification);
        callback(notification);
      }
    );

    const listenerId = Date.now().toString();
    this.listeners.set(listenerId, listener);

    return () => {
      const listenerToRemove = this.listeners.get(listenerId);
      if (listenerToRemove) {
        listenerToRemove.remove();
        this.listeners.delete(listenerId);
      }
    };
  }

  removeAllListeners(): void {
    this.listeners.forEach(listener => listener.remove());
    this.listeners.clear();
  }

  playAlarmSound(volume?: number, ringtoneType?: 'default' | 'notification' | 'phone'): void {
    if (Platform.OS === 'android' && NotificationListener) {
      console.log('Calling native playAlarmSound with volume:', volume, 'ringtoneType:', ringtoneType);
      NotificationListener.playAlarmSound(volume || 1.0, ringtoneType || 'default');
    }
  }

  stopAlarmSound(): void {
    if (Platform.OS === 'android' && NotificationListener) {
      console.log('Calling native stopAlarmSound');
      NotificationListener.stopAlarmSound();
    }
  }

  async isAlarmPlaying(): Promise<boolean> {
    if (Platform.OS === 'android' && NotificationListener) {
      return NotificationListener.isAlarmPlaying();
    }
    return false;
  }

  async getAlarmMessage(): Promise<string> {
    if (Platform.OS === 'android' && NotificationListener) {
      return NotificationListener.getAlarmMessage();
    }
    return '';
  }

  updateAlarmSettings(stopsBeforeAlarm: number, debugMode: boolean = false, volume: number = 80, alarmSound: 'default' | 'notification' | 'phone' = 'default'): void {
    if (Platform.OS === 'android' && NotificationListener) {
      NotificationListener.updateAlarmSettings(stopsBeforeAlarm, debugMode, volume / 100, alarmSound);
    }
  }

  async previewRingtone(ringtoneType: 'default' | 'notification' | 'phone'): Promise<boolean> {
    if (Platform.OS === 'android' && NotificationListener) {
      return NotificationListener.previewRingtone(ringtoneType);
    }
    return false;
  }

  stopRingtonePreview(): void {
    if (Platform.OS === 'android' && NotificationListener) {
      NotificationListener.stopRingtonePreview();
    }
  }
}

export default new NotificationListenerService();
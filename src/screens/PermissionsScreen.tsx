import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import NotificationListener from '../native/NotificationListener';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PermissionItem {
  title: string;
  description: string;
  status: string;
  action: () => void;
  platform: 'android';
}

function PermissionsScreen(): React.JSX.Element {
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    const permissionsList: PermissionItem[] = [];

    // Notification Access (Android only) - This should be first
    if (Platform.OS === 'android') {
      const listenerEnabled = await NotificationListener.isEnabled();
      permissionsList.push({
        title: '1. Read Transit Notifications',
        description: 'We need to read notifications from your transit apps. In the settings, only enable "Notifications that ring or vibrate". Turn OFF: Conversations/SMS, Real-Time Ongoing communication, and Muted notifications.',
        status: listenerEnabled ? 'Granted' : 'Denied',
        action: () => {
          NotificationListener.openSettings();
        },
        platform: 'android',
      });
    }

    // Background Activity Permission (Android only)
    if (Platform.OS === 'android') {
      const backgroundEnabled = await AsyncStorage.getItem('backgroundPermissionAcknowledged');
      permissionsList.push({
        title: '2. Keep App Running',
        description: 'For the best experience, enable "Allow background activity" so your phone doesn\'t kill the app. Also check both your transit app and Transit Snoozer once every hour to ensure they\'re still running.',
        status: backgroundEnabled === 'true' ? 'Configured' : 'Not Configured',
        action: () => {
          NotificationListener.openAppSettings();
        },
        platform: 'android',
      });
    }

    // Notification Permission
    if (Platform.OS === 'android') {
      const notifStatus = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      permissionsList.push({
        title: '3. Play Alarm Sounds',
        description: 'We need permission to send you notifications when it\'s time to get off. This is how we play the alarm sound.',
        status: getPermissionStatusText(notifStatus),
        action: async () => {
          await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
          checkAllPermissions();
        },
        platform: 'android',
      });
    }

    setPermissions(permissionsList);
  };

  const getPermissionStatusText = (status: string): string => {
    switch (status) {
      case RESULTS.GRANTED:
        return 'Granted';
      case RESULTS.DENIED:
        return 'Denied';
      case RESULTS.BLOCKED:
        return 'Blocked';
      case RESULTS.UNAVAILABLE:
        return 'Unavailable';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Granted':
      case 'Configured':
        return '#4CAF50';
      case 'Denied':
      case 'Not Configured':
        return '#FF9800';
      case 'Blocked':
        return '#f44336';
      default:
        return '#666';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Transit Snoozer Setup</Text>
        <Text style={styles.infoText}>
          Transit Snoozer needs these 3 permissions to work properly:
        </Text>
        <Text style={styles.infoListText}>
          1. The permission to read notifications that ring or vibrate
        </Text>
        <Text style={styles.infoListText}>
          2. The permission to run background activities
        </Text>
        <Text style={styles.infoListText}>
          3. The permission to send notifications for alarms
        </Text>
      </View>

      {permissions.map((permission, index) => (
        <View key={index} style={styles.permissionCard}>
          <View style={styles.permissionInfo}>
            <Text style={styles.permissionTitle}>{permission.title}</Text>
            <Text style={styles.permissionDescription}>{permission.description}</Text>
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Status: </Text>
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(permission.status) },
                ]}>
                {permission.status}
              </Text>
            </View>
          </View>
          {permission.status !== 'Granted' && permission.status !== 'Configured' && (
            <TouchableOpacity
              style={styles.grantButton}
              onPress={permission.action}>
              <Text style={styles.grantButtonText}>
                {permission.title.includes('Read Transit') || permission.title.includes('Keep App') ? 'Open Settings' : 'Grant'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <View style={styles.troubleshootCard}>
        <Text style={styles.troubleshootTitle}>Troubleshooting</Text>
        <Text style={styles.troubleshootText}>
          <Text style={styles.boldText}>App keeps dying?</Text> Check your transit app and Transit Snoozer every hour to keep them alive
        </Text>
        <Text style={styles.troubleshootText}>
          <Text style={styles.boldText}>Not detecting notifications?</Text> Make sure only "ring or vibrate" notifications are enabled
        </Text>
        <Text style={styles.troubleshootText}>
          <Text style={styles.boldText}>No alarm sound?</Text> Check that notification permission is granted. Make sure the volume is high enough. The volume changes based on your phone media volume and the one in the settings.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  infoCard: {
    backgroundColor: '#E8F5E9',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 20,
    marginBottom: 8,
  },
  infoListText: {
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 20,
    marginLeft: 8,
    marginBottom: 4,
  },
  permissionCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  permissionInfo: {
    marginBottom: 12,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  grantButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  grantButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  troubleshootCard: {
    backgroundColor: '#F3E5F5',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  troubleshootTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6A1B9A',
    marginBottom: 8,
  },
  troubleshootText: {
    fontSize: 14,
    color: '#6A1B9A',
    marginBottom: 8,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: 'bold',
  },
});

export default PermissionsScreen;
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateAlarmSettings } from '../store/slices/settingsSlice';
import NotificationListener from '../native/NotificationListener';
import AlarmService from '../services/AlarmService';

function SettingsScreen(): React.JSX.Element {
  const dispatch = useDispatch();
  const alarmSettings = useSelector((state: RootState) => state.settings.alarm);
  const [showRingtoneModal, setShowRingtoneModal] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [alarmMessage, setAlarmMessage] = useState('');

  const ringtoneOptions: Array<{ value: 'default' | 'notification' | 'phone'; label: string }> = [
    { value: 'default', label: 'Default Alarm' },
    { value: 'notification', label: 'Notification Sound' },
    { value: 'phone', label: 'Phone Ringtone' },
  ];

  const handleVolumeChange = (value: number) => {
    dispatch(updateAlarmSettings({ volume: value }));
  };

  const handleRingtoneSelect = (value: 'default' | 'notification' | 'phone') => {
    dispatch(updateAlarmSettings({ alarmSound: value }));
    setShowRingtoneModal(false);
  };

  const testRingtone = async (ringtone: 'default' | 'notification' | 'phone') => {
    try {
      await NotificationListener.previewRingtone(ringtone);
    } catch (error) {
      console.error('Error previewing ringtone:', error);
    }
  };

  const checkAlarmStatus = async () => {
    const alarmActive = AlarmService.isAlarmActive();
    const message = AlarmService.getCurrentAlarmMessage();
    setIsAlarmActive(alarmActive);
    setAlarmMessage(message);
  };

  useEffect(() => {
    // Check initial alarm status
    checkAlarmStatus();
    
    // Listen for alarm state changes
    const unsubscribe = AlarmService.onAlarmStateChange((state) => {
      console.log('Settings: Alarm state changed:', state);
      setIsAlarmActive(state.isActive);
      setAlarmMessage(state.message);
    });
    
    return () => unsubscribe();
  }, []);

  return (
    <>
      <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alarm Settings</Text>
        
        {/* Volume Slider */}
        <View style={styles.settingColumn}>
          <View style={styles.volumeHeader}>
            <Text style={styles.settingLabel}>Volume</Text>
            <Text style={styles.volumeValue}>{Math.round(alarmSettings.volume)}%</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={150}
            value={alarmSettings.volume}
            onValueChange={handleVolumeChange}
            minimumTrackTintColor="#2196F3"
            maximumTrackTintColor="#CCC"
            thumbTintColor="#2196F3"
          />
        </View>

        {/* Ringtone Selection */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowRingtoneModal(true)}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Ringtone</Text>
            <Text style={styles.settingValue}>
              {ringtoneOptions.find(r => r.value === alarmSettings.alarmSound)?.label || 'Default Alarm'}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Test Alarm Button */}
        <TouchableOpacity
          style={styles.testButton}
          onPress={() => {
            AlarmService.testAlarm(alarmSettings);
          }}>
          <Text style={styles.testButtonText}>Test Alarm</Text>
        </TouchableOpacity>
      </View>

      {/* Debug Mode at the bottom */}
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Debug Mode</Text>
            <Text style={styles.settingDescription}>
              Trigger alarm on any notification from monitored app
            </Text>
          </View>
          <Switch
            value={alarmSettings.debugMode}
            onValueChange={(value) => dispatch(updateAlarmSettings({ debugMode: value }))}
          />
        </View>
      </View>

      {/* Ringtone Selection Modal */}
      <Modal
        visible={showRingtoneModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRingtoneModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            NotificationListener.stopRingtonePreview();
            setShowRingtoneModal(false);
          }}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Ringtone</Text>
            
            {ringtoneOptions.map((option) => (
              <View key={option.value} style={styles.ringtoneOption}>
                <TouchableOpacity
                  style={styles.ringtoneRadio}
                  onPress={() => handleRingtoneSelect(option.value)}>
                  <View style={styles.radioOuter}>
                    {alarmSettings.alarmSound === option.value && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Text style={styles.ringtoneLabel}>{option.label}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.previewButton}
                  onPress={() => testRingtone(option.value)}>
                  <Text style={styles.previewButtonText}>Preview</Text>
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                NotificationListener.stopRingtonePreview();
                setShowRingtoneModal(false);
              }}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>

    {/* Alarm Active Modal */}
    {isAlarmActive && (
      <View style={styles.alarmOverlay}>
        <View style={styles.alarmActiveCard}>
          <Text style={styles.alarmActiveTitle}>🚨 ALARM ACTIVE</Text>
          <Text style={styles.alarmActiveText}>{alarmMessage || 'Transit Alarm'}</Text>
          <TouchableOpacity
            style={styles.stopAlarmButton}
            onPress={() => {
              console.log('Stop alarm button pressed');
              AlarmService.stopAlarm();
              checkAlarmStatus();
            }}>
            <Text style={styles.stopAlarmButtonText}>STOP ALARM</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingColumn: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  volumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  volumeValue: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  chevron: {
    fontSize: 24,
    color: '#999',
  },
  testButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 16,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  ringtoneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  ringtoneRadio: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  ringtoneLabel: {
    fontSize: 16,
    color: '#333',
  },
  previewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  previewButtonText: {
    color: '#4CAF50',
    fontSize: 14,
  },
  modalCloseButton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#666',
  },
  alarmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  alarmActiveCard: {
    backgroundColor: '#ff5252',
    margin: 20,
    padding: 30,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    alignItems: 'center',
    width: '90%',
    maxWidth: 350,
  },
  alarmActiveTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  alarmActiveText: {
    fontSize: 16,
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  stopAlarmButton: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    elevation: 2,
  },
  stopAlarmButtonText: {
    color: '#ff5252',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;
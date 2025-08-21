import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import RNFS from 'react-native-fs';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { updateAlarmSettings, addCustomSound, removeCustomSound } from '../store/slices/settingsSlice';
import { BUILT_IN_SOUNDS } from '../constants/alarmSounds';
import { AlarmSound, CustomSound } from '../types';
import NotificationListener from '../native/NotificationListener';

interface SoundPickerModalProps {
  visible: boolean;
  onClose: () => void;
  currentSoundId: string;
}

export const SoundPickerModal: React.FC<SoundPickerModalProps> = ({
  visible,
  onClose,
  currentSoundId,
}) => {
  const dispatch = useDispatch();
  const customSounds = useSelector((state: RootState) => state.settings.app.customSounds);
  const [testingSound, setTestingSound] = useState<string | null>(null);

  const handleSoundSelect = (soundId: string) => {
    console.log('[SoundPicker] Sound selected:', soundId);
    console.log('[SoundPicker] Previous sound was:', currentSoundId);
    
    // Update Redux state
    dispatch(updateAlarmSettings({ alarmSound: soundId }));
    console.log('[SoundPicker] Dispatched Redux update');
    
    // Update native module
    NotificationListener.updateAlarmSound(soundId);
    console.log('[SoundPicker] Updated native module with soundId:', soundId);
    
    onClose();
  };

  const handleTestSound = async (soundId: string) => {
    console.log('[SoundPicker] Testing sound:', soundId);
    try {
      setTestingSound(soundId);
      // Play the sound for testing
      NotificationListener.playAlarmSound(0.8, soundId);
      console.log('[SoundPicker] Called playAlarmSound with volume: 0.8, soundId:', soundId);
      
      // Stop after 3 seconds
      setTimeout(() => {
        console.log('[SoundPicker] Stopping test sound');
        NotificationListener.stopAlarmSound();
        setTestingSound(null);
      }, 3000);
    } catch (error) {
      console.error('[SoundPicker] Error testing sound:', error);
      setTestingSound(null);
    }
  };

  // TODO: Re-enable when we have a compatible file picker
  // const handleUploadSound = async () => {
  //   // File picker functionality temporarily disabled
  //   Alert.alert('Coming Soon', 'Custom sound upload will be available in a future update.');
  // };

  const handleDeleteCustomSound = (soundId: string) => {
    Alert.alert(
      'Delete Sound',
      'Are you sure you want to delete this custom sound?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const sound = customSounds.find(s => s.id === soundId);
            if (sound) {
              // Delete the file
              try {
                await RNFS.unlink(sound.filePath);
              } catch (error) {
                console.error('Error deleting file:', error);
              }
              
              // Remove from Redux
              dispatch(removeCustomSound(soundId));
              
              // If this was the selected sound, reset to default
              if (currentSoundId === soundId) {
                dispatch(updateAlarmSettings({ alarmSound: 'default_alarm' }));
                NotificationListener.updateAlarmSound('default_alarm');
              }
            }
          },
        },
      ]
    );
  };

  const allSounds: AlarmSound[] = [
    ...BUILT_IN_SOUNDS,
    ...customSounds,
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose Alarm Sound</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.soundList}>
            {allSounds.map((sound) => (
              <View key={sound.id} style={styles.soundItem}>
                <TouchableOpacity
                  style={[
                    styles.soundInfo,
                    currentSoundId === sound.id && styles.selectedSound,
                  ]}
                  onPress={() => handleSoundSelect(sound.id)}
                >
                  <View style={styles.radioContainer}>
                    <View style={[
                      styles.radioOuter,
                      currentSoundId === sound.id && styles.radioSelected,
                    ]}>
                      {currentSoundId === sound.id && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text style={styles.soundName}>{sound.name}</Text>
                  </View>
                  {sound.type === 'custom' && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteCustomSound(sound.id)}
                    >
                      <Text style={styles.deleteText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.testButton,
                    testingSound === sound.id && styles.testingButton,
                  ]}
                  onPress={() => handleTestSound(sound.id)}
                  disabled={testingSound !== null}
                >
                  <Text style={styles.testText}>
                    {testingSound === sound.id ? 'Playing...' : 'Test'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* TODO: Re-enable when we have a compatible file picker */}
          {/* <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUploadSound}
          >
            <Text style={styles.uploadText}>+ Upload Custom Sound</Text>
          </TouchableOpacity> */}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeText: {
    fontSize: 24,
    color: '#666',
  },
  soundList: {
    maxHeight: 400,
  },
  soundItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  soundInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedSound: {
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    padding: 5,
    borderRadius: 5,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#007AFF',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  soundName: {
    fontSize: 16,
    color: '#333',
  },
  deleteButton: {
    padding: 5,
  },
  deleteText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  testButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    marginLeft: 10,
  },
  testingButton: {
    backgroundColor: '#666',
  },
  testText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  uploadText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
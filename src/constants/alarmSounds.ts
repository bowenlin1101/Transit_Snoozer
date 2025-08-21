export interface AlarmSound {
  id: string;
  name: string;
  type: 'system' | 'custom';
  uri?: string; // For custom sounds
  systemType?: 'alarm' | 'notification' | 'ringtone'; // For system sounds
}

export const BUILT_IN_SOUNDS: AlarmSound[] = [
  {
    id: 'default_alarm',
    name: 'Default Alarm',
    type: 'system',
    systemType: 'alarm',
  },
  {
    id: 'notification',
    name: 'Notification Bell',
    type: 'system',
    systemType: 'notification',
  },
  {
    id: 'ringtone',
    name: 'Phone Ringtone',
    type: 'system',
    systemType: 'ringtone',
  },
];

export const CUSTOM_SOUND_PLACEHOLDER: AlarmSound = {
  id: 'custom_upload',
  name: 'Upload Custom MP3',
  type: 'custom',
};

export const getAlarmSoundById = (id: string, customSounds: AlarmSound[] = []): AlarmSound | undefined => {
  // Check built-in sounds first
  const builtIn = BUILT_IN_SOUNDS.find(sound => sound.id === id);
  if (builtIn) return builtIn;
  
  // Check custom sounds
  const custom = customSounds.find(sound => sound.id === id);
  if (custom) return custom;
  
  // Default to first built-in sound
  return BUILT_IN_SOUNDS[0];
};

export const MAX_SOUND_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const validateSoundFile = (file: { size?: number; type?: string; name?: string }): { valid: boolean; error?: string } => {
  if (!file.name?.toLowerCase().endsWith('.mp3')) {
    return { valid: false, error: 'Please select an MP3 file' };
  }
  
  if (file.size && file.size > MAX_SOUND_FILE_SIZE) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }
  
  return { valid: true };
};
import React from 'react';
import {
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';

interface TransitAppCardProps {
  appId: string;
  appName: string;
  appIcon: any;
  isSelected: boolean;
  onPress: (appId: string) => void;
  textOpacity?: Animated.Value;
}

const TransitAppCard: React.FC<TransitAppCardProps> = ({
  appId,
  appName,
  appIcon,
  isSelected,
  onPress,
  textOpacity,
}) => {
  const handlePress = () => {
    console.log(`TransitAppCard: onPress called for ${appId}`);
    onPress(appId);
  };

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.selectedCard]}
      onPress={handlePress}
      onPressIn={() => console.log(`TransitAppCard: onPressIn for ${appId}`)}
      onPressOut={() => console.log(`TransitAppCard: onPressOut for ${appId}`)}
      onTouchStart={() => console.log(`TransitAppCard: onTouchStart for ${appId}`)}
      onTouchEnd={() => console.log(`TransitAppCard: onTouchEnd for ${appId}`)}
      activeOpacity={0.7}
    >
      <Image source={appIcon} style={styles.icon} />
      {textOpacity ? (
        <Animated.Text style={[styles.appName, { opacity: textOpacity }]}>{appName}</Animated.Text>
      ) : (
        <Text style={styles.appName}>{appName}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 140,
    height: 140,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  icon: {
    width: 60,
    height: 60,
    marginBottom: 8,
    borderRadius: 12,
  },
  appName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});

export default TransitAppCard;
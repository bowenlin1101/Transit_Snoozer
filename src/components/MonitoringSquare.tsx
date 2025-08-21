import React, { useEffect, useRef } from 'react';
import {
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';

interface MonitoringSquareProps {
  appName: string;
  appIcon: any;
  onPress: () => void;
  textOpacity?: Animated.Value;
}

const MonitoringSquare: React.FC<MonitoringSquareProps> = ({
  appName,
  appIcon,
  onPress,
  textOpacity,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Create pulsing animation
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [scaleAnim]);

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={1}
    >
      <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
        <Image source={appIcon} style={styles.icon} />
        {textOpacity ? (
          <>
            <Animated.Text style={[styles.monitoringText, { opacity: textOpacity }]}>Monitoring</Animated.Text>
            <Animated.Text style={[styles.appName, { opacity: textOpacity }]}>{appName}</Animated.Text>
          </>
        ) : (
          <>
            <Text style={styles.monitoringText}>Monitoring</Text>
            <Text style={styles.appName}>{appName}</Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  content: {
    width: 280,
    height: 280,
    backgroundColor: 'white',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  icon: {
    width: 120,
    height: 120,
    marginBottom: 16,
    borderRadius: 16,
  },
  monitoringText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  appName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
});

export default MonitoringSquare;
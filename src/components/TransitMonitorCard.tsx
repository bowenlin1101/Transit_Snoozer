import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';

export interface TransitMonitorCardRef {
  animateToMonitoring: (options?: { duration?: number }) => Promise<void>;
  animateToNormal: (options?: { duration?: number }) => Promise<void>;
  resetTransitionState: () => void;
}

interface TransitMonitorCardProps {
  appId: string;
  appName: string;
  appIcon: any;
  isSelected: boolean;
  isMonitoring: boolean;
  translateY?: Animated.Value;
  scale?: Animated.Value;
  opacity?: Animated.Value;
  onPress: (appId: string) => void;
  onMonitoringPress: () => void;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
  isGloballyAnimating?: boolean;
}

const TransitMonitorCard = forwardRef<TransitMonitorCardRef, TransitMonitorCardProps>(({
  appId,
  appName,
  appIcon,
  isSelected,
  isMonitoring,
  translateY,
  scale,
  opacity,
  onPress,
  onMonitoringPress,
  pointerEvents = 'auto',
  isGloballyAnimating = false,
}, ref) => {
  const scaleAnim = useRef(new Animated.Value(isMonitoring ? 1 : 0.7)).current;
  // Icon scale adjusted to maintain consistent visual size relative to card
  // When card is 0.7, icon at 1.43 gives same size as card 1.0 with icon 1.0
  const iconScaleAnim = useRef(new Animated.Value(isMonitoring ? 1.5 : 1.43)).current;
  const monitoringTextOpacity = useRef(new Animated.Value(isMonitoring ? 1 : 0)).current;
  const appNameOpacity = useRef(new Animated.Value(isMonitoring ? 0 : 1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const isPressValid = useRef(false);
  const [containerDimensions, setContainerDimensions] = useState({ width: 280, height: 280 });
  const [isTouchDisabled, setIsTouchDisabled] = useState(false);
  const animationQueue = useRef<(() => void)[]>([]);

  // Imperative handle to expose animation methods
  useImperativeHandle(ref, () => ({
    resetTransitionState: () => {
      setIsTransitioning(false);
    },
    
    animateToMonitoring: async (options = {}) => {
      const { duration = 400 } = options;
      
      return new Promise<void>((resolve) => {
        if (isTransitioning) {
          // Queue the animation
          animationQueue.current.push(() => {
            resolve();
          });
          return;
        }

        setIsTransitioning(true);
        
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.spring(iconScaleAnim, {
            toValue: 1.5,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(appNameOpacity, {
            toValue: 0,
            duration: duration / 2,
            useNativeDriver: true,
          }),
          Animated.timing(monitoringTextOpacity, {
            toValue: 1,
            duration: duration / 2,
            delay: duration / 4,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsTransitioning(false);
          resolve();
          
          // Process next animation in queue
          const next = animationQueue.current.shift();
          if (next) next();
        });
      });
    },
    
    animateToNormal: async (options = {}) => {
      const { duration = 400 } = options;
      
      return new Promise<void>((resolve) => {
        if (isTransitioning) {
          // Queue the animation
          animationQueue.current.push(() => {
            resolve();
          });
          return;
        }

        // Stop the pulse animation but don't set transitioning yet
        pulseAnim.stopAnimation();
        pulseAnim.setValue(1);
        
        // Use a minimal delay to ensure the setValue takes effect
        setTimeout(() => {
          setIsTransitioning(true);
          
          // Then start the shrink animations
          Animated.parallel([
          Animated.timing(monitoringTextOpacity, {
            toValue: 0,
            duration: duration / 2,
            useNativeDriver: true,
          }),
          Animated.timing(appNameOpacity, {
            toValue: 1,
            duration: duration / 2,
            delay: duration / 4,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 0.7,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.spring(iconScaleAnim, {
            toValue: 1.43,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }),
          ]).start(() => {
            // Don't reset isTransitioning here - let HomeScreen do it after slide
            resolve();
            
            // Process next animation in queue
            const next = animationQueue.current.shift();
            if (next) next();
          });
        }, 0); // Minimal delay, just next tick
      });
    }
  }));

  // Force reset animations when isMonitoring changes to false (handles force-close scenarios)
  useEffect(() => {
    if (!isMonitoring && !isTransitioning) {
      console.log('Force resetting card animations to normal state');
      // Immediately reset all animation values to normal state without transition
      scaleAnim.setValue(0.7);
      iconScaleAnim.setValue(1.43);
      monitoringTextOpacity.setValue(0);
      appNameOpacity.setValue(1);
      pulseAnim.setValue(1);
    }
  }, [isMonitoring]);

  // Pulse animation when monitoring
  useEffect(() => {
    if (isMonitoring && !isTransitioning) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      
      return () => {
        pulseAnimation.stop();
      };
    }
  }, [isMonitoring, isTransitioning]);

  const handlePress = () => {
    if (isMonitoring) {
      onMonitoringPress();
    } else {
      onPress(appId);
    }
  };

  // Use scaleAnim for container, multiply by pulseAnim only when monitoring and not transitioning
  const containerScale = isMonitoring && !isTransitioning 
    ? Animated.multiply(scaleAnim, pulseAnim)
    : scaleAnim;

  const wrapperStyle = {
    transform: [
      ...(translateY ? [{ translateY }] : []),
      ...(scale ? [{ scale }] : [])
    ],
    opacity: opacity || 1,
  };

  return (
    <Animated.View style={[styles.wrapper, wrapperStyle]} pointerEvents={pointerEvents}>
      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setContainerDimensions({ width, height });
        }}
        onStartShouldSetResponder={() => false}
        onMoveShouldSetResponder={(event) => {
          const { locationX, locationY } = event.nativeEvent;
          
          // Use the same boundary logic as TouchableWithoutFeedback
          // TouchableWithoutFeedback uses the full container dimensions regardless of scale
          // Add a small tolerance to prevent edge cases where touches right on the border get stolen
          const tolerance = 5; // 5px tolerance inside the border
          const effectiveLeft = tolerance;
          const effectiveTop = tolerance;
          const effectiveRight = containerDimensions.width - tolerance;
          const effectiveBottom = containerDimensions.height - tolerance;
          
          // Check if touch is outside the effective bounds (with tolerance)
          const isOutside = locationX < effectiveLeft || 
              locationX > effectiveRight || 
              locationY < effectiveTop || 
              locationY > effectiveBottom;
              
          if (isOutside) {
            console.log('Touch outside bounds - stealing responder and disabling TouchableWithoutFeedback');
            console.log('Location:', locationX, locationY);
            console.log('Effective bounds:', effectiveLeft, effectiveTop, effectiveRight, effectiveBottom);
            console.log('Container dimensions:', containerDimensions);
            setIsPressed(false);
            isPressValid.current = false;
            setIsTouchDisabled(true); // Disable TouchableWithoutFeedback
            return true; // Steal the responder
          }
          
          return false; // Don't steal if inside bounds
        }}
        onResponderGrant={() => {
          console.log('View responder granted - touch is outside bounds');
        }}
        onResponderMove={(event) => {
          // We've already stolen the responder, just maintain the disabled state
          console.log('Responder move - maintaining disabled state');
        }}
        onResponderRelease={() => {
          console.log('Responder released - re-enabling TouchableWithoutFeedback for next touch');
          setIsTouchDisabled(false); // Re-enable for fresh touches
        }}
        onResponderTerminate={() => {
          console.log('Responder terminated - re-enabling TouchableWithoutFeedback for next touch');
          setIsTouchDisabled(false); // Re-enable for fresh touches
        }}
      >
        <TouchableWithoutFeedback
          onPressIn={() => {
            console.log('TouchableWithoutFeedback onPressIn - disabled:', isTouchDisabled, 'isTransitioning:', isTransitioning, 'isGloballyAnimating:', isGloballyAnimating);
            if (!isTransitioning && !isGloballyAnimating) {
              setIsPressed(true);
              isPressValid.current = true;
              setIsTouchDisabled(false); // Re-enable on fresh touch
              console.log('Press started - isTouchDisabled reset to false');
            }
          }}
          onPressOut={() => {
            console.log('TouchableWithoutFeedback onPressOut');
            setIsPressed(false);
          }}
          onPress={() => {
            if (isPressValid.current && !isTransitioning && !isGloballyAnimating) {
              handlePress();
            }
          }}
          disabled={isTransitioning || isGloballyAnimating || isTouchDisabled}
        >
          <Animated.View 
            style={[
              styles.container,
              isSelected && styles.selectedContainer,
              isPressed && !isMonitoring && styles.pressedContainer,
              {
                transform: [{ scale: containerScale }],
              },
            ]}
          >
            <Animated.Image 
              source={appIcon} 
              style={[
                styles.icon,
                {
                  transform: [{ scale: iconScaleAnim }],
                }
              ]} 
            />
            
            <Animated.Text 
              style={[
                styles.monitoringText, 
                { opacity: monitoringTextOpacity }
              ]}
            >
              Monitoring
            </Animated.Text>
            
            <Animated.Text 
              style={[
                styles.appName,
                { opacity: appNameOpacity }
              ]}
            >
              {appName}
            </Animated.Text>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  container: {
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
  selectedContainer: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  icon: {
    width: 100,
    height: 100,
    marginBottom: 12,
    borderRadius: 20,
  },
  appName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    position: 'absolute',
    bottom: 30,
  },
  monitoringText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    position: 'absolute',
    bottom: 25,
  },
  pressedContainer: {
    opacity: 0.7,
  },
});

export default TransitMonitorCard;
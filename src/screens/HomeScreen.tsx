import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  AppState,
  NativeEventEmitter,
  NativeModules,
  Animated,
  Dimensions,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootState } from '../store';
import { RootStackParamList, TransitRoute } from '../types';
import NotificationListener from '../native/NotificationListener';
import { setListeningStatus, setSelectedApp } from '../store/slices/notificationSlice';
import { NotificationParser } from '../services/NotificationParser';
import { updateRouteProgress, addRoute, setActiveRoute } from '../store/slices/routeSlice';
import GoogleMapsParser from '../utils/googleMapsParser';
import AlarmService from '../services/AlarmService';
import TransitMonitorCard, { TransitMonitorCardRef } from '../components/TransitMonitorCard';
import { TRANSIT_APPS } from '../constants/transitApps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SoundPlayer from 'react-native-sound-player';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const dispatch = useDispatch();
  const activeRoute = useSelector((state: RootState) => state.routes.activeRoute);
  const isListening = useSelector((state: RootState) => state.notifications.isListening);
  const selectedApp = useSelector((state: RootState) => state.notifications.selectedApp);
  const [notificationListenerEnabled, setNotificationListenerEnabled] = useState(false);
  const alarmSettings = useSelector((state: RootState) => state.settings.alarm);
  const [lastNotification, setLastNotification] = useState<{
    appName: string;
    title: string;
    text: string;
    subText: string;
  } | null>(null);
  const [notificationUnsubscribe, setNotificationUnsubscribe] = useState<(() => void) | null>(null);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [alarmMessage, setAlarmMessage] = useState('');
  const [shouldStopMonitoring, setShouldStopMonitoring] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const textOpacityAnim = useRef(new Animated.Value(1)).current;
  const notificationsPaneOpacity = useRef(new Animated.Value(0)).current;
  
  // Animation refs for card sliding
  const cardTranslateY = useRef([
    new Animated.Value(0), // Google Maps card
    new Animated.Value(0), // Transit card
  ]).current;
  const cardScale = useRef([
    new Animated.Value(1), // Google Maps card
    new Animated.Value(1), // Transit card
  ]).current;
  const cardOpacity = useRef([
    new Animated.Value(1), // Google Maps card
    new Animated.Value(1), // Transit card
  ]).current;
  
  // Refs for card components
  const cardRefs = useRef<(TransitMonitorCardRef | null)[]>([]);

  // Simple sound functions
  const playStartSound = () => {
    try {
      SoundPlayer.playAsset(require('../assets/sound_effects/start_tracking.mp3'));
    } catch (e) {
      console.log('Could not play start sound:', e);
    }
  };
  
  const playStopSound = () => {
    try {
      SoundPlayer.playAsset(require('../assets/sound_effects/stop_tracking.mp3'));
    } catch (e) {
      console.log('Could not play stop sound:', e);
    }
  };

  useEffect(() => {
    // Update alarm settings in native module whenever they change
    NotificationListener.updateAlarmSettings(1, alarmSettings.debugMode, alarmSettings.volume, alarmSettings.alarmSound);
    console.log('Updated alarm settings - debugMode:', alarmSettings.debugMode, 'volume:', alarmSettings.volume, 'alarmSound:', alarmSettings.alarmSound);
  }, [alarmSettings.debugMode, alarmSettings.volume, alarmSettings.alarmSound]);

  useEffect(() => {
    // Animate text opacity when listening state changes
    Animated.parallel([
      Animated.timing(textOpacityAnim, {
        toValue: isListening ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(notificationsPaneOpacity, {
        toValue: isListening ? 1 : 0,
        duration: 300,
        delay: isListening ? 200 : 0, // Delay fade in for smoother transition
        useNativeDriver: true,
      })
    ]).start();
  }, [isListening]);

  // Clean monitoring state before initial render to prevent visual glitches
  useLayoutEffect(() => {
    // Synchronously clear selected app to ensure cards render in correct initial state
    dispatch(setSelectedApp(null));
    dispatch(setListeningStatus(false));
  }, []);

  useEffect(() => {
    // Validate and clean monitoring state on mount to handle force-close scenarios
    const cleanupStaleMonitoringState = async () => {
      // If we think we're listening but the native listener isn't actually enabled,
      // reset the state to match reality
      const isNativeListenerEnabled = await NotificationListener.isEnabled();
      
      if (isListening && !isNativeListenerEnabled) {
        console.log('Detected stale listening state after app restart - cleaning up');
        dispatch(setListeningStatus(false));
      }
    };
    
    cleanupStaleMonitoringState();
    
    // Track app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground');
        // Check if alarm is active when app comes to foreground
        checkAlarmStatus();
      }
      appState.current = nextAppState;
      setAppStateVisible(nextAppState);
    });

    // Listen for alarm notification clicks
    const eventEmitter = new NativeEventEmitter();
    const alarmSubscription = eventEmitter.addListener('onAlarmNotificationClick', (event) => {
      console.log('Alarm notification clicked, checking alarm status');
      if (event.showAlarmDialog) {
        // Just check the alarm status to update UI
        checkAlarmStatus();
      }
    });
    
    // Listen for alarm state changes
    const alarmStateUnsubscribe = AlarmService.onAlarmStateChange((state) => {
      console.log('Alarm state changed:', state);
      setIsAlarmActive(state.isActive);
      setAlarmMessage(state.message);
    });

    // Delay initial setup to ensure React is fully ready
    const timer = setTimeout(() => {
      checkPermissions();
      
      // Check if alarm is active on mount
      checkAlarmStatus();
    }, 1000); // Wait 1 second for React to be ready
    
    // Cleanup on unmount
    return () => {
      clearTimeout(timer);
      subscription.remove();
      alarmSubscription.remove();
      alarmStateUnsubscribe();
      if (notificationUnsubscribe) {
        notificationUnsubscribe();
      }
    };
  }, []);


  useEffect(() => {
    // Handle stop monitoring when confirmed
    if (shouldStopMonitoring) {
      handleStopConfirmed();
    }
  }, [shouldStopMonitoring]);

  useEffect(() => {
    // Set up notification listener
    const unsubscribe = setupNotificationListener();
    
    // Store cleanup function
    setNotificationUnsubscribe(() => unsubscribe);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [selectedApp]); // Re-setup listener when selectedApp changes

  const checkPermissions = async () => {
    const isEnabled = await NotificationListener.isEnabled();
    setNotificationListenerEnabled(isEnabled);
    
    if (!isEnabled) {
      Alert.alert(
        'Permission Required',
        'Please enable notification access for Transit Snoozer to monitor your transit apps.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Settings', onPress: () => NotificationListener.openSettings() },
        ]
      );
    }
  };

  const shouldTriggerAlarmForNotification = (title: string, text: string): boolean => {
    const combinedText = `${title} ${text}`.toLowerCase();
    
    console.log('Checking alarm trigger keywords - text:', combinedText);
    
    // Simplified: only trigger on arrival keywords
    return combinedText.includes('next stop') ||
           combinedText.includes('final stop') ||
           combinedText.includes('last stop') ||
           combinedText.includes('get off at the next stop') ||
           combinedText.includes('arriving at');
  };

  const checkAlarmStatus = async () => {
    // Check both JS and native alarm status
    const jsAlarmActive = AlarmService.isAlarmActive();
    let message = AlarmService.getCurrentAlarmMessage();
    
    // Also check native alarm status
    let nativeAlarmActive = false;
    let nativeMessage = '';
    try {
      nativeAlarmActive = await NotificationListener.isAlarmPlaying();
      if (nativeAlarmActive && !message) {
        // If native alarm is playing but JS doesn't have message, get it from native
        nativeMessage = await NotificationListener.getAlarmMessage();
      }
    } catch (error) {
      console.log('Error checking native alarm status:', error);
    }
    
    const alarmActive = jsAlarmActive || nativeAlarmActive;
    const finalMessage = message || nativeMessage || 'Transit Alarm Active';
    
    console.log('Checking alarm status - JS:', jsAlarmActive, 'Native:', nativeAlarmActive, 'Message:', finalMessage);
    
    setIsAlarmActive(alarmActive);
    setAlarmMessage(finalMessage);
    
    if (alarmActive) {
      // Show stop alarm UI
      console.log('Alarm is active, showing stop UI');
    }
  };

  const setupNotificationListener = () => {
    const unsubscribe = NotificationListener.onNotificationReceived((notification) => {
      // Filter by selected app
      if (selectedApp && notification.packageName !== selectedApp) {
        console.log(`Ignoring notification from ${notification.packageName}, monitoring ${selectedApp}`);
        return; // Ignore notifications from other apps
      }
      
      // Store the full notification details
      setLastNotification({
        appName: notification.appName,
        title: notification.title || '',
        text: notification.text || '',
        subText: notification.subText || '',
      });
      
      // Only trigger alarm from JS if app is in foreground
      // Background alarms are handled natively
      if (appState.current === 'active') {
        console.log('HomeScreen: Transit notification detected (foreground)');
        console.log('HomeScreen: Alarm settings:', JSON.stringify(alarmSettings));
        
        // Check if debug mode is enabled or notification contains alarm trigger keywords
        const fullText = notification.bigText || notification.text || '';
        if (alarmSettings.debugMode) {
          console.log('HomeScreen: Debug mode enabled - triggering alarm for any Google Maps notification');
          const message = `${notification.appName}: ${notification.title || 'Transit Update'}`;
          console.log('HomeScreen: Triggering alarm with message:', message);
          
          // Use the alarm service which handles everything
          AlarmService.triggerAlarm(alarmSettings, message, false, notification.title);
        } else if (shouldTriggerAlarmForNotification(notification.title || '', fullText)) {
          console.log('HomeScreen: Alarm trigger keywords found!');
          const message = `${notification.appName}: ${notification.title || 'Transit Update'}`;
          console.log('HomeScreen: Triggering alarm with message:', message);
          
          // Use the alarm service which handles everything
          AlarmService.triggerAlarm(alarmSettings, message, false, notification.title);
        } else {
          console.log('HomeScreen: No alarm trigger keywords found');
        }
      } else {
        console.log('HomeScreen: Notification received but app in background, alarm already triggered natively');
      }
      
      const parsed = NotificationParser.parseTransitNotification(notification);
      
      if (NotificationParser.isTransitNotification(parsed) && activeRoute) {
        // Update route progress if we have an active route
        const segment = activeRoute.segments.find(s => 
          s.line === parsed.parsedData?.line
        );
        
        if (segment && parsed.parsedData?.stopsRemaining !== undefined) {
          const currentStop = segment.totalStops - parsed.parsedData.stopsRemaining;
          dispatch(updateRouteProgress({
            segmentId: segment.id,
            currentStop,
          }));
          
          // Check if we should trigger alarm
          if (NotificationParser.shouldTriggerAlarm(parsed, 1, activeRoute.destination)) { // Using 1 as default
            const destinationInfo = NotificationParser.extractDestinationInfo(parsed, activeRoute.destination);
            const message = destinationInfo || 
              `Approaching ${activeRoute.destination}! ${parsed.parsedData?.stopsRemaining || 'Few'} stops remaining`;
            AlarmService.triggerAlarm(alarmSettings, message, false, notification.title);
          }
        }
      }
    });

    return unsubscribe;
  };

  const handleAppSelect = async (appId: string) => {
    if (isAnimating) return; // Prevent multiple animations
    
    console.log(`HomeScreen: App selected: ${appId}`);
    
    // Check permissions FIRST before any animations
    const isEnabled = await NotificationListener.isEnabled();
    if (!isEnabled) {
      Alert.alert(
        'Permission Required',
        'Please enable notification access for Transit Snoozer to monitor notifications.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => NotificationListener.openSettings() },
        ]
      );
      return; // Exit without animating
    }
    
    // Check background activity permission
    const backgroundPermissionAcknowledged = await AsyncStorage.getItem('backgroundPermissionAcknowledged');
    if (backgroundPermissionAcknowledged !== 'true') {
      Alert.alert(
        'Background Activity Required',
        'To keep Transit Snoozer running while monitoring:\n\n1. Tap "Open Settings"\n2. Look for "Battery" or "Background activity"\n3. Enable "Allow background activity" or set to "Unrestricted"\n4. Return here and tap "I\'ve Done This"',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: async () => {
              await NotificationListener.openAppSettings();
              // Show confirmation dialog after they return
              setTimeout(() => {
                Alert.alert(
                  'Did you configure background settings?',
                  'Please confirm that you\'ve enabled "Allow background activity" or set the app to "Unrestricted" in battery settings.',
                  [
                    { text: 'Not Yet', style: 'cancel' },
                    { 
                      text: 'I\'ve Done This', 
                      onPress: async () => {
                        await AsyncStorage.setItem('backgroundPermissionAcknowledged', 'true');
                        // Retry the app selection
                        handleAppSelect(appId);
                      }
                    }
                  ]
                );
              }, 1000);
            }
          },
        ]
      );
      return; // Exit without animating
    }
    
    // Also check notification permission for alarms
    try {
      const notifee = require('@notifee/react-native').default;
      const settings = await notifee.requestPermission();
      
      if (settings.authorizationStatus === 0) {
        Alert.alert(
          'Notification Permission Required',
          'Please allow notifications to receive transit alarms.',
          [{ text: 'OK' }]
        );
        return; // Exit without animating
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
    
    // Now that permissions are confirmed, start animations
    setIsAnimating(true);
    
    // Find which card was selected
    const selectedIndex = TRANSIT_APPS.findIndex(app => app.id === appId);
    if (selectedIndex === -1) {
      setIsAnimating(false);
      return;
    }
    
    // Calculate vertical position (assuming card is 280px tall with 20px margin)
    const cardHeight = 280;
    const cardMargin = 20;
    const totalCardHeight = cardHeight + cardMargin;
    
    // Position at 40% from top instead of center (50%)
    // For 2 cards stacked, we need to move them by different amounts
    // The offset is 10% up from center (40% instead of 50%)
    const centerOffset = selectedIndex === 0 ? totalCardHeight / 2 : -totalCardHeight / 2;
    const upwardShift = totalCardHeight * 0.2; // 10% of container height (50% - 40%)
    const finalOffset = centerOffset - upwardShift;
    
    // Animate: scale down other cards first, then slide selected to center
    Animated.sequence([
      // Step 1: Scale down and fade out non-selected cards
      Animated.parallel([
        ...TRANSIT_APPS.map((_, index) => {
          if (index !== selectedIndex) {
            return [
              Animated.timing(cardScale[index], {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(cardOpacity[index], {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              })
            ];
          }
          return [
            Animated.timing(cardScale[index], {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(cardOpacity[index], {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            })
          ];
        }).flat().filter(Boolean)
      ]),
      // Step 2: Slide selected card to 40% from top
      Animated.timing(cardTranslateY[selectedIndex], {
        toValue: finalOffset,
        duration: 400,
        useNativeDriver: true,
      })
    ]).start(async () => {
      // Step 3: Wait, then play sound 70ms earlier than original
      await new Promise(resolve => setTimeout(resolve, 410));
      
      // Play start tracking sound 70ms earlier
      playStartSound();
      
      // Wait remaining time to complete the 500ms total
      await new Promise(resolve => setTimeout(resolve, 90));
      
      // Step 4: Animate card to monitoring state
      const selectedCard = cardRefs.current[selectedIndex];
      if (selectedCard) {
        await selectedCard.animateToMonitoring({ duration: 400 });
      }
      
      // Step 5: Start monitoring
      const selectedTransitApp = TRANSIT_APPS.find(a => a.id === appId);
      if (selectedTransitApp) {
        dispatch(setSelectedApp(selectedTransitApp.packageName));
        startListening(selectedTransitApp.packageName); // Pass package name directly
      }
      setIsAnimating(false);
    });
  };

  const handleMonitoringSquarePress = () => {
    Alert.alert(
      'Stop Monitoring',
      'Are you sure you want to stop monitoring?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Stop', 
          style: 'destructive',
          onPress: () => {
            // Trigger the stop animation
            setShouldStopMonitoring(true);
          }
        }
      ]
    );
  };

  const startListening = async (packageName?: string) => {
    // First check notification listener permission
    const isEnabled = await NotificationListener.isEnabled();
    if (!isEnabled) {
      Alert.alert(
        'Permission Required',
        'Please enable notification access for Transit Snoozer to monitor notifications.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => NotificationListener.openSettings() },
        ]
      );
      return;
    }
    
    // Also request notification permission for alarms
    try {
      const notifee = require('@notifee/react-native').default;
      const settings = await notifee.requestPermission();
      
      if (settings.authorizationStatus === 0) {
        Alert.alert(
          'Notification Permission Required',
          'Please allow notifications to receive transit alarms.',
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
    
    // Update alarm settings in native module
    NotificationListener.updateAlarmSettings(1, alarmSettings.debugMode, alarmSettings.volume, alarmSettings.alarmSound);
    
    // Use the passed packageName or fall back to selectedApp from state
    const appPackage = packageName || selectedApp;
    await NotificationListener.startListening(appPackage || undefined);
    dispatch(setListeningStatus(true));
    
    // Log that we started listening
    console.log('Started notification listening with debugMode:', alarmSettings.debugMode, 'volume:', alarmSettings.volume, 'alarmSound:', alarmSettings.alarmSound);
  };

  const stopListening = async () => {
    await NotificationListener.stopListening();
    dispatch(setListeningStatus(false));
    dispatch(setSelectedApp(null));
    
    // Clear the dismissed notification memory when stopping monitoring
    AlarmService.clearDismissedNotification();
    
    // Clear the last notification display
    setLastNotification(null);
    
    // Reset text opacity
    textOpacityAnim.setValue(1);
  };

  const handleStopConfirmed = async () => {
    // Reset the flag
    setShouldStopMonitoring(false);
    setIsAnimating(true);
    
    // Play stop tracking sound
    playStopSound();
    
    // Find which card is currently selected
    const selectedIndex = TRANSIT_APPS.findIndex(app => app.packageName === selectedApp);
    if (selectedIndex !== -1) {
      // Step 1: Fade out notifications and text first
      await new Promise<void>((resolve) => {
        Animated.parallel([
          Animated.timing(notificationsPaneOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(textOpacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          })
        ]).start(() => resolve());
      });
      
      // Step 2: Animate card back to normal
      const selectedCard = cardRefs.current[selectedIndex];
      if (selectedCard) {
        await selectedCard.animateToNormal({ duration: 400 });
      }
      
      // Step 3-4: Slide card back and fade in other cards
      Animated.sequence([
        // Step 3: Slide card back to original position
        Animated.timing(cardTranslateY[selectedIndex], {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        // Step 4: Scale up and fade in other cards
        Animated.parallel([
          ...TRANSIT_APPS.map((_, index) => {
            if (index !== selectedIndex) {
              return [
                Animated.timing(cardScale[index], {
                  toValue: 1,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(cardOpacity[index], {
                  toValue: 1,
                  duration: 200,
                  useNativeDriver: true,
                })
              ];
            }
            return [
              Animated.timing(cardScale[index], {
                toValue: 1,
                duration: 0,
                useNativeDriver: true,
              }),
              Animated.timing(cardOpacity[index], {
                toValue: 1,
                duration: 0,
                useNativeDriver: true,
              })
            ];
          }).flat().filter(Boolean)
        ])
      ]).start(async () => {
        // Step 5: Stop monitoring
        await stopListening();
        
        // Step 6: Reset transition state on the card now that everything is done
        const selectedCard = cardRefs.current[selectedIndex];
        if (selectedCard) {
          selectedCard.resetTransitionState();
        }
        
        setIsAnimating(false);
      });
    } else {
      // Fallback if somehow no card is selected
      await stopListening();
      setIsAnimating(false);
    }
  };



  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Transit Monitoring</Text>
          
          <Animated.Text style={[styles.selectAppText, {
            opacity: textOpacityAnim
          }]}>Select a transit app to monitor:</Animated.Text>
          
          <View style={styles.cardContent}>
            {TRANSIT_APPS.map((app, index) => (
              <TransitMonitorCard
                ref={el => cardRefs.current[index] = el}
                key={app.id}
                appId={app.id}
                appName={app.displayName}
                appIcon={app.icon}
                isSelected={false}
                isMonitoring={isListening && selectedApp === app.packageName}
                translateY={cardTranslateY[index]}
                scale={cardScale[index]}
                opacity={cardOpacity[index]}
                onPress={handleAppSelect}
                onMonitoringPress={handleMonitoringSquarePress}
                pointerEvents={isListening && selectedApp && selectedApp !== app.packageName ? 'none' : 'auto'}
                isGloballyAnimating={isAnimating}
              />
            ))}
          </View>
          
          <Animated.View 
            style={[styles.debugInfo, {
              opacity: notificationsPaneOpacity
            }]}
            pointerEvents={isListening ? 'auto' : 'none'}
          >
            <Text style={styles.debugTitle}>Last Notification:</Text>
            <View style={styles.notificationDetails}>
              {lastNotification ? (
                <>
                  <Text style={styles.notificationHeader}>{lastNotification.title}</Text>
                  {lastNotification.text ? (
                    <Text style={styles.notificationText}>{lastNotification.text}</Text>
                  ) : null}
                  {lastNotification.subText ? (
                    <Text style={styles.notificationSubText}>{lastNotification.subText}</Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.notificationText}> </Text>
              )}
            </View>
          </Animated.View>
        </View>
      </View>

      <View style={styles.bottomMenu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.menuItemText}>Settings</Text>
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Permissions')}>
          <Text style={styles.menuItemText}>Permissions</Text>
        </TouchableOpacity>
      </View>
    
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
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mainContent: {
    flex: 1,
    paddingTop: 40, // Add top padding since header is removed
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  statusCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 24,
    color: '#4CAF50',
    marginBottom: 16,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuItem: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  debugInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    minHeight: 100,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 14,
    color: '#333',
  },
  notificationDetails: {
    marginTop: 4,
  },
  notificationHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  notificationSubText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  appCardsContainer: {
    alignItems: 'center',
  },
  selectAppText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    marginBottom: 16,
    alignSelf: 'center',
  },
  bottomMenu: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  menuDivider: {
    width: 1,
    backgroundColor: '#eee',
  },
});

export default HomeScreen;
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../store';
import { cancelRoute, completeRoute } from '../store/slices/routeSlice';

function ActiveRouteScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const activeRoute = useSelector((state: RootState) => state.routes.activeRoute);
  const alarmSettings = useSelector((state: RootState) => state.settings.alarm);

  if (!activeRoute) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No active route</Text>
      </View>
    );
  }

  const handleCancelRoute = () => {
    Alert.alert(
      'Cancel Route',
      'Are you sure you want to cancel tracking this route?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            dispatch(cancelRoute());
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleCompleteRoute = () => {
    dispatch(completeRoute());
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.routeCard}>
        <Text style={styles.routeTitle}>Current Journey</Text>
        <View style={styles.routeInfo}>
          <Text style={styles.label}>From:</Text>
          <Text style={styles.value}>{activeRoute.origin}</Text>
        </View>
        <View style={styles.routeInfo}>
          <Text style={styles.label}>To:</Text>
          <Text style={styles.value}>{activeRoute.destination}</Text>
        </View>
        <View style={styles.routeInfo}>
          <Text style={styles.label}>Total Segments:</Text>
          <Text style={styles.value}>{activeRoute.segments.length}</Text>
        </View>
      </View>

      <View style={styles.alarmCard}>
        <Text style={styles.cardTitle}>Alarm Settings</Text>
        <Text style={styles.alarmInfo}>
          Alarm will trigger {alarmSettings.alarmAtStops} {alarmSettings.alarmAtStops === 1 ? 'stop' : 'stops'} before destination
        </Text>
        <View style={styles.alarmStatus}>
          <Text style={styles.label}>Alarm:</Text>
          <Text style={[styles.value, { color: alarmSettings.enabled ? '#4CAF50' : '#f44336' }]}>
            {alarmSettings.enabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
      </View>

      {activeRoute.segments.map((segment, index) => (
        <View key={segment.id} style={styles.segmentCard}>
          <Text style={styles.segmentTitle}>
            Segment {index + 1}: {segment.transportType.toUpperCase()}
          </Text>
          <View style={styles.segmentInfo}>
            <Text style={styles.label}>Line:</Text>
            <Text style={styles.value}>{segment.line}</Text>
          </View>
          <View style={styles.segmentInfo}>
            <Text style={styles.label}>Direction:</Text>
            <Text style={styles.value}>{segment.direction}</Text>
          </View>
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Progress:</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(segment.currentStop / segment.totalStops) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              Stop {segment.currentStop} of {segment.totalStops}
            </Text>
          </View>
          {segment.stopsRemaining <= alarmSettings.alarmAtStops && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertText}>
                {segment.stopsRemaining} {segment.stopsRemaining === 1 ? 'stop' : 'stops'} remaining!
              </Text>
            </View>
          )}
        </View>
      ))}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.completeButton]}
          onPress={handleCompleteRoute}>
          <Text style={styles.buttonText}>Complete Journey</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancelRoute}>
          <Text style={styles.buttonText}>Cancel Tracking</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
  },
  routeCard: {
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
  routeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  routeInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  alarmCard: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2E7D32',
  },
  alarmInfo: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 8,
  },
  alarmStatus: {
    flexDirection: 'row',
  },
  segmentCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  segmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  segmentInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
    minWidth: 80,
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  progressContainer: {
    marginTop: 12,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
  alertBanner: {
    backgroundColor: '#FFE0B2',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  alertText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E65100',
    textAlign: 'center',
  },
  actionButtons: {
    margin: 16,
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  completeButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ActiveRouteScreen;
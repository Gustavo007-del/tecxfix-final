// E:\study\techfix\techfix-app\src\screens\AttendanceScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';
import { LocationTrackingService } from '../services/locationTracking';



const formatUtcTimeToLocalIST = (timeString) => {
  if (!timeString) return null;


  try {
    // timeString format: "08:21:37.154940"
    const [h, m, sWithMs] = timeString.split(':');
    const [s] = sWithMs.split('.');
   
    // Create a date object with current date in local timezone
    const now = new Date();
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
                             parseInt(h), parseInt(m), parseInt(s));
   
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(localDate.getTime() + istOffset);
   
    // Format options for 12-hour time with AM/PM
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    };
   
    return istTime.toLocaleTimeString('en-IN', options);
  } catch (error) {
    console.error('Time format error:', error);
    return timeString;
  }
};



export default function AttendanceScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { state, signOut } = useContext(AuthContext);


  useEffect(() => {
    fetchAttendanceStatus();
    return () => {
      // Stop tracking if component unmounts
      LocationTrackingService.isTracking().then(isTracking => {
        if (isTracking) {
          console.log('Component unmounting, but tracking continues in background');
        }
      });
    };
  }, []);


  const fetchAttendanceStatus = async () => {
    try {
      const response = await client.get('/attendance/today/');
      setAttendance(response.data);
    } catch (error) {
      setAttendance(null);
    } finally {
      setLoading(false);
    }
  };


  const getCurrentLocation = async () => {
    // First, check if we already have permission
    let { status } = await Location.getForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      // If permission was denied, show message to enable from settings
      Alert.alert(
        'Location Permission Required',
        'TECHFIX needs location access for:\n\n• Accurate attendance verification\n• Work hour location tracking\n• Technician safety monitoring\n\nPlease enable location in settings to continue.',
        [
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.openSettings();
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
      throw new Error('Location permission not granted');
    }

    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Location timeout - please try again'));
      }, 20000);

      try {
        // First, try to get last known location (instant)
        try {
          const lastLocation = await Location.getLastKnownPositionAsync();
          if (lastLocation?.coords) {
            clearTimeout(timeout);
            resolve({
              latitude: lastLocation.coords.latitude,
              longitude: lastLocation.coords.longitude,
              accuracy: lastLocation.coords.accuracy,
            });
            return;
          }
        } catch (lastLocError) {
          console.warn('Last known location failed:', lastLocError);
        }

        // If no last location, try high accuracy
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10, // Minimum change in meters between updates
          timeInterval: 5000,   // Minimum time in ms between updates
        });

        clearTimeout(timeout);

        resolve({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        });
      } catch (error) {
        clearTimeout(timeout);
        console.error('Location error:', error);
        
        // Provide more user-friendly error messages
        let errorMessage = 'Failed to get location';
        if (error.code === 'E_LOCATION_TIMEOUT') {
          errorMessage = 'Location request timed out. Please try again in an open area.';
        } else if (error.code === 'E_LOCATION_SERVICES_DISABLED') {
          errorMessage = 'Location services are disabled. Please enable them in your device settings.';
        } else if (error.code === 'E_LOCATION_UNAVAILABLE') {
          errorMessage = 'Location is not available. Please check your connection and try again.';
        }
        
        reject(new Error(errorMessage));
      }
    });
  };


  const handleCheckIn = async () => {
  if (checkingIn) return;

  setCheckingIn(true);
  try {
    const location = await getCurrentLocation();

    // Existing check-in API call
    const response = await client.post('/attendance/check-in/', {
      latitude: location.latitude,
      longitude: location.longitude,
    });

    if (response.data.success) {
      setAttendance(response.data.data);
      
      // START LOCATION TRACKING (NEW)
      try {
        await client.post('/tracking/check-in/');
        const trackingResult = await LocationTrackingService.startTracking();
        
        if (!trackingResult.success) {
          console.warn('Location tracking failed to start:', trackingResult.error);
        } else {
          console.log('Location tracking started successfully');
        }
      } catch (trackingError) {
        console.error('Error starting location tracking:', trackingError);
        // Don't fail check-in if tracking fails
      }
      
      Alert.alert('✓ Check-in Successful');
    }
  } catch (error) {
    console.error('Check-in error:', error);
    Alert.alert(
      'Check-in Failed',
      error.response?.data?.error || error.message || 'Failed to check in'
    );
  } finally {
    setCheckingIn(false);
  }
};


  const handleCheckOut = async () => {
  if (checkingOut) return;

  setCheckingOut(true);
  try {
    const location = await getCurrentLocation();

    // Existing check-out API call
    const response = await client.post('/attendance/check-out/', {
      latitude: location.latitude,
      longitude: location.longitude,
    });

    if (response.data.success) {
      setAttendance(response.data.data);
      
      // STOP LOCATION TRACKING (NEW)
      try {
        await client.post('/tracking/check-out/');
        const trackingResult = await LocationTrackingService.stopTracking();
        
        if (!trackingResult.success) {
          console.warn('Location tracking failed to stop:', trackingResult.error);
        } else {
          console.log('Location tracking stopped successfully');
        }
      } catch (trackingError) {
        console.error('Error stopping location tracking:', trackingError);
        // Don't fail check-out if tracking fails
      }
      
      Alert.alert('✓ Check-out Successful');
    }
  } catch (error) {
    console.error('Check-out error:', error);
    Alert.alert(
      'Check-out Failed',
      error.response?.data?.error || error.message || 'Failed to check out'
    );
  } finally {
    setCheckingOut(false);
  }
};


  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAttendanceStatus();
    setRefreshing(false);
  };


  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };


  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }


  const isCheckedIn = attendance?.check_in_time;
  const isCheckedOut = attendance?.check_out_time;


  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Attendance</Text>
            <Text style={styles.headerSubtitle}>{state.user?.first_name || 'Tech'}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout}>
            <MaterialIcons name="logout" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Today's Status</Text>

          {isCheckedIn ? (
            <View style={styles.statusRow}>
              <MaterialIcons name="check-circle" size={24} color={COLORS.success} />
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Check-In Time (IST)</Text>
                <Text style={styles.statusValue}>
                  {formatUtcTimeToLocalIST(isCheckedIn)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noDataText}>Not checked in yet</Text>
          )}

          {isCheckedOut && (
            <View style={styles.statusRow}>
              <MaterialIcons name="check-circle" size={24} color={COLORS.danger} />
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Check-Out Time (IST)</Text>
                <Text style={styles.statusValue}>
                  {formatUtcTimeToLocalIST(isCheckedOut)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {!isCheckedIn ? (
            <TouchableOpacity
              style={[styles.button, styles.checkInButton, checkingIn && styles.disabledButton]}
              onPress={handleCheckIn}
              disabled={checkingIn}
            >
              {checkingIn ? (
                <ActivityIndicator color={COLORS.dark} />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={24} color={COLORS.dark} />
                  <Text style={styles.buttonText}>Check In</Text>
                </>
              )}
            </TouchableOpacity>
          ) : !isCheckedOut ? (
            <TouchableOpacity
              style={[styles.button, styles.checkOutButton, checkingOut && styles.disabledButton]}
              onPress={handleCheckOut}
              disabled={checkingOut}
            >
              {checkingOut ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={24} color={COLORS.white} />
                  <Text style={[styles.buttonText, { color: COLORS.white }]}>Check Out</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.button, styles.completedButton]}>
              <MaterialIcons name="task-alt" size={24} color={COLORS.white} />
              <Text style={[styles.buttonText, { color: COLORS.white }]}>Day Completed</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.button, styles.courierButton]}
            onPress={() => navigation.navigate('CourierHistory')}
          >
            <MaterialIcons name="local-shipping" size={24} color={COLORS.white} />
            <Text style={[styles.buttonText, { color: COLORS.white, marginLeft: 8 }]}>View My Couriers</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: COLORS.dark,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.light,
    marginTop: 4,
  },
  statusCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  statusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    color: COLORS.dark,
    fontWeight: '600',
    marginTop: 4,
  },
  noDataText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    paddingVertical: 20,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  checkInButton: {
    backgroundColor: COLORS.primary,
  },
  checkOutButton: {
    backgroundColor: COLORS.danger,
  },
  completedButton: {
    backgroundColor: COLORS.success,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginLeft: 12,
  },
  // Add to the styles object:
courierButton: {
    backgroundColor: COLORS.secondary,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
},
});
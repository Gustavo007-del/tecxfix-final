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
import {
  syncTechnicianStockSnapshot,
  syncTrackingSnapshot,
} from '../api/snapshotSync';
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
        }
      });
    };
  }, []);


  const fetchAttendanceStatus = async () => {
    try {
      const response = await client.get('/attendance/today/');
      setAttendance(response.data);
    } catch (error) {
      // 404 is expected when no attendance record exists for today
      if (error.response?.status === 404) {
        setAttendance(null);
      } else {
        setAttendance(null);
      }
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
      
      // Location tracking is currently disabled. Keep this for future use.
      // try {
      //   await client.post('/tracking/check-in/');
      //   const trackingResult = await LocationTrackingService.startTracking();
      //   if (!trackingResult.success) {
      //     console.error('Tracking failed:', trackingResult.error);
      //   }
      // } catch (trackingError) {
      //   console.log('Tracking check-in failed:', trackingError.message);
      // }
      
      Alert.alert('✓ Check-in Successful');
    }
  } catch (error) {
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
      
      // Location tracking is currently disabled. Keep this for future use.
      // try {
      //   await client.post('/tracking/check-out/');
      //   const trackingResult = await LocationTrackingService.stopTracking();
      //   if (!trackingResult.success) {
      //     console.error('Tracking stop failed:', trackingResult.error);
      //   }
      // } catch (trackingError) {
      //   console.log('Tracking check-out failed:', trackingError.message);
      // }
      
      Alert.alert('✓ Check-out Successful');
    }
  } catch (error) {
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
    await syncTrackingSnapshot();
    await syncTechnicianStockSnapshot();
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.greetingBlock}>
            <Text style={styles.headerEyebrow}>TECHFIX FIELD APP</Text>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              Welcome back, {state.user?.first_name || state.user?.username || 'Technician'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} accessibilityLabel="Log out">
            <MaterialIcons name="logout" size={21} color={COLORS.dark} />
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusCardTop}>
            <View style={styles.statusIconWrap}>
              <MaterialIcons name={isCheckedIn ? 'verified' : 'schedule'} size={23} color={COLORS.primary} />
            </View>
            <View style={[styles.statusPill, isCheckedOut ? styles.statusPillComplete : isCheckedIn ? styles.statusPillActive : styles.statusPillPending]}>
              <View style={[styles.statusDot, isCheckedOut ? styles.statusDotComplete : isCheckedIn ? styles.statusDotActive : styles.statusDotPending]} />
              <Text style={styles.statusPillText}>{isCheckedOut ? 'COMPLETED' : isCheckedIn ? 'ON SHIFT' : 'NOT STARTED'}</Text>
            </View>
          </View>
          <Text style={styles.statusTitle}>{isCheckedOut ? 'Day complete' : isCheckedIn ? "You're on the clock" : 'Ready to start?'}</Text>
          <Text style={styles.statusDescription}>Your attendance for today</Text>

          <View style={styles.timeRows}>
            <TouchableOpacity
              style={[styles.timeAction, isCheckedIn && styles.timeActionDone]}
              onPress={handleCheckIn}
              disabled={Boolean(isCheckedIn) || checkingIn || checkingOut}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={isCheckedIn ? `Checked in at ${formatUtcTimeToLocalIST(isCheckedIn)}` : 'Check in'}
            >
              <View style={[styles.timeActionIcon, isCheckedIn && styles.timeActionIconDone]}>
                {checkingIn ? <ActivityIndicator size="small" color={COLORS.primary} /> : <MaterialIcons name="login" size={18} color={isCheckedIn ? '#66D39A' : COLORS.primary} />}
              </View>
              <View style={styles.timeActionCopy}>
                <Text style={styles.timeLabel}>Check in</Text>
                <Text style={styles.timeValue}>{isCheckedIn ? formatUtcTimeToLocalIST(isCheckedIn) : 'Tap to start your day'}</Text>
              </View>
              {!isCheckedIn && <MaterialIcons name="arrow-forward" size={19} color={COLORS.primary} />}
              {Boolean(isCheckedIn) && <MaterialIcons name="check-circle" size={19} color="#66D39A" />}
            </TouchableOpacity>
            <View style={styles.timeDivider} />
            <TouchableOpacity
              style={[styles.timeAction, (!isCheckedIn || isCheckedOut) && styles.timeActionDisabled]}
              onPress={handleCheckOut}
              disabled={!isCheckedIn || Boolean(isCheckedOut) || checkingIn || checkingOut}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={isCheckedOut ? `Checked out at ${formatUtcTimeToLocalIST(isCheckedOut)}` : 'Check out'}
            >
              <View style={[styles.timeActionIcon, isCheckedOut && styles.timeActionIconDone]}>
                {checkingOut ? <ActivityIndicator size="small" color={COLORS.primary} /> : <MaterialIcons name="logout" size={18} color={isCheckedOut ? '#66D39A' : isCheckedIn ? COLORS.primary : '#8993A0'} />}
              </View>
              <View style={styles.timeActionCopy}>
                <Text style={styles.timeLabel}>Check out</Text>
                <Text style={styles.timeValue}>{isCheckedOut ? formatUtcTimeToLocalIST(isCheckedOut) : isCheckedIn ? 'Tap to end your day' : 'Available after check-in'}</Text>
              </View>
              {isCheckedIn && !isCheckedOut && <MaterialIcons name="arrow-forward" size={19} color={COLORS.primary} />}
              {Boolean(isCheckedOut) && <MaterialIcons name="check-circle" size={19} color="#66D39A" />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Text style={styles.sectionEyebrow}>YOUR DAY</Text>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ReceiveCourierStack')}>
              <View style={[styles.actionIcon, styles.iconYellow]}><MaterialIcons name="local-shipping" size={21} color="#7A5A00" /></View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Couriers</Text>
                <Text style={styles.actionSubtitle}>Accept incoming couriers</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Profile')}>
              <View style={[styles.actionIcon, styles.iconGreen]}><MaterialIcons name="person-outline" size={21} color="#26724F" /></View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>My profile</Text>
                <Text style={styles.actionSubtitle}>Personal details</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Sale')}>
              <View style={[styles.actionIcon, styles.iconLavender]}><MaterialIcons name="point-of-sale" size={21} color="#6850A2" /></View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>New sale</Text>
                <Text style={styles.actionSubtitle}>Create a sale</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CourierHistory')}>
              <View style={[styles.actionIcon, styles.iconBlue]}><MaterialIcons name="receipt-long" size={21} color="#315F91" /></View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Courier history</Text>
                <Text style={styles.actionSubtitle}>Records and PDFs</Text>
              </View>
            </TouchableOpacity>
          </View>
          <Text style={styles.refreshHint}>Pull down to refresh attendance and stock</Text>
        </View>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 20,
  },
  greetingBlock: { flex: 1, minWidth: 0, marginRight: 12 },
  headerEyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '800',
    color: '#8A929D',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#202630',
    letterSpacing: -0.3,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E8EBEF',
  },
  statusCard: {
    backgroundColor: '#202630',
    marginHorizontal: 18,
    marginTop: 5,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#202630',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  statusCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statusIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(244,208,63,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 7,
  },
  statusPillPending: { backgroundColor: 'rgba(255,255,255,0.10)' },
  statusPillActive: { backgroundColor: 'rgba(67,190,129,0.16)' },
  statusPillComplete: { backgroundColor: 'rgba(244,208,63,0.16)' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotPending: { backgroundColor: '#AAB2BC' },
  statusDotActive: { backgroundColor: '#54D397' },
  statusDotComplete: { backgroundColor: COLORS.primary },
  statusPillText: {
    color: '#E9EDF2',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '800',
  },
  statusTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.4,
  },
  statusDescription: {
    fontSize: 13,
    color: '#B4BDC8',
    marginTop: 3,
    marginBottom: 14,
  },
  timeRows: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 15,
    paddingHorizontal: 10,
  },
  timeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 10,
  },
  timeActionDone: { opacity: 0.92 },
  timeActionDisabled: { opacity: 0.62 },
  timeActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(244,208,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeActionIconDone: { backgroundColor: 'rgba(84,211,151,0.12)' },
  timeActionCopy: { flex: 1 },
  timeLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#B4BDC8',
  },
  timeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
    fontVariant: ['tabular-nums'],
  },
  timeDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  sectionEyebrow: {
    fontSize: 10,
    letterSpacing: 1.7,
    color: '#929BA7',
    fontWeight: '800',
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#202630',
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 13,
  },
  noDataText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    paddingVertical: 20,
  },
  buttonContainer: {
    paddingHorizontal: 18,
    paddingTop: 22,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48.2%',
    height: 104,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E9EDF1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  iconYellow: { backgroundColor: '#FFF4C2' },
  iconBlue: { backgroundColor: '#E8F1FC' },
  iconGreen: { backgroundColor: '#E6F5EC' },
  iconLavender: { backgroundColor: '#F0EBFA' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: {
    fontSize: 15,
    lineHeight: 18,
    color: '#202630',
    fontWeight: '800',
    marginBottom: 3,
  },
  actionSubtitle: {
    fontSize: 13,
    lineHeight: 15,
    color: '#4F5B67',
    fontWeight: '500',
  },
  refreshHint: {
    marginTop: 2,
    paddingBottom: 8,
    textAlign: 'center',
    color: '#87909B',
    fontSize: 11,
    fontWeight: '500',
  },
});

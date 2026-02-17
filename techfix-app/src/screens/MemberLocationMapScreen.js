import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline, Callout } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import client from '../api/client';
import { COLORS } from '../theme/colors';

export default function MemberLocationMapScreen({ route, navigation }) {
  const { member } = route.params;
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locations, setLocations] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    fetchLocations();
  }, [selectedDate]);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await client.get(
        `/tracking/admin/member/${member.id}/locations/`,
        { params: { date: dateStr } }
      );

      if (response.data.success) {
        setLocations(response.data.data.locations || []);
        setSession(response.data.data.session);

        // Fit map to show all points
        if (response.data.data.locations && response.data.data.locations.length > 0) {
          setTimeout(() => {
            fitMapToLocations(response.data.data.locations);
          }, 100);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch location data');
    } finally {
      setLoading(false);
    }
  };

  const fitMapToLocations = (locs) => {
    try {
      if (!mapRef.current || !locs || locs.length === 0) return;

      const coordinates = locs.map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    } catch (error) {
    }
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  // Determine which points should show timestamps
  const getTimestampVisibility = () => {
    if (locations.length === 0) return [];

    const visibility = locations.map(() => false);

    // Always show first and last
    visibility[0] = true;
    if (locations.length > 1) {
      visibility[locations.length - 1] = true;
    }

    // Show one timestamp per 30-minute window
    const WINDOW_MS = 30 * 60 * 1000;
    let lastShownTime = null;

    for (let i = 1; i < locations.length - 1; i++) {
      const currentTime = new Date(locations[i].timestamp).getTime();

      if (!lastShownTime || (currentTime - lastShownTime) >= WINDOW_MS) {
        visibility[i] = true;
        lastShownTime = currentTime;
      }
    }

    return visibility;
  };

  const timestampVisibility = getTimestampVisibility();

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return '';
    }
  };

  const renderMarker = (location, index) => {
    const isFirst = index === 0;
    const isLast = index === locations.length - 1;
    const showTimestamp = timestampVisibility[index];

    return (
      <Marker
        key={location.id}
        coordinate={{
          latitude: location.latitude,
          longitude: location.longitude,
        }}
        pinColor={isFirst ? COLORS.success : isLast ? COLORS.danger : COLORS.primary}
      >
        {showTimestamp && (
          <Callout>
            <View style={styles.callout}>
              <Text style={styles.calloutTime}>{formatTime(location.timestamp)}</Text>
              {isFirst && <Text style={styles.calloutLabel}>Start</Text>}
              {isLast && <Text style={styles.calloutLabel}>End</Text>}
            </View>
          </Callout>
        )}
      </Marker>
    );
  };

  const initialRegion = locations.length > 0
    ? {
        latitude: locations[0].latitude,
        longitude: locations[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: 10.0261,
        longitude: 76.3125,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{member.full_name || member.username}</Text>
          <Text style={styles.headerSubtitle}>Location History</Text>
        </View>
      </View>

      <View style={styles.dateSelector}>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <MaterialIcons name="event" size={20} color={COLORS.primary} />
          <Text style={styles.dateText}>
            {selectedDate.toLocaleDateString('en-IN')}
          </Text>
        </TouchableOpacity>

        {session && (
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionText}>
              {session.check_in_time ? `In: ${formatTime(session.check_in_time)}` : ''}
              {session.check_out_time ? ` | Out: ${formatTime(session.check_out_time)}` : ''}
            </Text>
          </View>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : locations.length === 0 ? (
        <View style={styles.centerContent}>
          <MaterialIcons name="location-off" size={64} color={COLORS.gray} />
          <Text style={styles.noDataText}>No location data for this date</Text>
        </View>
      ) : mapError ? (
        <View style={styles.centerContent}>
          <MaterialIcons name="error" size={64} color={COLORS.danger} />
          <Text style={styles.noDataText}>Map unavailable. Please check your internet connection.</Text>
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation={false}
            showsMyLocationButton={false}
            onMapError={(error) => {
              setMapError(true);
            }}
          >
            {/* Polyline connecting ALL points */}
            <Polyline
              coordinates={locations.map(loc => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
              }))}
              strokeColor={COLORS.primary}
              strokeWidth={3}
            />

            {/* Markers for ALL points */}
            {locations.map((location, index) => renderMarker(location, index))}
          </MapView>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Location Points: {locations.length}</Text>
            <Text style={styles.infoSubtitle}>
              Tracking interval: 5 minutes
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  header: {
    backgroundColor: COLORS.dark,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.light,
    marginTop: 2,
  },
  dateSelector: {
    backgroundColor: COLORS.white,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light,
    padding: 12,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.dark,
    marginLeft: 8,
    fontWeight: '600',
  },
  sessionInfo: {
    marginTop: 8,
    alignItems: 'center',
  },
  sessionText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 16,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  callout: {
    padding: 8,
    minWidth: 100,
  },
  calloutTime: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  calloutLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  infoCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  infoSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
});
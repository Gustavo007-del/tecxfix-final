// E:\study\techfix\techfix-app\src\screens\AttendanceListScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '../api/client';
import { COLORS } from '../theme/colors';

// Convert UTC time string to Local IST time
const formatUtcTimeToLocalIST = (timeString) => {
  if (!timeString) return null;

  try {
    const [h, m, sWithMs] = timeString.split(':');
    const [s] = sWithMs.split('.');

    // Create UTC datetime for today
    const now = new Date();
    const utcDateTime = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        parseInt(h),
        parseInt(m),
        parseInt(s)
      )
    );

    // Convert to IST (UTC + 5:30)
    const istDateTime = new Date(utcDateTime.getTime() + 5.5 * 60 * 60 * 1000);

    return istDateTime.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (error) {
    return timeString;
  }
};

export default function AttendanceListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [attendance, setAttendance] = useState([]);
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAttendance();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredAttendance(attendance);
    } else {
      setFilteredAttendance(
        attendance.filter((item) =>
          item.technician_name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, attendance]);

  const fetchAttendance = async () => {
    try {
      const response = await client.get('/attendance/list/');
      setAttendance(response.data);
      setFilteredAttendance(response.data);
    } catch (error) {
      console.log('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAttendance();
    setRefreshing(false);
  };

  const renderAttendanceItem = ({ item }) => (
    <View style={styles.attendanceCard}>
      <View style={styles.row}>
        <Text style={styles.label}>Technician:</Text>
        <Text style={styles.value}>{item.technician_name}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Date:</Text>
        <Text style={styles.value}>{item.date}</Text>
      </View>

      {/* CHECK-IN SECTION */}
      <View style={styles.sectionTitle}>
        <MaterialIcons name="login" size={16} color={COLORS.success} />
        <Text style={styles.sectionText}>  Check-In</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Time (IST):</Text>
        <Text style={styles.value}>
          {formatUtcTimeToLocalIST(item.check_in_time) || 'Not checked in'}
        </Text>
      </View>
      {item.check_in_location_name && (
        <View style={styles.row}>
            <Text style={styles.label}>Location:</Text>
            <Text style={styles.value}>
            {item.check_in_location_name}
            </Text>
        </View>
        )}


      {/* CHECK-OUT SECTION */}
      {item.check_out_time && (
        <>
          <View style={styles.sectionTitle}>
            <MaterialIcons name="logout" size={16} color={COLORS.danger} />
            <Text style={styles.sectionText}>  Check-Out</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Time (IST):</Text>
            <Text style={styles.value}>{formatUtcTimeToLocalIST(item.check_out_time)}</Text>
          </View>
          {item.check_out_location_name && (
            <View style={styles.row}>
                <Text style={styles.label}>Location:</Text>
                <Text style={styles.value}>
                {item.check_out_location_name}
                </Text>
            </View>
            )}


        </>
      )}

      {/* STATUS */}
      <View style={styles.row}>
        <Text style={styles.label}>Status:</Text>
        <Text
          style={[
            styles.value,
            item.is_completed ? { color: COLORS.success } : { color: COLORS.warning },
          ]}
        >
          {item.is_completed ? '✓ Completed' : '◄ Pending'}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance Records</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search technician..."
          placeholderTextColor={COLORS.gray}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredAttendance}
        renderItem={renderAttendanceItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inbox" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>No attendance records found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: COLORS.dark,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    color: COLORS.dark,
    fontSize: 14,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 20,
  },
  attendanceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '600',
    flex: 1,
  },
  value: {
    fontSize: 12,
    color: COLORS.dark,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  sectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dark,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 12,
    fontWeight: '500',
  },
});

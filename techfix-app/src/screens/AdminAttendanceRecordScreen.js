// E:\study\techfix\techfix-app\src\screens\AdminAttendanceRecordScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  SectionList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '../api/client';
import { COLORS } from '../theme/colors';

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

export default function AdminAttendanceRecordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const response = await client.get('/attendance/list/');
      setAttendance(response.data);
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

  // Group attendance by date
  const groupByDate = () => {
    const grouped = {};

    attendance.forEach((item) => {
      if (!grouped[item.date]) {
        grouped[item.date] = [];
      }
      grouped[item.date].push(item);
    });

    return Object.keys(grouped)
      .sort()
      .reverse()
      .map((date) => ({
        title: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
          weekday: 'long',
          month: 'short',
          day: '2-digit',
        }),
        data: grouped[date],
      }));
  };

  const renderAttendanceItem = ({ item }) => (
    <View style={styles.techCard}>
      <View style={styles.techHeader}>
        <MaterialIcons name="account-circle" size={36} color={COLORS.primary} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.techName}>{item.technician_name}</Text>
          <Text style={styles.techUsername}>@{item.technician_username}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            item.is_completed ? styles.completedBadge : styles.pendingBadge,
          ]}
        >
          <Text style={styles.statusText}>
            {item.is_completed ? '✓ Done' : '◄ Pending'}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Check-in Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="login" size={18} color={COLORS.success} />
          <Text style={styles.sectionTitle}>Check-In</Text>
        </View>

        <View style={styles.detail}>
          <MaterialIcons name="access-time" size={14} color={COLORS.gray} />
          <Text style={styles.detailLabel}>Time:</Text>
          <Text style={styles.detailValue}>
            {formatUtcTimeToLocalIST(item.check_in_time) || 'Not checked in'}
          </Text>
        </View>

        {item.check_in_location_name && (
          <View style={styles.detail}>
            <MaterialIcons name="location-on" size={14} color={COLORS.gray} />
            <Text style={styles.detailLabel}>Location:</Text>
            <Text style={[styles.detailValue, { flex: 1, marginLeft: 4 }]}>
              {item.check_in_location_name}
            </Text>
          </View>
        )}
      </View>

      {/* Check-out Section */}
      {item.check_out_time && (
        <>
          <View style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="logout" size={18} color={COLORS.danger} />
              <Text style={styles.sectionTitle}>Check-Out</Text>
            </View>

            <View style={styles.detail}>
              <MaterialIcons name="access-time" size={14} color={COLORS.gray} />
              <Text style={styles.detailLabel}>Time:</Text>
              <Text style={styles.detailValue}>
                {formatUtcTimeToLocalIST(item.check_out_time)}
              </Text>
            </View>

            {item.check_out_location_name && (
              <View style={styles.detail}>
                <MaterialIcons name="location-on" size={14} color={COLORS.gray} />
                <Text style={styles.detailLabel}>Location:</Text>
                <Text style={[styles.detailValue, { flex: 1, marginLeft: 4 }]}>
                  {item.check_out_location_name}
                </Text>
              </View>
            )}
          </View>
        </>
      )}
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

  const groupedData = groupByDate();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance Records</Text>
        <View style={{ width: 24 }} />
      </View>

      <SectionList
        sections={groupedData}
        keyExtractor={(item, index) => item.id.toString() + index}
        renderItem={renderAttendanceItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
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
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  sectionHeaderContainer: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  techCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  techHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  techName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  techUsername: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  completedBadge: {
    backgroundColor: COLORS.success + '20',
  },
  pendingBadge: {
    backgroundColor: COLORS.warning + '20',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.dark,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: 12,
  },
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dark,
    marginLeft: 8,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: COLORS.light,
    borderRadius: 6,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 60,
  },
  detailValue: {
    fontSize: 12,
    color: COLORS.dark,
    fontWeight: '500',
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

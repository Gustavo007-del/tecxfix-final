// E:\study\techfix\techfix-app\src\screens\AdminDashboardScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { COLORS } from '../theme/colors';

export default function AdminDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { signOut, state } = useContext(AuthContext);
  const isSpareAdmin = state?.user?.username === 'SpareAdmin';

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await client.get('/admin/dashboard/');
      setStats(response.data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardStats();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel' },
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

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>Admin Panel</Text>
          </View>
          <TouchableOpacity onPress={handleLogout}>
            <MaterialIcons name="logout" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {!isSpareAdmin && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <MaterialIcons name="people" size={32} color={COLORS.primary} />
              <View style={styles.statContent}>
                <Text style={styles.statNumber}>{stats?.total_technicians || 0}</Text>
                <Text style={styles.statLabel}>Total Technicians</Text>
              </View>
            </View>

            <View style={[styles.statCard, { borderLeftColor: COLORS.success }]}>
              <MaterialIcons name="check-circle" size={32} color={COLORS.success} />
              <View style={styles.statContent}>
                <Text style={[styles.statNumber, { color: COLORS.success }]}>
                  {stats?.checked_in_today || 0}
                </Text>
                <Text style={styles.statLabel}>Checked In Today</Text>
              </View>
            </View>

            <View style={[styles.statCard, { borderLeftColor: COLORS.primary }]}>
              <MaterialIcons name="task-alt" size={32} color={COLORS.primary} />
              <View style={styles.statContent}>
                <Text style={[styles.statNumber, { color: COLORS.primary }]}>
                  {stats?.completed_today || 0}
                </Text>
                <Text style={styles.statLabel}>Completed Today</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.actionsContainer}>
          {!isSpareAdmin && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('AdminAttendanceRecordScreen')}
              >
                <MaterialIcons name="list-alt" size={24} color={COLORS.white} />
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Attendance Records</Text>
                  <Text style={styles.actionSubtitle}>View daily attendance by date</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('TechnicianList')}
              >
                <MaterialIcons name="people-alt" size={24} color={COLORS.white} />
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>All Technicians</Text>
                  <Text style={styles.actionSubtitle}>Manage technician list</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('ManageTechnicians')}
              >
                <MaterialIcons name="person-add" size={24} color={COLORS.white} />
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Manage Technicians</Text>
                  <Text style={styles.actionSubtitle}>Add, edit, or delete technicians</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('RegisterTechnicianStock')}
              >
                <MaterialIcons name="storage" size={24} color={COLORS.white} />
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Register Technician Stock</Text>
                  <Text style={styles.actionSubtitle}>Link technicians to stock sheets</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              try {
                navigation.navigate('MemberLocations');
              } catch (error) {
                Alert.alert('Error', 'Failed to navigate to Member Locations');
              }
            }}
          >
            <MaterialIcons name="my-location" size={24} color={COLORS.white} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Member Locations</Text>
              <Text style={styles.actionSubtitle}>Track member movement history</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AdminSpareApprovalsScreen')}
          >
            <MaterialIcons name="check-circle" size={24} color={COLORS.white} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Spare Approvals</Text>
              <Text style={styles.actionSubtitle}>Review and approve spare part requests</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('StockStack')}
          >
            <MaterialIcons name="inventory" size={24} color={COLORS.white} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Courier Stock</Text>
              <Text style={styles.actionSubtitle}>View & manage courier stock</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('CourierStack', { 
              screen: 'CreateCourierMain' 
            })}
          >
            <MaterialIcons name="add-circle" size={24} color={COLORS.white} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Create Courier</Text>
              <Text style={styles.actionSubtitle}>Create new courier shipment</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
          </TouchableOpacity>

          {/* NEW: All Couriers Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AllCouriers')}
          >
            <MaterialIcons name="local-shipping" size={24} color={COLORS.white} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>All Couriers</Text>
              <Text style={styles.actionSubtitle}>View all courier history</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
          </TouchableOpacity>

            <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('StockOut')}
        >
            <MaterialIcons name="inventory-2" size={24} color={COLORS.white} />
            <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Stock Out Items</Text>
                <Text style={styles.actionSubtitle}>Items requiring order</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('StockOrdered')}
        >
            <MaterialIcons name="local-shipping" size={24} color={COLORS.white} />
            <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Ordered Items</Text>
                <Text style={styles.actionSubtitle}>Items awaiting receipt</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('OrderHistory')}
        >
            <MaterialIcons name="history" size={24} color={COLORS.white} />
            <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Order History</Text>
                <Text style={styles.actionSubtitle}>View all orders</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ReceivedHistory')}
        >
            <MaterialIcons name="done-all" size={24} color={COLORS.white} />
            <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Received History</Text>
                <Text style={styles.actionSubtitle}>View all received items</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
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
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  statCard: {
    backgroundColor: COLORS.white,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statContent: {
    marginLeft: 16,
    flex: 1,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    fontWeight: '500',
  },
  actionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  actionButton: {
    backgroundColor: COLORS.dark,
    marginVertical: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionContent: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  actionSubtitle: {
    fontSize: 12,
    color: COLORS.lightGray,
    marginTop: 2,
  },
});
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
import API_ENDPOINTS from '../api/endpoints';
import { syncTrackingSnapshot } from '../api/snapshotSync';
import { AuthContext } from '../context/AuthContext';
import { COLORS } from '../theme/colors';

export default function AdminDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingComplaints, setProcessingComplaints] = useState(false);
  const [syncingMrpList, setSyncingMrpList] = useState(false);
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
    await syncTrackingSnapshot();
    await fetchDashboardStats();
    setRefreshing(false);
  };

  const handleSyncMrpList = async () => {
    try {
      setSyncingMrpList(true);
      const response = await client.post('/admin/sync-mrp-list/');
      Alert.alert(
        'MRP List Updated',
        `${response.data.company_stock_rows} stock items synchronized successfully.`
      );
    } catch (error) {
      Alert.alert(
        'Sync Failed',
        error.response?.data?.error || 'Could not synchronize the MRP List.'
      );
    } finally {
      setSyncingMrpList(false);
    }
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

  const handleProcessComplaints = async () => {
    Alert.alert(
      'Process Completed Complaints',
      'This will process all Completed complaints from 06/04/26 onwards and reduce technician stock accordingly. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          onPress: async () => {
            try {
              setProcessingComplaints(true);
              
              const response = await client.post(API_ENDPOINTS.PROCESS_COMPLAINTS, {
                since_date: '2026-03-22', // Default date as specified
                technician_filter: null // Process all technicians
              });

              const result = response.data;
              
              if (result.success) {
                let message = `Successfully processed ${result.processed_count} complaints.`;
                
                if (result.errors && result.errors.length > 0) {
                  message += `\n\nErrors: ${result.errors.length} items failed.`;
                }

                if (result.stock_reductions && result.stock_reductions.length > 0) {
                  message += `\n\nStock reduced for ${result.stock_reductions.length} items.`;
                }

                Alert.alert('Success', message);
              } else {
                Alert.alert('Error', result.error || 'Failed to process complaints');
              }
            } catch (error) {
              console.error('Complaint processing error:', error);
              Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to process complaints. Please try again.'
              );
            } finally {
              setProcessingComplaints(false);
            }
          },
        },
      ]
    );
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
              <View style={[styles.statIcon, { backgroundColor: '#FFF4BF' }]}>
                <MaterialIcons name="people" size={26} color={COLORS.primary} />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statNumber}>{stats?.total_technicians || 0}</Text>
                <Text style={styles.statLabel}>Technicians</Text>
              </View>
            </View>

            <View style={[styles.statCard, { borderLeftColor: COLORS.success }]}>
              <View style={[styles.statIcon, { backgroundColor: '#DDF7E8' }]}>
                <MaterialIcons name="check-circle" size={26} color={COLORS.success} />
              </View>
              <View style={styles.statContent}>
                <Text style={[styles.statNumber, { color: COLORS.success }]}>
                  {stats?.checked_in_today || 0}
                </Text>
                <Text style={styles.statLabel}>Checked In Today</Text>
              </View>
            </View>

            <View style={styles.centerStatRow}>
              <View style={[styles.statCard, { borderLeftColor: COLORS.primary }]}>
                <View style={[styles.statIcon, { backgroundColor: '#FFF4BF' }]}>
                  <MaterialIcons name="task-alt" size={26} color={COLORS.primary} />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statNumber, { color: COLORS.primary }]}>
                    {stats?.completed_today || 0}
                  </Text>
                  <Text style={styles.statLabel}>Completed Today</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionHeadingTitle}>Admin Tools</Text>
          <Text style={styles.sectionHeadingSubtitle}>Manage daily operations and stock</Text>
        </View>

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
        </TouchableOpacity>

        {/* NEW: Process Pending Complaints Button */}
        <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: processingComplaints ? COLORS.gray : COLORS.warning }]}
            onPress={handleProcessComplaints}
            disabled={processingComplaints}
        >
            {processingComplaints ? (
                <ActivityIndicator size={24} color={COLORS.white} />
            ) : (
                <MaterialIcons name="pending-actions" size={24} color={COLORS.white} />
            )}
            <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>
                    {processingComplaints ? 'Processing...' : 'Process Completed Complaints'}
                </Text>
                <Text style={styles.actionSubtitle}>
                    Process completed complaints & reduce stock
                </Text>
            </View>
        </TouchableOpacity>

        {/* NEW: Sales Requests Button */}
        <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AdminSalesRequestScreen')}
        >
            <MaterialIcons name="sell" size={24} color={COLORS.white} />
            <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Sales Requests</Text>
                <Text style={styles.actionSubtitle}>Review and approve sales requests</Text>
            </View>
        </TouchableOpacity>

        <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: syncingMrpList ? COLORS.gray : COLORS.secondary }]}
            onPress={handleSyncMrpList}
            disabled={syncingMrpList}
        >
            {syncingMrpList ? (
              <ActivityIndicator size={24} color={COLORS.white} />
            ) : (
              <MaterialIcons name="sync" size={24} color={COLORS.white} />
            )}
            <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>
                  {syncingMrpList ? 'Updating MRP List...' : 'Update MRP List'}
                </Text>
                <Text style={styles.actionSubtitle}>Sync monthly MRP changes from Google Sheets</Text>
            </View>
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
    paddingTop: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: COLORS.white,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    borderRadius: 12,
    width: '48%',
    minHeight: 92,
    padding: 12,
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
    marginLeft: 10,
    flex: 1,
  },
  centerStatRow: {
    width: '100%',
    alignItems: 'center',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    fontWeight: '500',
  },
  sectionHeading: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionHeadingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  sectionHeadingSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 3,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: COLORS.dark,
    width: '48%',
    marginVertical: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
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
    marginLeft: 10,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  actionSubtitle: {
    fontSize: 11,
    color: COLORS.lightGray,
    marginTop: 2,
  },
});
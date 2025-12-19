// E:\study\techfix\techfix-app\src\screens\MyRequestsScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AuthContext } from '../context/AuthContext';
import SHEETS_API from '../api/sheetsClient';
import { COLORS } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export default function MyRequestsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { state } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // all, PENDING, APPROVED, REJECTED


  useEffect(() => {
    fetchMyRequests();
  }, []);


  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const response = await SHEETS_API.getMySpareRequests();
      if (response && response.success) {
        setRequests(response.data || []);
      } else {
        Alert.alert('Error', 'Failed to load requests');
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      Alert.alert('Error', 'Failed to fetch your requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyRequests();
  };


  // Filter requests based on status
  const filteredRequests = filterStatus === 'all'
    ? requests
    : requests.filter(req => req.status === filterStatus);


  const getStatusColor = (status) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return { bg: '#FFF9C4', text: '#F57F17' };
      case 'APPROVED':
        return { bg: '#C8E6C9', text: '#2E7D32' };
      case 'REJECTED':
        return { bg: '#FFCDD2', text: '#C62828' };
      default:
        return { bg: '#E0E0E0', text: '#424242' };
    }
  };


  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };


  const renderRequestCard = ({ item }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = item.status === 'APPROVED' ? '✓' : 
                       item.status === 'REJECTED' ? '✗' : '⏳';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.complaintNo}>{item.complaint_no}</Text>
            <Text style={styles.customerName}>{item.customer_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {statusIcon} {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.value}>{item.customer_phone}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Area:</Text>
            <Text style={styles.value}>{item.area}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Brand:</Text>
            <Text style={styles.value}>{item.brand_name}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Part:</Text>
            <Text style={styles.value}>{item.part_name}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Qty:</Text>
            <Text style={styles.value}>{item.no_of_spares}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Requested:</Text>
            <Text style={styles.value}>{formatDate(item.requested_at)}</Text>
          </View>

          {item.reviewed_at && (
            <View style={styles.row}>
              <Text style={styles.label}>Reviewed:</Text>
              <Text style={styles.value}>{formatDate(item.reviewed_at)}</Text>
            </View>
          )}

          {item.admin_notes && (
            <View style={styles.row}>
              <Text style={styles.label}>Notes:</Text>
              <Text style={[styles.value, { color: '#F57F17' }]}>{item.admin_notes}</Text>
            </View>
          )}
        </View>

        <View style={[styles.statusIndicator, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.indicatorText, { color: statusColor.text }]}>
            {item.status === 'PENDING'
              ? '⏳ Awaiting admin review'
              : item.status === 'APPROVED'
              ? '✓ Approved by admin'
              : '✗ Rejected by admin'}
          </Text>
        </View>
      </View>
    );
  };


  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }


  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Requests</Text>
        <Text style={styles.headerSubtitle}>Track your status change requests</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'all' && styles.filterTabActive]}
          onPress={() => setFilterStatus('all')}
        >
          <Text style={[styles.filterText, filterStatus === 'all' && styles.filterTextActive]}>
            All ({requests.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'PENDING' && styles.filterTabActive]}
          onPress={() => setFilterStatus('PENDING')}
        >
          <Text style={[styles.filterText, filterStatus === 'PENDING' && styles.filterTextActive]}>
            Pending ({requests.filter(r => r.status === 'PENDING').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'APPROVED' && styles.filterTabActive]}
          onPress={() => setFilterStatus('APPROVED')}
        >
          <Text style={[styles.filterText, filterStatus === 'APPROVED' && styles.filterTextActive]}>
            Approved ({requests.filter(r => r.status === 'APPROVED').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'REJECTED' && styles.filterTabActive]}
          onPress={() => setFilterStatus('REJECTED')}
        >
          <Text style={[styles.filterText, filterStatus === 'REJECTED' && styles.filterTextActive]}>
            Rejected ({requests.filter(r => r.status === 'REJECTED').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="inbox" size={48} color={COLORS.gray} />
          <Text style={styles.emptyText}>
            No {filterStatus !== 'all' ? filterStatus.toLowerCase() : ''} requests
          </Text>
          <Text style={styles.emptySubtext}>
            {filterStatus === 'PENDING'
              ? 'Your pending requests will appear here'
              : filterStatus === 'APPROVED'
              ? 'Your approved requests will appear here'
              : filterStatus === 'REJECTED'
              ? 'Your rejected requests will appear here'
              : 'You haven\'t made any requests yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRequestCard}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Summary Footer */}
      {requests.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total:</Text>
            <Text style={styles.summaryValue}>{requests.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pending:</Text>
            <Text style={[styles.summaryValue, { color: '#F57F17' }]}>
              {requests.filter(r => r.status === 'PENDING').length}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Approved:</Text>
            <Text style={[styles.summaryValue, { color: '#2E7D32' }]}>
              {requests.filter(r => r.status === 'APPROVED').length}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Rejected:</Text>
            <Text style={[styles.summaryValue, { color: '#C62828' }]}>
              {requests.filter(r => r.status === 'REJECTED').length}
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
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    gap: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#333',
  },
  listContainer: {
    padding: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  complaintNo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  customerName: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  statusIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
  },
  summary: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
});
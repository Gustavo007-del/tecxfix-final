// E:\study\techfix\techfix-app\src\screens\AdminSpareApprovalsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SHEETS_API from '../api/sheetsClient';
import { COLORS } from '../theme/colors';


export default function AdminSpareApprovalsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'


  useEffect(() => {
    fetchApprovals();
  }, []);


  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const response = await SHEETS_API.getAllSpareRequests();
      if (response && response.success) {
        setApprovalRequests(response.data || []);
      } else {
        Alert.alert('Error', 'Failed to load approval requests');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch approval requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  const onRefresh = async () => {
    setRefreshing(true);
    await fetchApprovals();
  };


  const openModal = (request, action) => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNotes('');
    setModalVisible(true);
  };


  const handleApprove = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      const response = await SHEETS_API.approveSparerequest(
        selectedRequest.id,
        adminNotes
      );

      if (response && response.success) {
        Alert.alert('Success', `Approved: ${selectedRequest.complaint_no}`);
        setModalVisible(false);
        setAdminNotes('');
        await fetchApprovals();
      } else {
        Alert.alert('Error', response?.error || 'Failed to approve request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };


  const handleReject = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      const response = await SHEETS_API.rejectSpareRequest(
        selectedRequest.id,
        adminNotes
      );

      if (response && response.success) {
        Alert.alert('Success', `Rejected: ${selectedRequest.complaint_no}`);
        setModalVisible(false);
        setAdminNotes('');
        await fetchApprovals();
      } else {
        Alert.alert('Error', response?.error || 'Failed to reject request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };


  const renderApprovalCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.complaintNo}>{item.complaint_no}</Text>
          <Text style={styles.technicianName}>
            👤 {item.technician_name}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>PENDING</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBody}>
        <View style={styles.row}>
          <Text style={styles.label}>Customer:</Text>
          <Text style={styles.value}>{item.customer_name}</Text>
        </View>

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
          <Text style={styles.label}>Code:</Text>
          <Text style={styles.value}>{item.product_code}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Qty:</Text>
          <Text style={styles.value}>{item.no_of_spares}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>District:</Text>
          <Text style={styles.value}>{item.district || 'N/A'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Requested:</Text>
          <Text style={styles.value}>
            {new Date(item.requested_at).toLocaleDateString('en-IN')}
          </Text>
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, styles.approveBtn]}
          onPress={() => openModal(item, 'approve')}
        >
          <MaterialIcons name="check-circle" size={18} color={COLORS.white} />
          <Text style={styles.buttonText}>Approve</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.rejectBtn]}
          onPress={() => openModal(item, 'reject')}
        >
          <MaterialIcons name="cancel" size={18} color={COLORS.white} />
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );


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
        <Text style={styles.headerTitle}>Spare Approvals</Text>
        <Text style={styles.headerSubtitle}>
          {approvalRequests.length} pending request{approvalRequests.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Requests List */}
      {approvalRequests.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="inbox" size={48} color={COLORS.gray} />
          <Text style={styles.emptyText}>No pending approval requests</Text>
          <Text style={styles.emptySubtext}>All technician requests have been reviewed</Text>
        </View>
      ) : (
        <FlatList
          data={approvalRequests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderApprovalCard}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Action Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {actionType === 'approve' ? 'Approve' : 'Reject'} Request
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                disabled={actionLoading}
              >
                <MaterialIcons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <ScrollView style={styles.modalBody}>
                {/* Request Summary */}
                <View style={styles.summarySection}>
                  <Text style={styles.sectionTitle}>Request Details</Text>
                  
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Complaint No:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedRequest.complaint_no}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Technician:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedRequest.technician_name}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Customer:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedRequest.customer_name}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Part Needed:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedRequest.part_name} (Qty: {selectedRequest.no_of_spares})
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Brand:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedRequest.brand_name}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Area/District:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedRequest.area}, {selectedRequest.district || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Admin Notes Input */}
                <View style={styles.notesSection}>
                  <Text style={styles.sectionTitle}>
                    {actionType === 'approve' ? 'Approval' : 'Rejection'} Notes (Optional)
                  </Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder={
                      actionType === 'approve'
                        ? 'Add approval notes...'
                        : 'Add rejection reason...'
                    }
                    placeholderTextColor={COLORS.gray}
                    value={adminNotes}
                    onChangeText={setAdminNotes}
                    multiline={true}
                    numberOfLines={4}
                    editable={!actionLoading}
                  />
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  {actionType === 'approve' ? (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveActionBtn]}
                      onPress={handleApprove}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <>
                          <MaterialIcons
                            name="check-circle"
                            size={20}
                            color={COLORS.white}
                          />
                          <Text style={styles.actionButtonText}>Approve Request</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectActionBtn]}
                      onPress={handleReject}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <>
                          <MaterialIcons
                            name="cancel"
                            size={20}
                            color={COLORS.white}
                          />
                          <Text style={styles.actionButtonText}>Reject Request</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  },
  header: {
    backgroundColor: COLORS.dark,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.light,
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
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
  technicianName: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: COLORS.warning + '30',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.warning,
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
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
    flex: 0.4,
  },
  value: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    flex: 0.6,
    textAlign: 'right',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approveBtn: {
    backgroundColor: COLORS.success,
  },
  rejectBtn: {
    backgroundColor: COLORS.danger,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.lightGray,
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  summarySection: {
    backgroundColor: COLORS.light,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '600',
    flex: 0.4,
  },
  summaryValue: {
    fontSize: 11,
    color: COLORS.dark,
    fontWeight: '600',
    flex: 0.6,
    textAlign: 'right',
  },
  notesSection: {
    marginBottom: 16,
  },
  notesInput: {
    backgroundColor: COLORS.light,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.dark,
    fontSize: 13,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    marginTop: 16,
    marginBottom: 24,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  approveActionBtn: {
    backgroundColor: COLORS.success,
  },
  rejectActionBtn: {
    backgroundColor: COLORS.danger,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
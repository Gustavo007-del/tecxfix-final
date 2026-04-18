// E:\study\techfix\techfix-app\src\screens\AdminSalesRequestScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { generateSalesRequestPDF } from '../utils/SalesRequestPDFGenerator';

export default function AdminSalesRequestScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { state } = useContext(AuthContext);
  
  const [salesRequests, setSalesRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchSalesRequests();
  }, []);

  const fetchSalesRequests = async () => {
    try {
      const response = await client.get('/sales/requests/');
      setSalesRequests(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching sales requests:', error);
      // Don't show mock data - show empty list instead
      setSalesRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSalesRequests();
    setRefreshing(false);
  };

  const handleApprove = async (requestId) => {
    Alert.alert(
      'Approve Request',
      'Are you sure you want to approve this sales request? This will reduce the technician\'s stock.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            await processRequest(requestId, 'approved');
          },
        },
      ]
    );
  };

  const handleReject = async (requestId) => {
    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this sales request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: async () => {
            await processRequest(requestId, 'rejected');
          },
        },
      ]
    );
  };

  const processRequest = async (requestId, status) => {
    try {
      setProcessingId(requestId);
      
      const endpoint = status === 'approved' 
        ? `/sales/requests/${requestId}/approve/`
        : `/sales/requests/${requestId}/reject/`;
      
      const response = await client.post(endpoint, {}, { timeout: 30000 }); // 30 second timeout for approval
      
      if (response.data.success) {
        Alert.alert(
          'Success',
          `Sales request ${status} successfully!`,
          [
            {
              text: 'OK',
              onPress: () => {
                fetchSalesRequests();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', response.data.error || `Failed to ${status} request`);
      }
    } catch (error) {
      console.error(`Error ${status} request:`, error);
      Alert.alert(
        'Error',
        error.response?.data?.error || `Failed to ${status} request. Please try again.`
      );
    } finally {
      setProcessingId(null);
    }
  };

  const showRequestDetails = (request) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return COLORS.success;
      case 'rejected':
        return COLORS.danger;
      case 'pending':
      default:
        return COLORS.warning;
    }
  };

  const getStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return 'N/A';
    try {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const handleDownloadPdf = async (salesRequest) => {
    try {
      setDownloadingPdf(true);
      
      const result = await generateSalesRequestPDF(salesRequest);
      
      if (!result.success) {
        Alert.alert('Error', result.message || 'Failed to generate PDF. Please try again.');
      } else {
        // PDF was successfully generated and shared
        console.log('PDF generated successfully:', result.uri);
      }
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={28} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sales Requests</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {salesRequests.length === 0 ? (
          <View style={styles.noDataContainer}>
            <MaterialIcons name="receipt-long" size={64} color={COLORS.gray} />
            <Text style={styles.noDataText}>No sales requests found</Text>
          </View>
        ) : (
          salesRequests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={styles.requestInfo}>
                  <Text style={styles.technicianName}>{request.technician_name}</Text>
                  <Text style={styles.companyName}>{request.company_name}</Text>
                  {request.compliant_number && (
                    <Text style={styles.compliantNumber}>
                      Compliant: {request.compliant_number}
                    </Text>
                  )}
                </View>
                <View style={styles.requestMeta}>
                  <Text style={[styles.status, { color: getStatusColor(request.status) }]}>
                    {getStatusText(request.status)}
                  </Text>
                  <Text style={styles.date}>{formatDate(request.requested_at)}</Text>
                </View>
              </View>

              <View style={styles.productsPreview}>
                <Text style={styles.productsLabel}>
                  {request.products?.length || 0} Product(s)
                </Text>
                <Text style={styles.totalAmount}>Total: ¥{parseFloat(request.total_amount || 0).toFixed(2)}</Text>
              </View>

              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => showRequestDetails(request)}
                >
                  <MaterialIcons name="visibility" size={18} color={COLORS.primary} />
                  <Text style={styles.detailButtonText}>View Details</Text>
                </TouchableOpacity>

                {request.status?.toLowerCase() === 'pending' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApprove(request.id)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <>
                          <MaterialIcons name="check" size={18} color={COLORS.white} />
                          <Text style={styles.actionButtonText}>Approve</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleReject(request.id)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <>
                          <MaterialIcons name="close" size={18} color={COLORS.white} />
                          <Text style={styles.actionButtonText}>Reject</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <MaterialIcons name="close" size={28} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Request Details</Text>
            <View style={styles.headerSpacer} />
          </View>

          {selectedRequest && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailSection}>
                <View style={styles.sectionHeader}>
                <Text style={styles.detailSectionTitle}>Request Information</Text>
                  {selectedRequest.status?.toLowerCase() === 'approved' && (
                    <TouchableOpacity
                      style={styles.pdfButton}
                      onPress={() => handleDownloadPdf(selectedRequest)}
                      disabled={downloadingPdf}
                    >
                      {downloadingPdf ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <>
                          <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />
                          <Text style={styles.pdfButtonText}>Download PDF</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Technician:</Text>
                  <Text style={styles.detailValue}>{selectedRequest.technician_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Company:</Text>
                  <Text style={styles.detailValue}>{selectedRequest.company_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>
                    {selectedRequest.type === 'direct' ? 'Direct Sale' : 'Complaint Sale'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Invoice Number:</Text>
                  <Text style={styles.detailValue}>{selectedRequest.invoice_number}</Text>
                </View>
                {selectedRequest.compliant_number && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Compliant Number:</Text>
                    <Text style={styles.detailValue}>{selectedRequest.compliant_number}</Text>
                  </View>
                )}
                {selectedRequest.customer_name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer Name:</Text>
                    <Text style={styles.detailValue}>{selectedRequest.customer_name}</Text>
                  </View>
                )}
                {selectedRequest.remarks && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Remarks:</Text>
                    <Text style={styles.detailValue}>{selectedRequest.remarks}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={[styles.detailValue, { color: getStatusColor(selectedRequest.status) }]}>
                    {getStatusText(selectedRequest.status)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedRequest.requested_at)}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Products</Text>
                {selectedRequest.products?.map((product) => (
                  <View key={product.id} style={styles.productDetail}>
                    <View style={styles.productHeader}>
                      <View>
                        <Text style={styles.productName}>{product.product_name}</Text>
                        <Text style={styles.productCode}>{product.product_code}</Text>
                      </View>
                    </View>
                    <View style={styles.productDetails}>
                      <Text style={styles.productDetailText}>
                        Quantity: {product.quantity} × ₹{parseFloat(product.mrp).toFixed(2)} = ₹{(parseFloat(product.quantity) * parseFloat(product.mrp)).toFixed(2)}
                      </Text>
                      <Text style={styles.productDetailText}>
                        Service Charge: ₹{parseFloat(product.service_charge || 0).toFixed(2)}
                      </Text>
                      <Text style={styles.productTotal}>
                        Total: ₹{((parseFloat(product.quantity) * parseFloat(product.mrp)) + parseFloat(product.service_charge || 0)).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.totalSection}>
                <Text style={styles.grandTotalLabel}>Grand Total:</Text>
                <Text style={styles.grandTotalAmount}>₹{parseFloat(selectedRequest.total_amount || 0).toFixed(2)}</Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  scrollView: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: COLORS.dark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginLeft: 16,
    flex: 1,
  },
  headerSpacer: {
    width: 28,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 16,
  },
  requestCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  technicianName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  companyName: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
  },
  compliantNumber: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 2,
  },
  requestMeta: {
    alignItems: 'flex-end',
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  productsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  productsLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  detailButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    marginLeft: 6,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  approveButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.danger,
  },
  actionButtonText: {
    fontSize: 14,
    color: COLORS.white,
    marginLeft: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  modalHeader: {
    backgroundColor: COLORS.dark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginLeft: 16,
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  pdfButtonText: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: '600',
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.gray,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.dark,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  productDetail: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  productHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  productCode: {
    fontSize: 13,
    color: '#7F8C8D',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  productDetails: {
    gap: 8,
    paddingTop: 4,
  },
  productDetailText: {
    fontSize: 14,
    color: '#5A6C7D',
    lineHeight: 20,
  },
  productTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4D03F',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalSection: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  grandTotalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});

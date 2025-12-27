// E:\study\techfix\techfix-app\src\screens\SparePendingScreen.js
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AuthContext } from '../context/AuthContext';
import SHEETS_API from '../api/sheetsClient';
import { COLORS } from '../theme/colors';
import client, { API_ENDPOINTS } from '../api/client';

export default function SparePendingScreen() {
  const insets = useSafeAreaInsets();
  const { state } = useContext(AuthContext);

  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter states
  const [filterStatus, setFilterStatus] = useState('PENDING'); // PENDING or CLOSED
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  // Date picker states
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);

  // Status update modal
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchComplaints();
  }, []);

  // Update filtered complaints when search query or complaints change
  useEffect(() => {
    if (searchQuery) {
      const filtered = complaints.filter(complaint => 
        complaint.complaint_no.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredComplaints(filtered);
    } else {
      setFilteredComplaints(complaints);
    }
  }, [searchQuery, complaints]);

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const fetchComplaints = async (status = filterStatus) => {
    try {
      setLoading(true);
      console.log('Fetching complaints with status:', status);
      
      let response;
      if (status === 'PENDING') {
        console.log('Fetching pending complaints...');
        response = await SHEETS_API.getSparePending();
      } else {
        const fromStr = formatDate(fromDate);
        const toStr = formatDate(toDate);
        console.log(`Fetching closed complaints from ${fromStr} to ${toStr}...`);
        response = await SHEETS_API.getSpareClosed(fromStr, toStr);
      }

      const data = response?.data || [];
      console.log('Fetched data:', { 
        status: status,
        count: data.length,
        firstItem: data[0] || 'No items'
      });
      
      setComplaints(data);
      setFilteredComplaints(data);
      setSearchQuery('');
    } catch (error) {
      console.error('Error in fetchComplaints:', {
        error: error.message,
        status: status,
        stack: error.stack
      });
      Alert.alert('Error', 'Failed to fetch spare items');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (status) => {
    console.log('handleFilterChange called with status:', status, 'current status:', filterStatus);
    if (status === filterStatus) {
      console.log('Same status, skipping...');
      return;
    }
    
    console.log('Updating status to:', status);
    setFilterStatus(status);
    setSearchQuery('');
    
    // Pass the new status directly to avoid closure issues
    fetchComplaints(status);
  };

  const handleFromDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setFromDate(selectedDate);
      setShowFromDatePicker(false);
    }
  };

  const handleToDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setToDate(selectedDate);
      setShowToDatePicker(false);
    }
  };

  const openStatusModal = (complaint) => {
    setSelectedComplaint(complaint);
    setStatusModalVisible(true);
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedComplaint) return;

    setUpdatingStatus(true);
    try {
      // When technician clicks "Mark as CLOSED", create a request in DB
      if (newStatus === 'CLOSED') {
        const response = await SHEETS_API.createSpareRequest(selectedComplaint);
        
        Alert.alert(
          'Request Submitted',
          'Your closure request has been submitted for admin approval. You can track it in "My Requests".',
          [
            {
              text: 'OK',
              onPress: () => {
                setStatusModalVisible(false);
                // Refresh the list
                fetchComplaints();
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit request');
      console.error(error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchComplaints();
    setRefreshing(false);
  };

  // Group complaints by complaint_no
  const groupComplaintsByComplaintNo = (complaints) => {
    const grouped = {};
    complaints.forEach(complaint => {
      if (!grouped[complaint.complaint_no]) {
        grouped[complaint.complaint_no] = {
          ...complaint,
          parts: []
        };
      }
      if (complaint.part_name) {
        grouped[complaint.complaint_no].parts.push({
          part_name: complaint.part_name,
          no_of_spares: complaint.no_of_spares,
          mrp: complaint.mrp,
          brand_name: complaint.brand_name,
          product_code: complaint.product_code
        });
      }
    });
    return Object.values(grouped);
  };

  // Cache for stock check results
  const stockCache = useRef(new Map());

  // Function to check if stock is available for a part
  const isStockAvailable = useCallback(async (part) => {
    if (!part?.product_code) return false;
    
    const cacheKey = `${part.product_code.toLowerCase()}-${part.no_of_spares || '0'}`;
    
    // Return cached result if available
    if (stockCache.current.has(cacheKey)) {
      return stockCache.current.get(cacheKey);
    }
    
    // Return a promise that will be resolved when stock is checked
    const stockPromise = (async () => {
      try {
        // Get the technician's stock from the API
        const response = await client.get(API_ENDPOINTS.MY_STOCK);
        const technicianStock = response.data.data || response.data || [];
        
        // Find the matching stock item by product code (case-insensitive)
        const stockItem = technicianStock.find(item => 
          item.spare_id?.toLowerCase() === part.product_code?.toLowerCase()
        );
        
        // If stock item not found, cache and return false
        if (!stockItem) {
          console.log('Stock item not found for:', part.product_code);
          stockCache.current.set(cacheKey, false);
          return false;
        }
        
        // Check if available quantity is sufficient
        const hasStock = stockItem.qty >= parseInt(part.no_of_spares || '0', 10);
        stockCache.current.set(cacheKey, hasStock);
        return hasStock;
      } catch (error) {
        console.error('Error checking stock:', error);
        // Don't cache errors in case it's a temporary issue
        return false;
      }
    })();
    
    // Store the promise in cache so we don't make duplicate requests
    stockCache.current.set(cacheKey, stockPromise);
    return stockPromise;
  }, []);

  // Component to handle async stock check for each part
  const StockAwarePartRow = React.memo(({ part, index, totalParts, isVisible }) => {
    const [hasStock, setHasStock] = useState(null);
    const hasCheckedRef = useRef(false);

    useEffect(() => {
      if (isVisible && !hasCheckedRef.current) {
        hasCheckedRef.current = true;
        const checkStock = async () => {
          const available = await isStockAvailable(part);
          // Only update if the component is still mounted
          if (hasCheckedRef.current) {
            setHasStock(available);
          }
        };
        
        checkStock();
      }
      
      return () => {
        // Cleanup function to handle unmounting
        hasCheckedRef.current = false;
      };
    }, [part, isVisible, isStockAvailable]);

    if (hasStock === null) {
      return (
        <View style={[styles.tableRow, { padding: 8, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    return (
      <View 
        style={[
          styles.tableRow, 
          index < totalParts - 1 && styles.tableRowBorder,
          hasStock ? styles.stockAvailable : styles.stockUnavailable
        ]}
      >
        <View style={{flex: 3}}>
          <Text 
            style={[
              styles.columnValue, 
              { color: hasStock ? COLORS.dark : COLORS.error }
            ]} 
            numberOfLines={1}
          >
            {part.part_name || 'N/A'}
          </Text>
          <Text 
            style={[
              styles.columnValue, 
              {fontSize: 10, color: hasStock ? COLORS.gray : COLORS.error}
            ]} 
            numberOfLines={1}
          >
            {part.brand_name} • {part.product_code}
          </Text>
        </View>
        <Text 
          style={[
            styles.columnValue, 
            {flex: 1, textAlign: 'center'},
            { color: hasStock ? COLORS.dark : COLORS.error }
          ]}
        >
          {part.no_of_spares || '0'}
        </Text>
        <Text 
          style={[
            styles.columnValue, 
            {flex: 2, textAlign: 'right', fontWeight: '500'},
            { color: hasStock ? COLORS.dark : COLORS.error }
          ]}
        >
          {part.mrp ? `₹${part.mrp}` : 'N/A'}
        </Text>
      </View>
    );
  });

  const renderComplaintItem = useCallback(({ item, index, isVisible = false }) => {
    const complaint = item.parts ? item : { 
      ...item, 
      parts: [{ 
        part_name: item.part_name, 
        no_of_spares: item.no_of_spares, 
        mrp: item.mrp, 
        brand_name: item.brand_name, 
        product_code: item.product_code 
      }] 
    };
    
    return (
      <View style={styles.complaintCard}>
        <View style={styles.complaintHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.complaintNo}>{complaint.complaint_no}</Text>
            <Text style={styles.customerName}>{complaint.customer_name}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              complaint.status === 'PENDING'
                ? styles.statusPending
                : styles.statusClosed,
            ]}
          >
            <Text style={styles.statusText}>{complaint.status}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>📱 Phone</Text>
            <Text style={styles.detailValue}>{complaint.phone}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>📍 Area</Text>
            <Text style={styles.detailValue}>{complaint.area}</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>🏷️ Brand</Text>
            <Text style={styles.detailValue}>{complaint.brand_name}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>📦 Code</Text>
            <Text style={styles.detailValue}>{complaint.product_code}</Text>
          </View>
        </View>
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>🌍 District</Text>
            <Text style={styles.detailValue}>{complaint.district || 'N/A'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>🔢 Pending Days</Text>
            <Text style={styles.detailValue}>{complaint.pending_days || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Part Details Table */}
        <View style={styles.partDetailsContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.columnHeader, {flex: 3}]}>Part Details</Text>
            <Text style={[styles.columnHeader, {flex: 1, textAlign: 'center'}]}>Qty</Text>
            <Text style={[styles.columnHeader, {flex: 2, textAlign: 'right'}]}>MRP</Text>
          </View>
          {complaint.parts && complaint.parts.map((part, partIndex) => {
            const partKey = `${complaint.complaint_no}-${part.product_code}-${partIndex}`;
            return (
              <StockAwarePartRow 
                key={partKey}
                part={part} 
                index={partIndex} 
                totalParts={complaint.parts.length}
                isVisible={isVisible}
              />
            );
          })}
        </View>

        <View style={styles.divider} />

        {complaint.status === 'PENDING' && (
          <TouchableOpacity
            style={styles.updateButton}
            onPress={() => openStatusModal(complaint)}
          >
            <MaterialIcons name="edit" size={16} color={COLORS.white} />
            <Text style={styles.updateButtonText}>Update Status</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, []);

  // Track visible items
  const [visibleItems, setVisibleItems] = useState(new Set());
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const visibleIds = new Set(viewableItems.map(item => item.key));
    setVisibleItems(prev => {
      // Only update if there are actual changes to prevent unnecessary re-renders
      if (viewableItems.length === 0 || setsAreEqual(prev, visibleIds)) {
        return prev;
      }
      return visibleIds;
    });
  }).current;
  
  // Helper function to compare sets
  const setsAreEqual = (setA, setB) => {
    if (setA.size !== setB.size) return false;
    for (const item of setA) if (!setB.has(item)) return false;
    return true;
  };
  
  // Viewability configuration
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300,
  }).current;

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  // Group complaints before rendering
  const groupedComplaints = groupComplaintsByComplaintNo(filteredComplaints);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Spare Parts</Text>
        <Text style={styles.headerSubtitle}>
          {state.user?.first_name || 'Technician'}
        </Text>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[
              styles.filterBtn,
              filterStatus === 'PENDING' && styles.filterBtnActive,
            ]}
            onPress={() => handleFilterChange('PENDING')}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterStatus === 'PENDING' && styles.filterBtnTextActive,
              ]}
            >
              Pending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterBtn,
              filterStatus === 'CLOSED' && styles.filterBtnActive,
            ]}
            onPress={() => handleFilterChange('CLOSED')}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterStatus === 'CLOSED' && styles.filterBtnTextActive,
              ]}
            >
              Closed
            </Text>
          </TouchableOpacity>
        </View>

        {filterStatus === 'CLOSED' && (
          <View style={styles.dateSection}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFromDatePicker(true)}
            >
              <MaterialIcons name="calendar-today" size={16} color={COLORS.primary} />
              <Text style={styles.dateButtonText}>{formatDate(fromDate)}</Text>
            </TouchableOpacity>

            <Text style={styles.dateSeparator}>to</Text>

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowToDatePicker(true)}
            >
              <MaterialIcons name="calendar-today" size={16} color={COLORS.primary} />
              <Text style={styles.dateButtonText}>{formatDate(toDate)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyDateBtn}
              onPress={() => fetchComplaints()}
            >
              <MaterialIcons name="check" size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons 
          name="search" 
          size={20} 
          color={COLORS.gray} 
          style={styles.searchIcon} 
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by complaint number..."
          placeholderTextColor={COLORS.gray}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="never"
        />
        {searchQuery ? (
          <TouchableOpacity 
            onPress={() => setSearchQuery('')} 
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={20} color={COLORS.gray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Complaints List */}
      <FlatList
        data={groupedComplaints}
        renderItem={({ item, index }) => {
          const isVisible = visibleItems.has(item.complaint_no);
          return renderComplaintItem({ item, index, isVisible });
        }}
        keyExtractor={(item) => item.complaint_no}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={100}
        windowSize={10}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inbox" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        }
      />

      {/* Date Pickers */}
      {showFromDatePicker && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display="default"
          onChange={handleFromDateChange}
        />
      )}

      {showToDatePicker && (
        <DateTimePicker
          value={toDate}
          mode="date"
          display="default"
          onChange={handleToDateChange}
        />
      )}

      {/* Status Update Modal */}
      <Modal
        visible={statusModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Status</Text>
              <TouchableOpacity
                onPress={() => setStatusModalVisible(false)}
                disabled={updatingStatus}
              >
                <MaterialIcons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            {selectedComplaint && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.complaintSummary}>
                  <Text style={styles.summaryLabel}>Complaint No:</Text>
                  <Text style={styles.summaryValue}>
                    {selectedComplaint.complaint_no}
                  </Text>

                  <Text style={styles.summaryLabel}>Customer:</Text>
                  <Text style={styles.summaryValue}>
                    {selectedComplaint.customer_name}
                  </Text>

                  <Text style={styles.summaryLabel}>Current Status:</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: COLORS.warning },
                    ]}
                  >
                    {selectedComplaint.status}
                  </Text>
                </View>

                <View style={styles.modalDivider} />

                <Text style={styles.changeStatusLabel}>Submit Closure Request</Text>
                <Text style={styles.helpText}>
                  Once marked as CLOSED, admin approval is required for final confirmation.
                </Text>

                <TouchableOpacity
                  style={[styles.statusOption, styles.statusOptionClosed]}
                  onPress={() => handleStatusUpdate('CLOSED')}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color={COLORS.white}
                      />
                      <Text style={styles.statusOptionText}>Submit Request</Text>
                    </>
                  )}
                </TouchableOpacity>
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
    backgroundColor: COLORS.light,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: COLORS.dark,
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
  filterSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.light,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  filterBtnTextActive: {
    color: COLORS.dark,
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    gap: 6,
  },
  dateButtonText: {
    fontSize: 11,
    color: COLORS.dark,
    fontWeight: '500',
  },
  dateSeparator: {
    fontSize: 10,
    color: COLORS.gray,
    fontWeight: '500',
  },
  applyDateBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  complaintCard: {
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
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  complaintNo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  customerName: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusPending: {
    backgroundColor: COLORS.warning + '30',
  },
  statusClosed: {
    backgroundColor: COLORS.successLight,
  },
  stockAvailable: {
    backgroundColor: 'rgba(46, 204, 113, 0.1)', // Light green
  },
  stockUnavailable: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)', // Light red
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.dark,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  detailItem: {
    width: '48%',
    backgroundColor: COLORS.light,
    borderRadius: 6,
    padding: 8,
  },
  partDetailsContainer: {
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 4,
    alignItems: 'center',
    marginVertical: 2,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  columnHeader: {
    fontWeight: '600',
    color: '#333',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  columnValue: {
    color: '#333',
    fontSize: 14,
  },
  detailLabel: {
    fontSize: 10,
    color: COLORS.gray,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 11,
    color: COLORS.dark,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    margin: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
    color: COLORS.gray,
  },
  searchInput: {
    flex: 1,
    color: COLORS.dark,
    fontSize: 15,
    paddingVertical: 0,
    height: '100%',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  updateButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  updateButtonText: {
    color: COLORS.dark,
    fontSize: 12,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
  complaintSummary: {
    backgroundColor: COLORS.light,
    borderRadius: 8,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  summaryValue: {
    fontSize: 13,
    color: COLORS.dark,
    fontWeight: '600',
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: 16,
  },
  changeStatusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 4,
  },
  helpText: {
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 12,
    fontWeight: '500',
  },
  statusOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusOptionClosed: {
    backgroundColor: COLORS.success,
  },
  statusOptionText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
});
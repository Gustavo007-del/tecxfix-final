// // E:\study\techfix\techfix-app\src\screens\SparesComplaintsScreen.js
// import React, { useState, useEffect, useContext } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   FlatList,
//   ActivityIndicator,
//   RefreshControl,
//   TouchableOpacity,
//   Modal,
//   Alert,
//   ScrollView,
// } from 'react-native';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import DateTimePicker from '@react-native-community/datetimepicker';
// import MaterialIcons from '@expo/vector-icons/MaterialIcons';
// import { AuthContext } from '../context/AuthContext';
// import SHEETS_API from '../api/sheetsClient';
// import { COLORS } from '../theme/colors';

// export default function SparesComplaintsScreen() {
//   const insets = useSafeAreaInsets();
//   const { state } = useContext(AuthContext);

//   const [complaints, setComplaints] = useState([]);
//   const [filteredComplaints, setFilteredComplaints] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);

//   // Filter states
//   const [filterStatus, setFilterStatus] = useState('PENDING'); // PENDING or CLOSED
//   const [fromDate, setFromDate] = useState(new Date());
//   const [toDate, setToDate] = useState(new Date());

//   // Date picker states
//   const [showFromDatePicker, setShowFromDatePicker] = useState(false);
//   const [showToDatePicker, setShowToDatePicker] = useState(false);

//   // Status update modal
//   const [statusModalVisible, setStatusModalVisible] = useState(false);
//   const [selectedComplaint, setSelectedComplaint] = useState(null);
//   const [updatingStatus, setUpdatingStatus] = useState(false);

//   useEffect(() => {
//     fetchComplaints();
//   }, []);

//   const formatDate = (date) => {
//     const day = String(date.getDate()).padStart(2, '0');
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const year = date.getFullYear();
//     return `${day}-${month}-${year}`;
//   };

//   const fetchComplaints = async () => {
//     try {
//       setLoading(true);
//       const fromStr = formatDate(fromDate);
//       const toStr = formatDate(toDate);

//       const data = await SHEETS_API.getComplaints(
//         state.user?.first_name || '',
//         fromStr,
//         toStr
//       );

//       setComplaints(data);
//       filterComplaints(data, filterStatus);
//     } catch (error) {
//       Alert.alert('Error', 'Failed to fetch complaints');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const filterComplaints = (data, status) => {
//     let filtered = data;

//     if (status === 'PENDING') {
//       filtered = data.filter((c) => c.status === 'PENDING');
//     } else if (status === 'CLOSED') {
//       filtered = data.filter((c) => c.status === 'CLOSED');
//     }

//     setFilteredComplaints(filtered);
//   };

//   const handleFilterChange = (status) => {
//     setFilterStatus(status);
//     filterComplaints(complaints, status);
//   };

//   const handleFromDateChange = (event, selectedDate) => {
//     if (selectedDate) {
//       setFromDate(selectedDate);
//       setShowFromDatePicker(false);
//     }
//   };

//   const handleToDateChange = (event, selectedDate) => {
//     if (selectedDate) {
//       setToDate(selectedDate);
//       setShowToDatePicker(false);
//     }
//   };

//   const openStatusModal = (complaint) => {
//     setSelectedComplaint(complaint);
//     setStatusModalVisible(true);
//   };

//   const handleStatusUpdate = async (newStatus) => {
//     if (!selectedComplaint) return;

//     setUpdatingStatus(true);
//     try {
//       await SHEETS_API.updateComplaintStatus(
//         selectedComplaint.complaint_no,
//         newStatus
//       );

//       Alert.alert('Success', `Status updated to ${newStatus}`);

//       // Update local state
//       const updatedComplaints = complaints.map((c) =>
//         c.complaint_no === selectedComplaint.complaint_no
//           ? { ...c, status: newStatus }
//           : c
//       );
//       setComplaints(updatedComplaints);
//       filterComplaints(updatedComplaints, filterStatus);

//       setStatusModalVisible(false);
//     } catch (error) {
//       Alert.alert('Error', 'Failed to update status');
//     } finally {
//       setUpdatingStatus(false);
//     }
//   };

//   const onRefresh = async () => {
//     setRefreshing(true);
//     await fetchComplaints();
//     setRefreshing(false);
//   };

//   const renderComplaintItem = ({ item }) => (
//     <View style={styles.complaintCard}>
//       <View style={styles.complaintHeader}>
//         <View style={{ flex: 1 }}>
//           <Text style={styles.complaintNo}>{item.complaint_no}</Text>
//           <Text style={styles.customerName}>{item.customer_name}</Text>
//         </View>
//         <View
//           style={[
//             styles.statusBadge,
//             item.status === 'PENDING'
//               ? styles.statusPending
//               : styles.statusClosed,
//           ]}
//         >
//           <Text style={styles.statusText}>{item.status}</Text>
//         </View>
//       </View>

//       <View style={styles.divider} />

//       <View style={styles.detailsGrid}>
//         <View style={styles.detailItem}>
//           <Text style={styles.detailLabel}>📱 Phone</Text>
//           <Text style={styles.detailValue}>{item.customer_phone}</Text>
//         </View>
//         <View style={styles.detailItem}>
//           <Text style={styles.detailLabel}>📍 Area</Text>
//           <Text style={styles.detailValue}>{item.area}</Text>
//         </View>

//         <View style={styles.detailItem}>
//           <Text style={styles.detailLabel}>🏷️ Brand</Text>
//           <Text style={styles.detailValue}>{item.part_name}</Text>
//         </View>
//         <View style={styles.detailItem}>
//           <Text style={styles.detailLabel}>📦 Code</Text>
//           <Text style={styles.detailValue}>{item.part_no}</Text>
//         </View>

//         <View style={styles.detailItem}>
//           <Text style={styles.detailLabel}>🔢 Quantity</Text>
//           <Text style={styles.detailValue}>{item.quantity}</Text>
//         </View>
//         <View style={styles.detailItem}>
//           <Text style={styles.detailLabel}>📅 Date</Text>
//           <Text style={styles.detailValue}>{item.date}</Text>
//         </View>
//       </View>

//       {item.status === 'PENDING' && (
//         <TouchableOpacity
//           style={styles.updateButton}
//           onPress={() => openStatusModal(item)}
//         >
//           <MaterialIcons name="edit" size={16} color={COLORS.white} />
//           <Text style={styles.updateButtonText}>Update Status</Text>
//         </TouchableOpacity>
//       )}
//     </View>
//   );

//   if (loading) {
//     return (
//       <View style={[styles.container, { paddingTop: insets.top }]}>
//         <View style={styles.centerContent}>
//           <ActivityIndicator size="large" color={COLORS.primary} />
//         </View>
//       </View>
//     );
//   }

//   return (
//     <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
//       {/* Header */}
//       <View style={styles.header}>
//         <Text style={styles.headerTitle}>Spare Complaints</Text>
//         <Text style={styles.headerSubtitle}>
//           {state.user?.first_name || 'Technician'}
//         </Text>
//       </View>

//       {/* Filter Section */}
//       <View style={styles.filterSection}>
//         <View style={styles.filterButtons}>
//           <TouchableOpacity
//             style={[
//               styles.filterBtn,
//               filterStatus === 'PENDING' && styles.filterBtnActive,
//             ]}
//             onPress={() => handleFilterChange('PENDING')}
//           >
//             <Text
//               style={[
//                 styles.filterBtnText,
//                 filterStatus === 'PENDING' && styles.filterBtnTextActive,
//               ]}
//             >
//               Pending
//             </Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[
//               styles.filterBtn,
//               filterStatus === 'CLOSED' && styles.filterBtnActive,
//             ]}
//             onPress={() => handleFilterChange('CLOSED')}
//           >
//             <Text
//               style={[
//                 styles.filterBtnText,
//                 filterStatus === 'CLOSED' && styles.filterBtnTextActive,
//               ]}
//             >
//               Closed
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {filterStatus === 'CLOSED' && (
//           <View style={styles.dateSection}>
//             <TouchableOpacity
//               style={styles.dateButton}
//               onPress={() => setShowFromDatePicker(true)}
//             >
//               <MaterialIcons name="calendar-today" size={16} color={COLORS.primary} />
//               <Text style={styles.dateButtonText}>{formatDate(fromDate)}</Text>
//             </TouchableOpacity>

//             <Text style={styles.dateSeparator}>to</Text>

//             <TouchableOpacity
//               style={styles.dateButton}
//               onPress={() => setShowToDatePicker(true)}
//             >
//               <MaterialIcons name="calendar-today" size={16} color={COLORS.primary} />
//               <Text style={styles.dateButtonText}>{formatDate(toDate)}</Text>
//             </TouchableOpacity>

//             <TouchableOpacity
//               style={styles.applyDateBtn}
//               onPress={fetchComplaints}
//             >
//               <MaterialIcons name="check" size={16} color={COLORS.white} />
//             </TouchableOpacity>
//           </View>
//         )}
//       </View>

//       {/* Complaints List */}
//       <FlatList
//         data={filteredComplaints}
//         renderItem={renderComplaintItem}
//         keyExtractor={(item) => item.complaint_no}
//         contentContainerStyle={styles.listContainer}
//         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
//         ListEmptyComponent={
//           <View style={styles.emptyContainer}>
//             <MaterialIcons name="inbox" size={48} color={COLORS.gray} />
//             <Text style={styles.emptyText}>No complaints found</Text>
//           </View>
//         }
//       />

//       {/* Date Pickers */}
//       {showFromDatePicker && (
//         <DateTimePicker
//           value={fromDate}
//           mode="date"
//           display="default"
//           onChange={handleFromDateChange}
//         />
//       )}

//       {showToDatePicker && (
//         <DateTimePicker
//           value={toDate}
//           mode="date"
//           display="default"
//           onChange={handleToDateChange}
//         />
//       )}

//       {/* Status Update Modal */}
//       <Modal
//         visible={statusModalVisible}
//         animationType="slide"
//         transparent={true}
//         onRequestClose={() => setStatusModalVisible(false)}
//       >
//         <View style={styles.modalOverlay}>
//           <View style={styles.modalContent}>
//             <View style={styles.modalHeader}>
//               <Text style={styles.modalTitle}>Update Status</Text>
//               <TouchableOpacity
//                 onPress={() => setStatusModalVisible(false)}
//                 disabled={updatingStatus}
//               >
//                 <MaterialIcons name="close" size={24} color={COLORS.dark} />
//               </TouchableOpacity>
//             </View>

//             {selectedComplaint && (
//               <ScrollView style={styles.modalBody}>
//                 <View style={styles.complaintSummary}>
//                   <Text style={styles.summaryLabel}>Complaint No:</Text>
//                   <Text style={styles.summaryValue}>
//                     {selectedComplaint.complaint_no}
//                   </Text>

//                   <Text style={styles.summaryLabel}>Customer:</Text>
//                   <Text style={styles.summaryValue}>
//                     {selectedComplaint.customer_name}
//                   </Text>

//                   <Text style={styles.summaryLabel}>Current Status:</Text>
//                   <Text
//                     style={[
//                       styles.summaryValue,
//                       { color: COLORS.warning },
//                     ]}
//                   >
//                     {selectedComplaint.status}
//                   </Text>
//                 </View>

//                 <View style={styles.modalDivider} />

//                 <Text style={styles.changeStatusLabel}>Change Status To:</Text>

//                 <TouchableOpacity
//                   style={[styles.statusOption, styles.statusOptionClosed]}
//                   onPress={() => handleStatusUpdate('CLOSED')}
//                   disabled={updatingStatus}
//                 >
//                   {updatingStatus ? (
//                     <ActivityIndicator color={COLORS.white} />
//                   ) : (
//                     <>
//                       <MaterialIcons
//                         name="check-circle"
//                         size={20}
//                         color={COLORS.white}
//                       />
//                       <Text style={styles.statusOptionText}>Mark as CLOSED</Text>
//                     </>
//                   )}
//                 </TouchableOpacity>

//                 {selectedComplaint.status === 'CLOSED' && (
//                   <TouchableOpacity
//                     style={[styles.statusOption, styles.statusOptionPending]}
//                     onPress={() => handleStatusUpdate('PENDING')}
//                     disabled={updatingStatus}
//                   >
//                     {updatingStatus ? (
//                       <ActivityIndicator color={COLORS.white} />
//                     ) : (
//                       <>
//                         <MaterialIcons
//                           name="pending-actions"
//                           size={20}
//                           color={COLORS.white}
//                         />
//                         <Text style={styles.statusOptionText}>Revert to PENDING</Text>
//                       </>
//                     )}
//                   </TouchableOpacity>
//                 )}
//               </ScrollView>
//             )}
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: COLORS.light,
//   },
//   centerContent: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   header: {
//     backgroundColor: COLORS.dark,
//     paddingHorizontal: 24,
//     paddingVertical: 20,
//   },
//   headerTitle: {
//     fontSize: 28,
//     fontWeight: 'bold',
//     color: COLORS.primary,
//   },
//   headerSubtitle: {
//     fontSize: 14,
//     color: COLORS.light,
//     marginTop: 4,
//   },
//   filterSection: {
//     backgroundColor: COLORS.white,
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//     borderBottomColor: COLORS.lightGray,
//   },
//   filterButtons: {
//     flexDirection: 'row',
//     gap: 8,
//     marginBottom: 12,
//   },
//   filterBtn: {
//     flex: 1,
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     borderRadius: 6,
//     backgroundColor: COLORS.light,
//     borderWidth: 1,
//     borderColor: COLORS.lightGray,
//     alignItems: 'center',
//   },
//   filterBtnActive: {
//     backgroundColor: COLORS.primary,
//     borderColor: COLORS.primary,
//   },
//   filterBtnText: {
//     fontSize: 12,
//     fontWeight: '600',
//     color: COLORS.gray,
//   },
//   filterBtnTextActive: {
//     color: COLORS.white,
//   },
//   dateSection: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//   },
//   dateButton: {
//     flex: 1,
//     flexDirection: 'row',
//     paddingVertical: 8,
//     paddingHorizontal: 10,
//     borderRadius: 6,
//     borderWidth: 1,
//     borderColor: COLORS.primary,
//     alignItems: 'center',
//     gap: 6,
//   },
//   dateButtonText: {
//     fontSize: 11,
//     color: COLORS.dark,
//     fontWeight: '500',
//   },
//   dateSeparator: {
//     fontSize: 10,
//     color: COLORS.gray,
//     fontWeight: '500',
//   },
//   applyDateBtn: {
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     borderRadius: 6,
//     backgroundColor: COLORS.success,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   listContainer: {
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     paddingBottom: 20,
//   },
//   complaintCard: {
//     backgroundColor: COLORS.white,
//     borderRadius: 12,
//     padding: 16,
//     marginBottom: 12,
//     shadowColor: COLORS.black,
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//     elevation: 3,
//   },
//   complaintHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//     marginBottom: 12,
//   },
//   complaintNo: {
//     fontSize: 14,
//     fontWeight: 'bold',
//     color: COLORS.dark,
//   },
//   customerName: {
//     fontSize: 12,
//     color: COLORS.gray,
//     marginTop: 4,
//   },
//   statusBadge: {
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 6,
//   },
//   statusPending: {
//     backgroundColor: COLORS.warning + '20',
//   },
//   statusClosed: {
//     backgroundColor: COLORS.success + '20',
//   },
//   statusText: {
//     fontSize: 10,
//     fontWeight: '600',
//     color: COLORS.dark,
//   },
//   divider: {
//     height: 1,
//     backgroundColor: COLORS.lightGray,
//     marginVertical: 12,
//   },
//   detailsGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 8,
//     marginBottom: 12,
//   },
//   detailItem: {
//     width: '48%',
//     backgroundColor: COLORS.light,
//     borderRadius: 6,
//     padding: 8,
//   },
//   detailLabel: {
//     fontSize: 10,
//     color: COLORS.gray,
//     fontWeight: '500',
//     marginBottom: 4,
//   },
//   detailValue: {
//     fontSize: 11,
//     color: COLORS.dark,
//     fontWeight: '600',
//   },
//   updateButton: {
//     flexDirection: 'row',
//     backgroundColor: COLORS.primary,
//     paddingVertical: 10,
//     paddingHorizontal: 16,
//     borderRadius: 6,
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//   },
//   updateButtonText: {
//     color: COLORS.white,
//     fontSize: 12,
//     fontWeight: '600',
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingVertical: 40,
//   },
//   emptyText: {
//     fontSize: 14,
//     color: COLORS.gray,
//     marginTop: 12,
//     fontWeight: '500',
//   },
//   modalOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'flex-end',
//   },
//   modalContent: {
//     backgroundColor: COLORS.white,
//     borderTopLeftRadius: 20,
//     borderTopRightRadius: 20,
//     maxHeight: '80%',
//   },
//   modalHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//     paddingVertical: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: COLORS.lightGray,
//   },
//   modalTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     color: COLORS.dark,
//   },
//   modalBody: {
//     paddingHorizontal: 20,
//     paddingVertical: 16,
//   },
//   complaintSummary: {
//     backgroundColor: COLORS.light,
//     borderRadius: 8,
//     padding: 12,
//   },
//   summaryLabel: {
//     fontSize: 11,
//     color: COLORS.gray,
//     fontWeight: '600',
//     marginBottom: 4,
//     marginTop: 8,
//   },
//   summaryValue: {
//     fontSize: 13,
//     color: COLORS.dark,
//     fontWeight: '600',
//   },
//   modalDivider: {
//     height: 1,
//     backgroundColor: COLORS.lightGray,
//     marginVertical: 16,
//   },
//   changeStatusLabel: {
//     fontSize: 12,
//     fontWeight: '600',
//     color: COLORS.dark,
//     marginBottom: 12,
//   },
//   statusOption: {
//     paddingVertical: 12,
//     paddingHorizontal: 16,
//     borderRadius: 8,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//     marginBottom: 12,
//   },
//   statusOptionClosed: {
//     backgroundColor: COLORS.success,
//   },
//   statusOptionPending: {
//     backgroundColor: COLORS.warning,
//   },
//   statusOptionText: {
//     color: COLORS.white,
//     fontSize: 12,
//     fontWeight: '600',
//   },
// });

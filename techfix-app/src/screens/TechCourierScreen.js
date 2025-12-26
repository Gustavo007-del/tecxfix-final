// E:\study\techfix\techfix-app\src\screens\TechCourierScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import client, { API_ENDPOINTS } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { generateTechnicianCourierPDF, printTechnicianCourierPDF } from '../utils/TechnicianPDFGenerator';

export default function TechCourierScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { state } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [couriers, setCouriers] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [generatingPDF, setGeneratingPDF] = useState(null);

    const fetchCouriers = async () => {
        try {
            setLoading(true);
            const response = await client.get(API_ENDPOINTS.MY_COURIER_HISTORY);
            
            if (response.data.success) {
                setCouriers(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching couriers:', error);
            Alert.alert('Error', 'Failed to fetch couriers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCouriers();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchCouriers();
        setRefreshing(false);
    };

    const getTechnicianName = () => {
        // Handle different user object structures
        if (state.user) {
            if (typeof state.user === 'string') {
                try {
                    const userObj = JSON.parse(state.user);
                    return userObj.first_name || userObj.username || 'Technician';
                } catch (e) {
                    return state.user;
                }
            } else if (typeof state.user === 'object') {
                return state.user.first_name || state.user.username || 'Technician';
            }
        }
        return 'Technician';
    };

    const handleDownloadPDF = async (courier) => {
        try {
            setGeneratingPDF(courier.id);
            const technicianName = getTechnicianName();
            
            const result = await generateTechnicianCourierPDF(courier, technicianName);
            
            if (!result.success) {
                // If there's a message, show it to the user
                if (result.message) {
                    Alert.alert('Info', result.message);
                }
                return;
            }
            
            if (result.uri) {
                Alert.alert(
                    'Success',
                    'PDF generated successfully!',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            Alert.alert(
                'Error',
                error.message || 'Failed to generate PDF. Please try again.'
            );
        } finally {
            setGeneratingPDF(null);
        }
    };

    const handlePrintPDF = async (courier) => {
        try {
            setGeneratingPDF(courier.id);
            const technicianName = getTechnicianName();
            
            const result = await printTechnicianCourierPDF(courier, technicianName);
            
            if (!result.success) {
                // If there's a message, show it to the user
                if (result.message) {
                    Alert.alert('Info', result.message);
                }
                return;
            }
            
            Alert.alert(
                'Success',
                'PDF sent to printer!',
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error printing PDF:', error);
            Alert.alert(
                'Error',
                error.message || 'Failed to print PDF. Please try again.'
            );
        } finally {
            setGeneratingPDF(null);
        }
    };

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const calculateTotal = (items) => {
        return items.reduce((sum, item) => sum + (item.qty * item.mrp), 0);
    };

    const renderItemRow = (item) => (
        <View key={item.spare_id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemDetails}>
                    ID: {item.spare_id} | Brand: {item.brand}
                </Text>
                {item.hsn && (
                    <Text style={styles.itemDetails}>HSN: {item.hsn}</Text>
                )}
            </View>
            <View style={styles.itemPricing}>
                <Text style={styles.itemQty}>
                    Sent: {item.qty} {item.received_qty !== undefined ? `| Rcvd: ${item.received_qty}` : ''}
                </Text>
                <Text style={styles.itemPrice}>₹{item.mrp.toFixed(2)}</Text>
                <Text style={styles.itemTotal}>₹{(item.qty * item.mrp).toFixed(2)}</Text>
            </View>
        </View>
    );

    const renderCourierItem = ({ item }) => {
        const isExpanded = expandedId === item.id;
        const totalAmount = calculateTotal(item.items || []);
        const isGenerating = generatingPDF === item.id;

        return (
            <View style={styles.courierCard}>
                {/* Header */}
                <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => toggleExpand(item.id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.headerLeft}>
                        <Text style={styles.courierId}>{item.courier_id}</Text>
                        <View style={[
                            styles.statusBadge,
                            {
                                backgroundColor: item.status === 'received'
                                    ? COLORS.success
                                    : COLORS.warning
                            }
                        ]}>
                            <Text style={styles.statusText}>
                                {item.status === 'received' ? 'Received' : 'In Transit'}
                            </Text>
                        </View>
                    </View>
                    <MaterialIcons
                        name={isExpanded ? "expand-less" : "expand-more"}
                        size={24}
                        color={COLORS.gray}
                    />
                </TouchableOpacity>

                {/* Summary Info */}
                <View style={styles.summarySection}>
                    <View style={styles.infoRow}>
                        <MaterialIcons name="schedule" size={16} color={COLORS.gray} />
                        <Text style={styles.infoText}>
                            Sent: {formatDate(item.sent_time)}
                        </Text>
                    </View>

                    {item.received_time && (
                        <View style={styles.infoRow}>
                            <MaterialIcons name="check-circle" size={16} color={COLORS.success} />
                            <Text style={styles.infoText}>
                                Received: {formatDate(item.received_time)}
                            </Text>
                        </View>
                    )}

                    <View style={styles.infoRow}>
                        <MaterialIcons name="person" size={16} color={COLORS.gray} />
                        <Text style={styles.infoText}>
                            Sent by: {item.created_by_info?.first_name || item.created_by_info?.username || 'Admin'}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <MaterialIcons name="inventory" size={16} color={COLORS.primary} />
                        <Text style={styles.infoTextBold}>
                            {item.items?.length || 0} items | Total: ₹{totalAmount.toFixed(2)}
                        </Text>
                    </View>

                    {item.notes && (
                        <View style={styles.notesContainer}>
                            <MaterialIcons name="notes" size={16} color={COLORS.gray} />
                            <Text style={styles.notesText}>{item.notes}</Text>
                        </View>
                    )}
                </View>

                {/* Expanded Section - Items List */}
                {isExpanded && (
                    <View style={styles.expandedSection}>
                        <View style={styles.divider} />
                        
                        <View style={styles.itemsHeader}>
                            <Text style={styles.itemsHeaderText}>Items Details</Text>
                        </View>

                        <View style={styles.itemsContainer}>
                            {item.items && item.items.length > 0 ? (
                                item.items.map(renderItemRow)
                            ) : (
                                <Text style={styles.noItemsText}>No items</Text>
                            )}
                        </View>

                        {/* Total Row */}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Grand Total:</Text>
                            <Text style={styles.totalAmount}>₹{totalAmount.toFixed(2)}</Text>
                        </View>

                        {/* PDF Action Buttons */}
                        <View style={styles.pdfButtonsContainer}>
                            <TouchableOpacity
                                style={[styles.pdfButton, styles.downloadButton]}
                                onPress={() => handleDownloadPDF(item)}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <ActivityIndicator size="small" color={COLORS.white} />
                                ) : (
                                    <>
                                        <MaterialIcons name="picture-as-pdf" size={20} color={COLORS.white} />
                                        <Text style={styles.pdfButtonText}>Download PDF</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.pdfButton, styles.printButton]}
                                onPress={() => handlePrintPDF(item)}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <ActivityIndicator size="small" color={COLORS.white} />
                                ) : (
                                    <>
                                        <MaterialIcons name="print" size={20} color={COLORS.white} />
                                        <Text style={styles.pdfButtonText}>Print</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>My Courier History</Text>
                </View>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Courier History</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <MaterialIcons name="refresh" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.statsBar}>
                <MaterialIcons name="local-shipping" size={20} color={COLORS.primary} />
                <Text style={styles.statsText}>
                    Total Couriers: {couriers.length} | 
                    Received: {couriers.filter(c => c.status === 'received').length}
                </Text>
            </View>

            <FlatList
                data={couriers}
                renderItem={renderCourierItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="inbox" size={64} color={COLORS.lightGray} />
                        <Text style={styles.emptyText}>No couriers found</Text>
                        <Text style={styles.emptySubtext}>
                            Couriers sent to you will appear here
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.light },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.dark },
    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    statsText: { fontSize: 14, color: COLORS.dark, fontWeight: '600' },
    listContent: { padding: 16 },
    courierCard: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    courierId: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },
    summarySection: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    infoText: { fontSize: 13, color: COLORS.dark },
    infoTextBold: { fontSize: 13, color: COLORS.dark, fontWeight: '600' },
    notesContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#fff9e6',
        padding: 10,
        borderRadius: 6,
        marginTop: 4,
    },
    notesText: { fontSize: 13, color: COLORS.dark, flex: 1 },
    divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 12 },
    expandedSection: { paddingHorizontal: 16, paddingBottom: 16 },
    itemsHeader: {
        backgroundColor: '#f5f5f5',
        padding: 10,
        borderRadius: 6,
        marginBottom: 12,
    },
    itemsHeaderText: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
    itemsContainer: { gap: 12 },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#fafafa',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary,
    },
    itemInfo: { flex: 1, marginRight: 12 },
    itemName: { fontSize: 14, fontWeight: '600', color: COLORS.dark, marginBottom: 4 },
    itemDetails: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
    itemPricing: { alignItems: 'flex-end' },
    itemQty: { fontSize: 13, color: COLORS.dark, marginBottom: 2 },
    itemPrice: { fontSize: 12, color: COLORS.gray, marginBottom: 2 },
    itemTotal: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#e8f5e9',
        padding: 14,
        borderRadius: 8,
        marginTop: 12,
    },
    totalLabel: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
    totalAmount: { fontSize: 18, fontWeight: '700', color: COLORS.success },
    pdfButtonsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    pdfButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    downloadButton: {
        backgroundColor: '#d32f2f',
    },
    printButton: {
        backgroundColor: '#1976d2',
    },
    pdfButtonText: { 
        color: COLORS.white, 
        fontSize: 14, 
        fontWeight: '600' 
    },
    noItemsText: { 
        textAlign: 'center', 
        color: COLORS.gray, 
        fontSize: 14, 
        padding: 20 
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        marginTop: 64,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.gray,
        textAlign: 'center',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: COLORS.gray,
        textAlign: 'center',
    },
});
// E:\study\techfix\techfix-app\src\screens\AllCouriersScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import client, { API_ENDPOINTS } from '../api/client';
import { generateAdminCourierPDF, printAdminCourierPDF } from '../utils/AdminCourierPDFGenerator';

export default function AllCouriersScreen({ navigation }) {
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [couriers, setCouriers] = useState([]);
    const [filter, setFilter] = useState('all'); // all | in_transit | received
    const [expandedId, setExpandedId] = useState(null);
    const [generatingPDF, setGeneratingPDF] = useState(null);

    useEffect(() => {
        fetchCouriers();
    }, [filter]);

    const fetchCouriers = async () => {
        try {
            setLoading(true);

            const params = filter !== 'all' ? `?status=${filter}` : '';
            const response = await client.get(
                `${API_ENDPOINTS.COURIER_LIST}${params}`
            );

            if (response?.data?.success && Array.isArray(response.data.data)) {
                setCouriers(response.data.data);
            } else {
                setCouriers([]);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch couriers');
            setCouriers([]);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchCouriers();
        setRefreshing(false);
    };

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const handleDownloadPDF = async (courier) => {
        try {
            setGeneratingPDF(courier.id);

            const result = await generateAdminCourierPDF(courier);

            if (result.success) {
                Alert.alert(
                    'Success',
                    'PDF generated successfully!',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            Alert.alert(
                'Error',
                'Failed to generate PDF. Please try again.'
            );
        } finally {
            setGeneratingPDF(null);
        }
    };

    const handlePrintPDF = async (courier) => {
        try {
            setGeneratingPDF(courier.id);

            await printAdminCourierPDF(courier);

            Alert.alert(
                'Success',
                'Print dialog opened',
                [{ text: 'OK' }]
            );
        } catch (error) {
            Alert.alert(
                'Error',
                'Failed to print PDF. Please try again.'
            );
        } finally {
            setGeneratingPDF(null);
        }
    };

    /* ---------- SAFE HELPERS ---------- */

    const safeText = (value, fallback = '—') => {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string' || typeof value === 'number') {
            return String(value);
        }
        return fallback;
    };

    const formatDate = (dateValue) => {
        try {
            if (!dateValue) return '—';
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return '—';

            return date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return '—';
        }
    };

    const getTechnicianNames = (list) => {
        if (!Array.isArray(list) || list.length === 0) return '—';
        return list
            .map((t) => safeText(t?.first_name || t?.username))
            .join(', ');
    };

    const getItemCount = (items) => {
        return Array.isArray(items) ? items.length : 0;
    };

    const formatAmount = (amount) => {
        if (amount === null || amount === undefined) return null;
        const num = Number(amount);
        if (isNaN(num)) return null;
        return num.toFixed(2);
    };

    const getStatusMeta = (status) => {
        switch (status) {
            case 'in_transit':
                return {
                    label: 'In Transit',
                    color: COLORS.warning,
                    icon: 'local-shipping',
                };
            case 'received':
                return {
                    label: 'Received',
                    color: COLORS.success,
                    icon: 'check-circle',
                };
            default:
                return {
                    label: 'Unknown',
                    color: COLORS.gray,
                    icon: 'info',
                };
        }
    };

    const calculateTotal = (items) => {
        return items.reduce((sum, item) => sum + (item.qty * item.mrp), 0);
    };

    const renderItemRow = (item, index) => (
        <View key={index} style={styles.itemRow}>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={styles.itemDetails}>
                    {item.spare_id} | {item.brand || 'No Brand'}
                </Text>
                <View style={styles.qtyRow}>
                    <View style={styles.qtyItem}>
                        <Text style={styles.qtyLabel}>Sent:</Text>
                        <Text style={styles.qtyValue}>{item.qty || 0}</Text>
                    </View>
                    <View style={[styles.qtyItem, styles.qtyDivider]}>
                        <Text style={styles.qtyLabel}>Recvd:</Text>
                        <Text style={styles.qtyValue}>{item.received_qty || 0}</Text>
                    </View>
                    <View style={[styles.qtyItem, styles.qtyDivider]}>
                        <Text style={styles.qtyLabel}>Pend:</Text>
                        <Text style={styles.qtyValue}>{(item.qty || 0) - (item.received_qty || 0)}</Text>
                    </View>
                </View>
                <Text style={styles.itemPrice}>
                    ₹{item.mrp} x {item.qty} = ₹{(item.qty * item.mrp).toFixed(2)}
                </Text>
            </View>
            <View style={styles.itemTotalContainer}>
                <Text style={styles.itemTotal}>₹{(item.qty * item.mrp).toFixed(2)}</Text>
            </View>
        </View>
    );

    /* ---------- RENDER ITEM ---------- */

    const renderCourierItem = useCallback(({ item }) => {
        if (!item || typeof item !== 'object') return null;

        const statusMeta = getStatusMeta(item.status);
        const totalAmount = formatAmount(item.total_amount);
        const isExpanded = expandedId === item.id;
        const isGenerating = generatingPDF === item.id;

        return (
            <View style={styles.courierCard}>
                {/* HEADER - Touchable for expand/collapse */}
                <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => toggleExpand(item.id)}
                    activeOpacity={0.7}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={styles.courierId}>
                            {safeText(item.courier_id)}
                        </Text>
                        <Text style={styles.courierDate}>
                            {formatDate(item.sent_time)}
                        </Text>
                    </View>

                    <View style={styles.headerRight}>
                        <View
                            style={[
                                styles.statusBadge,
                                { backgroundColor: statusMeta.color },
                            ]}
                        >
                            <MaterialIcons
                                name={statusMeta.icon}
                                size={16}
                                color={COLORS.white}
                            />
                            <Text style={styles.statusText}>
                                {statusMeta.label}
                            </Text>
                        </View>
                        <MaterialIcons
                            name={isExpanded ? "expand-less" : "expand-more"}
                            size={24}
                            color={COLORS.gray}
                            style={{ marginLeft: 8 }}
                        />
                    </View>
                </TouchableOpacity>

                {/* BODY */}
                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <MaterialIcons
                            name="person"
                            size={16}
                            color={COLORS.gray}
                        />
                        <Text style={styles.infoText}>
                            {getTechnicianNames(item.technicians_info)}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <MaterialIcons
                            name="inventory"
                            size={16}
                            color={COLORS.gray}
                        />
                        <Text style={styles.infoText}>
                            {getItemCount(item.items)} items
                        </Text>
                    </View>

                    {totalAmount !== null && (
                        <View style={styles.infoRow}>
                            <MaterialIcons
                                name="currency-rupee"
                                size={16}
                                color={COLORS.gray}
                            />
                            <Text style={styles.infoText}>
                                ₹{totalAmount}
                            </Text>
                        </View>
                    )}
                </View>

                {/* NOTES */}
                {typeof item.notes === 'string' &&
                    item.notes.trim().length > 0 && (
                        <View style={styles.notesContainer}>
                            <Text style={styles.notesLabel}>Notes:</Text>
                            <Text
                                style={styles.notesText}
                                numberOfLines={isExpanded ? undefined : 2}
                            >
                                {item.notes}
                            </Text>
                        </View>
                    )}

                {/* EXPANDED SECTION - Items List */}
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
                            <Text style={styles.totalAmount}>
                                ₹{calculateTotal(item.items || []).toFixed(2)}
                            </Text>
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

                {/* FOOTER - View Details Button (only when collapsed) */}
                {!isExpanded && (
                    <View style={styles.cardFooter}>
                        <TouchableOpacity
                            style={styles.viewButton}
                            onPress={() =>
                                navigation.navigate('CourierView', {
                                    courierId: item.id,
                                })
                            }
                        >
                            <Text style={styles.viewButtonText}>
                                View Details
                            </Text>
                            <MaterialIcons
                                name="arrow-forward"
                                size={16}
                                color={COLORS.primary}
                            />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    }, [expandedId, generatingPDF]);

    /* ---------- UI ---------- */

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialIcons
                        name="arrow-back"
                        size={24}
                        color={COLORS.dark}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>All Couriers</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <MaterialIcons
                        name="refresh"
                        size={24}
                        color={COLORS.primary}
                    />
                </TouchableOpacity>
            </View>

            {/* FILTERS */}
            <View style={styles.filterContainer}>
                {['all', 'in_transit', 'received'].map((key) => (
                    <TouchableOpacity
                        key={key}
                        style={[
                            styles.filterTab,
                            filter === key && styles.filterTabActive,
                        ]}
                        onPress={() => setFilter(key)}
                    >
                        <Text
                            style={[
                                styles.filterText,
                                filter === key &&
                                    styles.filterTextActive,
                            ]}
                        >
                            {key === 'all'
                                ? 'All'
                                : key === 'in_transit'
                                ? 'In Transit'
                                : 'Received'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* STATS BAR */}
            <View style={styles.statsBar}>
                <MaterialIcons name="local-shipping" size={20} color={COLORS.primary} />
                <Text style={styles.statsText}>
                    Total: {couriers.length} | 
                    In Transit: {couriers.filter(c => c.status === 'in_transit').length} | 
                    Received: {couriers.filter(c => c.status === 'received').length}
                </Text>
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator
                        size="large"
                        color={COLORS.primary}
                    />
                </View>
            ) : (
                <FlatList
                    data={couriers}
                    renderItem={renderCourierItem}
                    keyExtractor={(item, index) =>
                        String(item?.id ?? index)
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialIcons
                                name="inbox"
                                size={64}
                                color={COLORS.lightGray}
                            />
                            <Text style={styles.emptyText}>
                                No couriers found
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

/* ---------- STYLES ---------- */

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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    headerTitle: {
        flex: 1,
        marginLeft: 12,
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.dark,
    },
    filterContainer: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
        gap: 8,
    },
    filterTab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: COLORS.light,
    },
    filterTabActive: {
        backgroundColor: COLORS.primary,
    },
    filterText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.gray,
    },
    filterTextActive: {
        color: COLORS.white,
    },
    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    statsText: { 
        fontSize: 14, 
        color: COLORS.dark, 
        fontWeight: '600' 
    },
    listContent: {
        padding: 16,
    },
    courierCard: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        marginBottom: 12,
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
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
        padding: 16,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    courierId: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.dark,
    },
    courierDate: {
        fontSize: 11,
        color: COLORS.gray,
        marginTop: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.white,
    },
    cardBody: {
        padding: 16,
        gap: 8,
    },
    qtyRow: {
        flexDirection: 'row',
        marginTop: 6,
        backgroundColor: '#f5f5f5',
        borderRadius: 6,
        padding: 6,
    },
    qtyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    qtyDivider: {
        borderLeftWidth: 1,
        borderLeftColor: '#e0e0e0',
    },
    qtyLabel: {
        fontSize: 12,
        color: COLORS.gray,
        marginRight: 4,
    },
    qtyValue: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.dark,
        minWidth: 20,
        textAlign: 'right',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        fontSize: 13,
        color: COLORS.dark,
    },
    notesContainer: {
        backgroundColor: COLORS.light,
        padding: 10,
        borderRadius: 8,
        marginHorizontal: 16,
        marginBottom: 12,
    },
    notesLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.gray,
        marginBottom: 4,
    },
    notesText: {
        fontSize: 12,
        color: COLORS.dark,
    },
    divider: { 
        height: 1, 
        backgroundColor: COLORS.lightGray, 
        marginVertical: 12 
    },
    expandedSection: { 
        paddingHorizontal: 16, 
        paddingBottom: 16 
    },
    itemsHeader: {
        backgroundColor: '#f5f5f5',
        padding: 10,
        borderRadius: 6,
        marginBottom: 12,
    },
    itemsHeaderText: { 
        fontSize: 14, 
        fontWeight: '700', 
        color: COLORS.dark 
    },
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
    itemName: { 
        fontSize: 14, 
        fontWeight: '600', 
        color: COLORS.dark, 
        marginBottom: 4 
    },
    itemDetails: { 
        fontSize: 12, 
        color: COLORS.gray, 
        marginTop: 2 
    },
    itemPricing: { alignItems: 'flex-end' },
    itemQty: { 
        fontSize: 13, 
        color: COLORS.dark, 
        marginBottom: 2 
    },
    itemPrice: { 
        fontSize: 12, 
        color: COLORS.gray, 
        marginBottom: 2 
    },
    itemTotal: { 
        fontSize: 14, 
        fontWeight: '700', 
        color: COLORS.primary 
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#e8f5e9',
        padding: 14,
        borderRadius: 8,
        marginTop: 12,
    },
    totalLabel: { 
        fontSize: 16, 
        fontWeight: '700', 
        color: COLORS.dark 
    },
    totalAmount: { 
        fontSize: 18, 
        fontWeight: '700', 
        color: COLORS.success 
    },
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
    cardFooter: {
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
        padding: 16,
    },
    viewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    viewButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 64,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.gray,
        marginTop: 16,
    },
});
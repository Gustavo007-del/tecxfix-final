// E:\study\techfix\techfix-app\src\screens\CourierViewScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import client, { API_ENDPOINTS } from '../api/client';
import { AuthContext } from '../context/AuthContext';

export default function CourierViewScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();
    const { state } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [courier, setCourier] = useState(null);
    const [error, setError] = useState(null);

    const { courierId } = route.params || {};

    useEffect(() => {
        if (courierId) {
            fetchCourierDetails();
        } else {
            setError('No courier ID provided');
            setLoading(false);
        }
    }, [courierId]);

    const fetchCourierDetails = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await client.get(API_ENDPOINTS.COURIER_DETAIL(courierId));
            
            console.log('Courier response:', JSON.stringify(response.data, null, 2));
            
            if (response.data.success) {
                setCourier(response.data.data);
            } else {
                setError('Failed to load courier details');
            }
        } catch (err) {
            console.error('Error fetching courier details:', err);
            console.error('Error response:', err.response?.data);
            setError(err.response?.data?.error || 'Failed to load courier details');
        } finally {
            setLoading(false);
        }
    };

    const handleReceiveClick = () => {
        if (courier && courier.id) {
            navigation.navigate('ReceiveCourier', { courierId: courier.id });
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading courier details...</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.dark} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Courier Details</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.centerContent}>
                    <MaterialIcons name="error-outline" size={64} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={fetchCourierDetails}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (!courier) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Text style={styles.errorText}>No courier data available</Text>
            </View>
        );
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'in_transit':
                return COLORS.warning;
            case 'received':
                return COLORS.success;
            default:
                return COLORS.gray;
        }
    };

    const isTechnician = !state.user?.is_staff;
    const canReceive = isTechnician && courier.status === 'in_transit';

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.dark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Courier Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.courierIdLabel}>Courier ID</Text>
                        <Text style={styles.courierIdValue}>{courier.courier_id || 'N/A'}</Text>
                    </View>

                    <View style={styles.statusContainer}>
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusColor(courier.status) }
                        ]}>
                            <MaterialIcons 
                                name={courier.status === 'received' ? 'check-circle' : 'local-shipping'} 
                                size={16} 
                                color={COLORS.white} 
                            />
                            <Text style={styles.statusText}>
                                {courier.status === 'in_transit' ? 'In Transit' : 'Received'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoSection}>
                        <View style={styles.infoRow}>
                            <MaterialIcons name="calendar-today" size={20} color={COLORS.gray} />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Sent Time</Text>
                                <Text style={styles.infoValue}>
                                    {new Date(courier.sent_time).toLocaleString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </Text>
                            </View>
                        </View>

                        {courier.received_time && (
                            <View style={styles.infoRow}>
                                <MaterialIcons name="check-circle" size={20} color={COLORS.success} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Received Time</Text>
                                    <Text style={styles.infoValue}>
                                        {new Date(courier.received_time).toLocaleString('en-IN', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.infoRow}>
                            <MaterialIcons name="person" size={20} color={COLORS.gray} />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Created By</Text>
                                <Text style={styles.infoValue}>
                                    {courier.created_by_info?.first_name || courier.created_by_info?.username || 'N/A'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Assigned Technicians</Text>
                        {courier.technicians_info && courier.technicians_info.length > 0 ? (
                            courier.technicians_info.map((tech, index) => (
                                <View key={tech.id || index} style={styles.techItem}>
                                    <MaterialIcons name="account-circle" size={24} color={COLORS.primary} />
                                    <View style={styles.techInfo}>
                                        <Text style={styles.techName}>
                                            {tech.first_name || tech.username || 'Unknown'}
                                        </Text>
                                        {tech.email && (
                                            <Text style={styles.techEmail}>{tech.email}</Text>
                                        )}
                                    </View>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noDataText}>No technicians assigned</Text>
                        )}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Items ({courier.items?.length || 0})</Text>
                        {courier.items && courier.items.length > 0 ? (
                            courier.items.map((item, index) => (
                                <View key={index} style={styles.itemCard}>
                                    <Text style={styles.itemName}>{item.name || 'Unknown Item'}</Text>
                                    <View style={styles.itemDetailRow}>
                                        <View style={styles.itemDetailItem}>
                                            <Text style={styles.itemDetailLabel}>Code:</Text>
                                            <Text style={styles.itemDetailValue}>{item.spare_id || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.itemDetailItem}>
                                            <Text style={styles.itemDetailLabel}>Qty:</Text>
                                            <Text style={styles.itemDetailValue}>{item.qty || 0}</Text>
                                        </View>
                                        <View style={styles.itemDetailItem}>
                                            <Text style={styles.itemDetailLabel}>Price:</Text>
                                            <Text style={styles.itemDetailValue}>₹{item.mrp || 0}</Text>
                                        </View>
                                    </View>
                                    {item.brand && (
                                        <Text style={styles.itemBrand}>Brand: {item.brand}</Text>
                                    )}
                                    {item.hsn && (
                                        <Text style={styles.itemCode}>HSN: {item.hsn}</Text>
                                    )}
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noDataText}>No items in this courier</Text>
                        )}
                    </View>

                    {courier.notes && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Notes</Text>
                            <Text style={styles.notesText}>{courier.notes}</Text>
                        </View>
                    )}

                    <View style={styles.totalSection}>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalAmount}>
                            ₹{courier.total_amount ? parseFloat(courier.total_amount).toFixed(2) : '0.00'}
                        </Text>
                    </View>
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
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.dark,
        flex: 1,
        marginLeft: 12,
    },
    content: {
        flex: 1,
    },
    card: {
        backgroundColor: COLORS.white,
        margin: 16,
        borderRadius: 12,
        padding: 16,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    courierIdLabel: {
        fontSize: 12,
        color: COLORS.gray,
        fontWeight: '500',
        marginBottom: 4,
    },
    courierIdValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.dark,
    },
    statusContainer: {
        marginBottom: 20,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        alignSelf: 'flex-start',
        gap: 6,
    },
    statusText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 13,
    },
    infoSection: {
        marginBottom: 20,
        gap: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: COLORS.gray,
        fontWeight: '500',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 14,
        color: COLORS.dark,
        fontWeight: '600',
    },
    section: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.dark,
        marginBottom: 12,
    },
    techItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        padding: 12,
        backgroundColor: COLORS.light,
        borderRadius: 8,
        gap: 12,
    },
    techInfo: {
        flex: 1,
    },
    techName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.dark,
    },
    techEmail: {
        fontSize: 12,
        color: COLORS.gray,
        marginTop: 2,
    },
    itemCard: {
        backgroundColor: COLORS.light,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.dark,
        marginBottom: 8,
    },
    itemDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    itemDetailItem: {
        flex: 1,
    },
    itemDetailLabel: {
        fontSize: 11,
        color: COLORS.gray,
        fontWeight: '500',
    },
    itemDetailValue: {
        fontSize: 13,
        color: COLORS.dark,
        fontWeight: '600',
        marginTop: 2,
    },
    itemCode: {
        fontSize: 11,
        color: COLORS.gray,
        fontStyle: 'italic',
        marginTop: 4,
    },
    itemBrand: {
        fontSize: 11,
        color: COLORS.gray,
        marginTop: 2,
    },
    notesText: {
        fontSize: 13,
        color: COLORS.dark,
        lineHeight: 20,
    },
    totalSection: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 2,
        borderTopColor: COLORS.primary,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.dark,
    },
    totalAmount: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    noDataText: {
        fontSize: 13,
        color: COLORS.gray,
        textAlign: 'center',
        paddingVertical: 16,
    },
    loadingText: {
        fontSize: 14,
        color: COLORS.gray,
        marginTop: 12,
    },
    errorText: {
        color: COLORS.error,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
    footer: {
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
        padding: 16,
    },
    receiveButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 8,
        gap: 8,
    },
    receiveButtonText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '600',
    },
});
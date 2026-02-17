// E:\study\techfix\techfix-app\src\screens\OrderHistoryScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import client from '../api/client';

export default function OrderHistoryScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orderHistory, setOrderHistory] = useState([]);

    useEffect(() => {
        fetchOrderHistory();
    }, []);

    const fetchOrderHistory = async () => {
        try {
            setLoading(true);
            const response = await client.get('/stock-out/order-history/');
            
            if (response.data.success) {
                setOrderHistory(response.data.data || []);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchOrderHistory();
        setRefreshing(false);
    };

    const formatDateTime = (dateString) => {
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

    const renderItem = ({ item }) => (
        <View style={styles.itemCard}>
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.complaintNo}>{item.complaint_no}</Text>
                    <Text style={styles.partName}>{item.part_name}</Text>
                </View>
                <View style={styles.statusBadge}>
                    <MaterialIcons name="check" size={16} color={COLORS.white} />
                    <Text style={styles.statusText}>Ordered</Text>
                </View>
            </View>

            <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                    <MaterialIcons name="category" size={16} color={COLORS.gray} />
                    <Text style={styles.infoText}>Brand: {item.brand_name || 'N/A'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <MaterialIcons name="code" size={16} color={COLORS.gray} />
                    <Text style={styles.infoText}>Code: {item.product_code || 'N/A'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <MaterialIcons name="location-on" size={16} color={COLORS.gray} />
                    <Text style={styles.infoText}>Area: {item.area || 'N/A'}</Text>
                </View>

                {item.mrp && (
                    <View style={styles.infoRow}>
                        <MaterialIcons name="currency-rupee" size={16} color={COLORS.gray} />
                        <Text style={styles.infoText}>MRP: ₹{item.mrp}</Text>
                    </View>
                )}

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                    <MaterialIcons name="person" size={16} color={COLORS.primary} />
                    <Text style={styles.infoTextBold}>
                        Ordered by: {item.ordered_by_name || 'Admin'}
                    </Text>
                </View>

                <View style={styles.infoRow}>
                    <MaterialIcons name="access-time" size={16} color={COLORS.primary} />
                    <Text style={styles.infoTextBold}>
                        {formatDateTime(item.ordered_at)}
                    </Text>
                </View>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.dark} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Order History</Text>
                    <View style={{ width: 24 }} />
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
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.dark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order History</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <MaterialIcons name="refresh" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.infoBar}>
                <MaterialIcons name="history" size={20} color={COLORS.primary} />
                <Text style={styles.infoBarText}>
                    Total Orders: {orderHistory.length}
                </Text>
            </View>

            <FlatList
                data={orderHistory}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="history" size={64} color={COLORS.lightGray} />
                        <Text style={styles.emptyText}>No order history</Text>
                        <Text style={styles.emptySubtext}>
                            Order history will appear here
                        </Text>
                    </View>
                }
            />
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
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.dark,
        flex: 1,
        marginLeft: 12,
    },
    infoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    infoBarText: {
        fontSize: 13,
        color: COLORS.dark,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    itemCard: {
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
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    complaintNo: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.dark,
    },
    partName: {
        fontSize: 13,
        color: COLORS.dark,
        marginTop: 4,
        fontWeight: '600',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: COLORS.success,
        gap: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.white,
    },
    cardBody: {
        gap: 8,
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
    infoTextBold: {
        fontSize: 13,
        color: COLORS.dark,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.lightGray,
        marginVertical: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.gray,
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 13,
        color: COLORS.gray,
        marginTop: 8,
        textAlign: 'center',
    },
});
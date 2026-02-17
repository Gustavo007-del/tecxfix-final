// E:\study\techfix\techfix-app\src\screens\StockOrderedScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import client from '../api/client';

export default function StockOrderedScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orderedItems, setOrderedItems] = useState([]);

    useEffect(() => {
        fetchOrderedItems();
    }, []);

    const fetchOrderedItems = async () => {
        try {
            setLoading(true);
            const response = await client.get('/stock-ordered/');
            
            if (response.data.success) {
                setOrderedItems(response.data.data || []);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch ordered items');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchOrderedItems();
        setRefreshing(false);
    };

    const handleReceive = async (complaint_no) => {
        Alert.alert(
            'Confirm Receipt',
            `Mark this item as received?\nComplaint: ${complaint_no}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Received',
                    onPress: async () => {
                        try {
                            const response = await client.post('/stock-ordered/receive/', {
                                complaint_no: complaint_no
                            });

                            if (response.data.success) {
                                Alert.alert('Success', response.data.message);
                                fetchOrderedItems(); // Refresh list
                            }
                        } catch (error) {
                            const errorMsg = error.response?.data?.error || 'Failed to mark as received';
                            Alert.alert('Error', errorMsg);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => (
        <View style={styles.itemCard}>
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.complaintNo}>{item.complaint_no}</Text>
                    <Text style={styles.partName}>{item.part_name}</Text>
                </View>
                <View style={styles.statusBadge}>
                    <MaterialIcons name="local-shipping" size={16} color={COLORS.white} />
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

                <View style={styles.infoRow}>
                    <MaterialIcons name="place" size={16} color={COLORS.gray} />
                    <Text style={styles.infoText}>District: {item.district || 'N/A'}</Text>
                </View>

                {item.mrp && (
                    <View style={styles.infoRow}>
                        <MaterialIcons name="currency-rupee" size={16} color={COLORS.gray} />
                        <Text style={styles.infoText}>MRP: ₹{item.mrp}</Text>
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={styles.receiveButton}
                onPress={() => handleReceive(item.complaint_no)}
            >
                <MaterialIcons name="check-circle" size={18} color={COLORS.white} />
                <Text style={styles.receiveButtonText}>Mark as Received</Text>
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.dark} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Ordered Items</Text>
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
                <Text style={styles.headerTitle}>Ordered Items</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <MaterialIcons name="refresh" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.infoBar}>
                <MaterialIcons name="info-outline" size={20} color={COLORS.warning} />
                <Text style={styles.infoBarText}>
                    Items awaiting receipt ({orderedItems.length})
                </Text>
            </View>

            <FlatList
                data={orderedItems}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.complaint_no}-${index}`}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="done-all" size={64} color={COLORS.lightGray} />
                        <Text style={styles.emptyText}>No ordered items</Text>
                        <Text style={styles.emptySubtext}>
                            All orders have been received
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
        backgroundColor: '#fff3cd',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    infoBarText: {
        fontSize: 13,
        color: COLORS.dark,
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
        backgroundColor: COLORS.warning,
        gap: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.white,
    },
    cardBody: {
        marginBottom: 12,
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
    receiveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.success,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
        marginTop: 4,
    },
    receiveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.white,
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
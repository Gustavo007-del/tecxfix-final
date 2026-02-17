// E:\study\techfix\techfix-app\src\screens\StockOutScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import client from '../api/client';

export default function StockOutScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stockOutItems, setStockOutItems] = useState([]);

    useEffect(() => {
        fetchStockOutItems();
    }, []);

    const fetchStockOutItems = async () => {
        try {
            setLoading(true);
            const response = await client.get('/stock-out/');
            
            if (response.data.success) {
                setStockOutItems(response.data.data || []);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch stock-out items');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchStockOutItems();
        setRefreshing(false);
    };

    const handleOrder = async (complaint_no) => {
        
        if (!complaint_no || typeof complaint_no !== 'string' || complaint_no.trim() === '') {
            Alert.alert('Error', 'Invalid complaint number');
            return;
        }

        Alert.alert(
            'Confirm Order',
            `Are you sure you want to order this item?\nComplaint: ${complaint_no}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Order',
                    onPress: async () => {
                        try {
                            const payload = { complaint_no: complaint_no };
                            
                            const response = await client.post('/stock-out/order/', payload, {
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            });

                            
                            if (response.data && response.data.success) {
                                Alert.alert('Success', response.data.message || 'Item ordered successfully');
                                fetchStockOutItems(); // Refresh list
                            } else {
                                Alert.alert('Error', response.data?.error || 'Failed to process order');
                            }
                        } catch (error) {
                            let errorMessage = 'Failed to order item';
                            if (error.response) {
                                // The request was made and the server responded with a status code
                                // that falls out of the range of 2xx
                                if (error.response.status === 400) {
                                    errorMessage = error.response.data?.error || 'Bad request. Please check the complaint number.';
                                } else if (error.response.status === 401 || error.response.status === 403) {
                                    errorMessage = 'Authentication failed. Please login again.';
                                } else if (error.response.status === 404) {
                                    errorMessage = 'Complaint not found in the system.';
                                } else if (error.response.status === 500) {
                                    errorMessage = 'Server error. Please try again later.';
                                }
                            } else if (error.request) {
                                // The request was made but no response was received
                                errorMessage = 'No response from server. Please check your connection.';
                            }
                            
                            Alert.alert('Error', errorMessage);
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
                    <MaterialIcons name="warning" size={16} color={COLORS.white} />
                    <Text style={styles.statusText}>Stock Out</Text>
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
                style={styles.orderButton}
                onPress={() => handleOrder(item.complaint_no)}
            >
                <MaterialIcons name="shopping-cart" size={18} color={COLORS.white} />
                <Text style={styles.orderButtonText}>Order Now</Text>
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
                    <Text style={styles.headerTitle}>Stock Out Items</Text>
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
                <Text style={styles.headerTitle}>Stock Out Items</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <MaterialIcons name="refresh" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.infoBar}>
                <MaterialIcons name="info-outline" size={20} color={COLORS.primary} />
                <Text style={styles.infoText}>
                    Items requiring order ({stockOutItems.length})
                </Text>
            </View>

            <FlatList
                data={stockOutItems}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.complaint_no}-${index}`}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="inventory-2" size={64} color={COLORS.lightGray} />
                        <Text style={styles.emptyText}>No stock-out items</Text>
                        <Text style={styles.emptySubtext}>
                            All items are available or ordered
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
        backgroundColor: COLORS.error,
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
    orderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
        marginTop: 4,
    },
    orderButtonText: {
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
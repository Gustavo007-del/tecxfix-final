// E:\study\techfix\techfix-app\src\screens\ReceiveCourierScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, TextInput, FlatList
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import client, { API_ENDPOINTS } from '../api/client';

export default function ReceiveCourierScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();
    const { courierId, fromTab } = route.params || {};
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [courier, setCourier] = useState(null);
    const [couriers, setCouriers] = useState([]);
    const [error, setError] = useState(null);
    const [selectedItems, setSelectedItems] = useState({});
    // selectedItems format: { "spare_id": { selected: true, qty: 2 } }

    useEffect(() => {
        if (courierId) {
            fetchCourierDetails();
        } else if (fromTab) {
            fetchAvailableCouriers();
        } else {
            // If no courierId and not from tab, go back
            navigation.goBack();
        }
    }, [courierId, fromTab]);

    const fetchAvailableCouriers = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await client.get(API_ENDPOINTS.PENDING_COURIERS);
            if (response.data && Array.isArray(response.data)) {
                setCouriers(response.data || []);
            } else if (response.data && response.data.data) {
                // Handle case where data is nested under data property
                setCouriers(response.data.data || []);
            } else {
                setCouriers([]);
            }
        } catch (error) {
            console.error('Error fetching pending couriers:', error);
            setError('Failed to load pending couriers');
            setCouriers([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchCourierDetails = async () => {
        if (!courierId) return;
        
        try {
            setLoading(true);
            setError(null);
            const response = await client.get(API_ENDPOINTS.COURIER_DETAIL(courierId));
            
            if (response.data.success) {
                setCourier(response.data.data);
                // Initialize all items as not selected
                const initialSelection = {};
                response.data.data.items.forEach(item => {
                    initialSelection[item.spare_id] = {
                        selected: false,
                        qty: 0
                    };
                });
                setSelectedItems(initialSelection);
            }
        } catch (error) {
            console.error('Error fetching courier:', error);
            setError('Failed to load courier details');
            if (!fromTab) {
                navigation.goBack();
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleItemSelection = (spareId, maxQty) => {
        setSelectedItems(prev => ({
            ...prev,
            [spareId]: {
                selected: !prev[spareId].selected,
                qty: !prev[spareId].selected ? maxQty : 0
            }
        }));
    };

    const updateItemQty = (spareId, qty, maxQty) => {
        const parsedQty = parseInt(qty, 10) || 0;
        const validQty = Math.min(Math.max(0, parsedQty), maxQty);
        
        setSelectedItems(prev => ({
            ...prev,
            [spareId]: {
                selected: validQty > 0,
                qty: validQty
            }
        }));
    };

    const handleReceive = async () => {
        // Build received items array
        const receivedItems = Object.entries(selectedItems)
            .filter(([_, data]) => data.selected && data.qty > 0)
            .map(([spare_id, data]) => ({
                spare_id,
                qty: data.qty
            }));

        if (receivedItems.length === 0) {
            Alert.alert('Error', 'Please select at least one item to receive');
            return;
        }

        Alert.alert(
            'Confirm Receipt',
            `You are about to receive ${receivedItems.length} item(s). This will update the stock. Continue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            const response = await client.post(
                                `/mark-received/${courierId}/`,
                                { received_items: receivedItems }
                            );

                            if (response.data.success) {
                                Alert.alert(
                                    'Success',
                                    response.data.message || 'Items received successfully!',
                                    [
                                        {
                                            text: 'OK',
                                            onPress: () => navigation.goBack()
                                        }
                                    ]
                                );
                            }
                        } catch (error) {
                            console.error('Error receiving courier:', error);
                            const errorMsg = error.response?.data?.error || 'Failed to mark as received';
                            Alert.alert('Error', errorMsg);
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={courierId ? fetchCourierDetails : fetchAvailableCouriers}
                >
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Show list of couriers when in tab view
    if (fromTab && !courierId) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Text style={styles.title}>Available Couriers</Text>
                {couriers.length > 0 ? (
                    <FlatList
                        data={couriers}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.courierItem}
                                onPress={() => navigation.navigate('ReceiveCourierDetails', { 
                                    courierId: item.id,
                                    fromTab: false
                                })}
                            >
                                <Text style={styles.courierId}>Courier ID: {item.courier_id || 'N/A'}</Text>
                                <Text>Status: {item.status || 'N/A'}</Text>
                                <Text>Items: {item.items?.length || 0}</Text>
                            </TouchableOpacity>
                        )}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={styles.listContainer}
                    />
                ) : (
                    <Text style={styles.noCouriers}>No couriers available to receive</Text>
                )}
            </View>
        );
    }

    if (!courier) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Text style={styles.errorText}>Courier not found</Text>
            </View>
        );
    }

    const selectedCount = Object.values(selectedItems).filter(item => item.selected).length;
    const totalSelectedQty = Object.values(selectedItems).reduce((sum, item) => 
        sum + (item.selected ? item.qty : 0), 0
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.dark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Receive Items</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.infoCard}>
                <Text style={styles.courierId}>{courier.courier_id}</Text>
                <Text style={styles.courierDate}>
                    Sent: {new Date(courier.sent_time).toLocaleDateString('en-IN')}
                </Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionTitle}>
                    Select Items to Receive ({selectedCount} selected)
                </Text>

                {courier.items.map((item, index) => {
                    const itemSelection = selectedItems[item.spare_id] || { selected: false, qty: 0 };
                    const isSelected = itemSelection.selected;

                    return (
                        <View key={index} style={[
                            styles.itemCard,
                            isSelected && styles.itemCardSelected
                        ]}>
                            <TouchableOpacity
                                style={styles.itemHeader}
                                onPress={() => toggleItemSelection(item.spare_id, item.qty)}
                            >
                                <View style={styles.checkbox}>
                                    {isSelected && (
                                        <MaterialIcons name="check" size={18} color={COLORS.white} />
                                    )}
                                </View>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <Text style={styles.itemDetails}>
                                        Code: {item.spare_id} | Max: {item.qty}
                                    </Text>
                                    {item.brand && (
                                        <Text style={styles.itemBrand}>Brand: {item.brand}</Text>
                                    )}
                                </View>
                            </TouchableOpacity>

                            {isSelected && (
                                <View style={styles.qtySelector}>
                                    <Text style={styles.qtyLabel}>Quantity:</Text>
                                    <View style={styles.qtyControls}>
                                        <TouchableOpacity
                                            style={styles.qtyButton}
                                            onPress={() => updateItemQty(
                                                item.spare_id,
                                                itemSelection.qty - 1,
                                                item.qty
                                            )}
                                        >
                                            <MaterialIcons name="remove" size={20} color={COLORS.white} />
                                        </TouchableOpacity>

                                        <TextInput
                                            style={styles.qtyInput}
                                            value={itemSelection.qty.toString()}
                                            onChangeText={(text) => updateItemQty(
                                                item.spare_id,
                                                text,
                                                item.qty
                                            )}
                                            keyboardType="numeric"
                                            maxLength={3}
                                        />

                                        <TouchableOpacity
                                            style={styles.qtyButton}
                                            onPress={() => updateItemQty(
                                                item.spare_id,
                                                itemSelection.qty + 1,
                                                item.qty
                                            )}
                                        >
                                            <MaterialIcons name="add" size={20} color={COLORS.white} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.summaryContainer}>
                    <Text style={styles.summaryText}>
                        {selectedCount} items | Total Qty: {totalSelectedQty}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[
                        styles.receiveButton,
                        (selectedCount === 0 || submitting) && styles.receiveButtonDisabled
                    ]}
                    onPress={handleReceive}
                    disabled={selectedCount === 0 || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <>
                            <MaterialIcons name="check-circle" size={20} color={COLORS.white} />
                            <Text style={styles.receiveButtonText}>Mark as Received</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.light,
        padding: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: COLORS.dark,
    },
    errorText: {
        color: COLORS.danger,
        marginBottom: 16,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: COLORS.primary,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    retryButtonText: {
        color: COLORS.white,
        fontWeight: 'bold',
    },
    courierItem: {
        backgroundColor: COLORS.white,
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    courierId: {
        fontWeight: 'bold',
        marginBottom: 5,
    },
    listContainer: {
        paddingBottom: 20,
    },
    noCouriers: {
        textAlign: 'center',
        marginTop: 20,
        color: COLORS.gray,
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
    infoCard: {
        backgroundColor: COLORS.white,
        marginHorizontal: 16,
        marginTop: 16,
        padding: 16,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
    },
    courierId: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.dark,
    },
    courierDate: {
        fontSize: 12,
        color: COLORS.gray,
        marginTop: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.dark,
        marginTop: 16,
        marginBottom: 12,
    },
    itemCard: {
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: COLORS.lightGray,
    },
    itemCardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: '#f0f9ff',
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        marginRight: 12,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.dark,
    },
    itemDetails: {
        fontSize: 12,
        color: COLORS.gray,
        marginTop: 4,
    },
    itemBrand: {
        fontSize: 11,
        color: COLORS.gray,
        marginTop: 2,
    },
    qtySelector: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
    },
    qtyLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.dark,
        marginBottom: 8,
    },
    qtyControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    qtyButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyInput: {
        width: 60,
        height: 36,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
        borderRadius: 6,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.dark,
    },
    footer: {
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    summaryContainer: {
        marginBottom: 12,
    },
    summaryText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.dark,
        textAlign: 'center',
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
    receiveButtonDisabled: {
        opacity: 0.5,
    },
    receiveButtonText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 14,
        color: COLORS.error,
        textAlign: 'center',
        marginTop: 20,
    },
});
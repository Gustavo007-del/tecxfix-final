import React, { useState, useEffect, useContext } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl, TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import client, { API_ENDPOINTS } from '../api/client';
import { COLORS } from '../theme/colors';

export default function CourierStockScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    
    useEffect(() => {
        fetchStock();
    }, []);
    
    const fetchStock = async () => {
        try {
            const response = await client.get(API_ENDPOINTS.COMPANY_STOCK);
            
            // Handle nested response structure
            const stockData = response.data.data || response.data;
            setStock(Array.isArray(stockData) ? stockData : []);
        } catch (error) {
            setStock([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };
    
    const onRefresh = async () => {
        setRefreshing(true);
        await fetchStock();
    };
    
    // Filter and sort stock
    const processedStock = stock
        .filter(item =>
            item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.spare_id?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'qty') return b.qty - a.qty;
            if (sortBy === 'mrp') return b.mrp - a.mrp;
            return 0;
        });
    
    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCode}>{item.spare_id}</Text>
                </View>
                <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>{item.qty}</Text>
                </View>
            </View>
            
            <View style={styles.cardBody}>
                <View style={styles.row}>
                    <Text style={styles.label}>MRP:</Text>
                    <Text style={styles.value}>₹{item.mrp?.toFixed(2)}</Text>
                </View>
                {item.brand && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Brand:</Text>
                        <Text style={styles.value}>{item.brand}</Text>
                    </View>
                )}
                {item.hsn && (
                    <View style={styles.row}>
                        <Text style={styles.label}>HSN:</Text>
                        <Text style={styles.value}>{item.hsn}</Text>
                    </View>
                )}
            </View>
        </View>
    );
    
    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }
    
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Company Stock</Text>
                <Text style={styles.headerSubtitle}>
                    {processedStock.length} items available
                </Text>
            </View>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={20} color={COLORS.gray} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search items..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={COLORS.gray}
                />
            </View>
            
            {/* Sort Options */}
            <View style={styles.sortContainer}>
                {['name', 'qty', 'mrp'].map(option => (
                    <TouchableOpacity
                        key={option}
                        style={[
                            styles.sortButton,
                            sortBy === option && styles.sortButtonActive
                        ]}
                        onPress={() => setSortBy(option)}
                    >
                        <Text
                            style={[
                                styles.sortButtonText,
                                sortBy === option && styles.sortButtonTextActive
                            ]}
                        >
                            {option.toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            
            <FlatList
                data={processedStock}
                keyExtractor={item => item.spare_id}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="inventory" size={40} color={COLORS.gray} />
                        <Text style={styles.emptyText}>No items found</Text>
                    </View>
                }
                renderItem={renderItem}
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        backgroundColor: COLORS.dark,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    headerSubtitle: {
        fontSize: 12,
        color: COLORS.light,
        marginTop: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 12,
        marginVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: COLORS.white,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        paddingVertical: 10,
        fontSize: 14,
        color: COLORS.dark,
    },
    sortContainer: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    sortButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    sortButtonActive: {
        backgroundColor: COLORS.primary,
    },
    sortButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.primary,
    },
    sortButtonTextActive: {
        color: COLORS.white,
    },
    listContainer: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.dark,
    },
    itemCode: {
        fontSize: 11,
        color: COLORS.gray,
        marginTop: 4,
    },
    qtyBadge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    qtyText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: '600',
    },
    cardBody: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    label: {
        fontSize: 12,
        color: COLORS.gray,
        fontWeight: '500',
    },
    value: {
        fontSize: 12,
        color: COLORS.dark,
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
    },
});

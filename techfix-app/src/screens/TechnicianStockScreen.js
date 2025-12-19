import React, { useState, useEffect, useContext } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl, Alert, TextInput  
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import client, { API_ENDPOINTS } from '../api/client';
import { COLORS } from '../theme/colors';

export default function TechnicianStockScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { userToken } = useContext(AuthContext);
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    useEffect(() => {
        fetchMyStock();
    }, []);
    
    const fetchMyStock = async () => {
        try {
            const response = await client.get(API_ENDPOINTS.MY_STOCK);
            
            // Handle response format
            const stockData = response.data.data || response.data;
            setStock(Array.isArray(stockData) ? stockData : []);
        } catch (error) {
            console.error('Error fetching stock:', error);
            Alert.alert('Error', error.response?.data?.error || 'Failed to fetch your stock');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };
    
    const onRefresh = async () => {
        setRefreshing(true);
        await fetchMyStock();
    };
    
    // Filter stock based on search
    const filteredStock = stock.filter(item =>
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.spare_id?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCode}>{item.spare_id}</Text>
                </View>
                <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>{item.qty} units</Text>
                </View>
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
                <Text style={styles.headerTitle}>My Stock</Text>
                <Text style={styles.headerSubtitle}>
                    {filteredStock.length} items assigned
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
            
            <FlatList
                data={filteredStock}
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
                        <MaterialIcons name="inbox" size={40} color={COLORS.gray} />
                        <Text style={styles.emptyText}>No stock assigned yet</Text>
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
        borderLeftColor: COLORS.success,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
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
        backgroundColor: COLORS.success,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    qtyText: {
        color: COLORS.white,
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
    },
});

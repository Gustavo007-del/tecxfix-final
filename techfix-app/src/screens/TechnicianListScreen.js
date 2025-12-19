// E:\study\techfix\techfix-app\src\screens\TechnicianListScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '../api/client';
import { COLORS } from '../theme/colors';

export default function TechnicianListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      const response = await client.get('/technicians/');
      setTechnicians(response.data);
    } catch (error) {
      console.log('Error fetching technicians:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTechnicians();
    setRefreshing(false);
  };

  const renderTechnicianItem = ({ item }) => (
    <View style={styles.techCard}>
      <View style={styles.techHeader}>
        <MaterialIcons name="account-circle" size={40} color={COLORS.primary} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.techInfo}>
        <MaterialIcons name="phone" size={16} color={COLORS.primary} />
        <Text style={styles.detail}>{item.phone || 'No phone'}</Text>
      </View>
      <View style={styles.techInfo}>
        <MaterialIcons name="email" size={16} color={COLORS.primary} />
        <Text style={styles.detail}>{item.email || 'No email'}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Technicians</Text>
        <View style={styles.count}>
          <Text style={styles.countText}>{technicians.length}</Text>
        </View>
      </View>

      <FlatList
        data={technicians}
        renderItem={renderTechnicianItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="people-outline" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>No technicians found</Text>
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
    backgroundColor: COLORS.dark,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    flex: 1,
    marginLeft: 12,
  },
  count: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    color: COLORS.dark,
    fontWeight: 'bold',
    fontSize: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  techCard: {
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
  techHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  username: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: 12,
  },
  techInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detail: {
    fontSize: 12,
    color: COLORS.dark,
    marginLeft: 12,
    fontWeight: '500',
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
    fontWeight: '500',
  },
});

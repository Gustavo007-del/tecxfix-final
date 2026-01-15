import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '../api/client';
import { COLORS } from '../theme/colors';

export default function MemberLocationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await client.get('/tracking/admin/members/');
      if (response.data.success) {
        setMembers(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  const handleMemberPress = (member) => {
    try {
      navigation.navigate('MemberLocationMap', { member });
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const renderMemberItem = ({ item }) => (
    <TouchableOpacity
      style={styles.memberCard}
      onPress={() => handleMemberPress(item)}
    >
      <View style={styles.memberHeader}>
        <MaterialIcons name="person" size={40} color={COLORS.primary} />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.full_name || item.username}</Text>
          <Text style={styles.memberUsername}>@{item.username}</Text>
        </View>
        {item.active_session && (
          <View style={styles.activeBadge}>
            <MaterialIcons name="fiber-manual-record" size={12} color={COLORS.success} />
            <Text style={styles.activeText}>Active</Text>
          </View>
        )}
      </View>

      {item.last_location && (
        <View style={styles.locationInfo}>
          <MaterialIcons name="location-on" size={16} color={COLORS.gray} />
          <Text style={styles.locationText}>
            Last seen: {new Date(item.last_location.timestamp).toLocaleString('en-IN')}
          </Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.viewMapText}>View Location History</Text>
        <MaterialIcons name="arrow-forward" size={20} color={COLORS.primary} />
      </View>
    </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Member Locations</Text>
        <View style={styles.count}>
          <Text style={styles.countText}>{members.length}</Text>
        </View>
      </View>

      <FlatList
        data={members}
        renderItem={renderMemberItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="location-off" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>No members found</Text>
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
  },
  memberCard: {
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
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  memberUsername: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeText: {
    fontSize: 11,
    color: COLORS.success,
    marginLeft: 4,
    fontWeight: '600',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.gray,
    marginLeft: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  viewMapText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 12,
  },
});
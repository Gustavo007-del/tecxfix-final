import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { COLORS } from '../theme/colors';
import client from '../api/client';

const TechnicianProfileScreen = ({ navigation }) => {
  const { state, signOut } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    try {
      const response = await client.get('/profile/');
      setProfile(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await client.delete('/delete-account/');
              
              if (response.data.success) {
                Alert.alert(
                  'Account Deleted',
                  'Your account has been successfully deleted.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        signOut();
                      }
                    }
                  ]
                );
              }
            } catch (error) {
              const errorMessage = error.response?.data?.error || 'Failed to delete account';
              Alert.alert('Error', errorMessage);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerWithBack}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <MaterialIcons name="person" size={60} color={COLORS.white} />
        </View>
        <Text style={styles.name}>
          {profile?.first_name} {profile?.last_name}
        </Text>
        <Text style={styles.username}>@{profile?.username}</Text>
        <Text style={styles.role}>{profile?.role}</Text>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Profile Information</Text>
        
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialIcons name="email" size={20} color={COLORS.primary} />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile?.email || 'Not provided'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialIcons name="phone" size={20} color={COLORS.primary} />
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile?.phone || 'Not provided'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialIcons name="calendar-today" size={20} color={COLORS.primary} />
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>
              {profile?.date_joined ? new Date(profile.date_joined).toLocaleDateString() : 'Unknown'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <MaterialIcons name="delete-forever" size={20} color={COLORS.danger} />
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>TECHFIX v1.0.0</Text>
        <Text style={styles.footerText}>Field Service Management</Text>
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#f5f5f5',
  },
  headerWithBack: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.gray,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryDark || '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 5,
  },
  username: {
    fontSize: 16,
    color: COLORS.white,
    opacity: 0.8,
    marginBottom: 5,
  },
  role: {
    fontSize: 14,
    color: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  infoSection: {
    backgroundColor: COLORS.white,
    margin: 20,
    borderRadius: 10,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 10,
  },
  infoRow: {
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginLeft: 15,
    flex: 0,
    minWidth: 80,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.dark,
    marginLeft: 10,
    flex: 1,
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.danger,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    color: COLORS.danger,
    fontWeight: '600',
    marginLeft: 10,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 5,
  },
});

export default TechnicianProfileScreen;

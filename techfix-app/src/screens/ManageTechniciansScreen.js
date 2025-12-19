// E:\study\techfix\techfix-app\src\screens\ManageTechniciansScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { COLORS } from '../theme/colors';

export default function ManageTechniciansScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { state } = useContext(AuthContext);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      const response = await client.get('/technicians/');
      console.log('=== TECHNICIANS RESPONSE ===');
      console.log('Full response:', JSON.stringify(response.data, null, 2));
      console.log('First technician:', response.data[0]);
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

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
    });
    setModalVisible(true);
  };

  const openEditModal = async (techId) => {
    try {
      console.log(`Opening edit modal for techId: ${techId}`);
      const response = await client.get(`/technicians/${techId}/`);
      setEditingId(techId);
      setFormData({
        username: response.data.username,
        password: '',
        first_name: response.data.first_name,
        last_name: response.data.last_name,
        phone: response.data.phone || '',
      });
      setModalVisible(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to load technician details');
    }
  };

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name || !formData.phone) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    if (!editingId && !formData.username) {
      Alert.alert('Error', 'Username is required for new technicians');
      return;
    }

    if (!editingId && !formData.password) {
      Alert.alert('Error', 'Password is required for new technicians');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        // Update
        await client.put(`/technicians/${editingId}/update/`, {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          ...(formData.password && { password: formData.password }),
        });
        Alert.alert('Success', 'Technician updated successfully');
      } else {
        // Create
        await client.post('/technicians/create/', formData);
        Alert.alert('Success', 'Technician created successfully');
      }

      setModalVisible(false);
      await fetchTechnicians();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (techId, name) => {
    console.log('=== DELETE TECHNICIAN ===');
    console.log('Tech ID to delete:', techId);
    console.log('Tech name:', name);
    console.log('Type of techId:', typeof techId);
    
    Alert.alert('Delete Technician', `Delete ${name}?\n\nID: ${techId}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            console.log(`Deleting technician with ID: ${techId}`);
            const response = await client.delete(`/technicians/${techId}/delete/`);
            console.log('Delete response:', response.data);
            Alert.alert('Success', 'Technician deleted');
            await fetchTechnicians();
          } catch (error) {
            console.error('Delete error:', error.response?.data || error);
            Alert.alert('Error', error.response?.data?.error || 'Failed to delete technician');
          }
        },
      },
    ]);
  };

  const renderTechnicianItem = ({ item, index }) => {
    console.log(`Rendering tech at index ${index}: ID=${item.id}, Username=${item.username}`);
    
    return (
      <View style={styles.techCard}>
        <View style={styles.techHeader}>
          <MaterialIcons name="account-circle" size={40} color={COLORS.primary} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
            <Text style={styles.username}>@{item.username} (ID: {item.id})</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.techInfo}>
          <MaterialIcons name="phone" size={16} color={COLORS.primary} />
          <Text style={styles.detail}>{item.phone || 'No phone'}</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => openEditModal(item.id)}
          >
            <MaterialIcons name="edit" size={16} color={COLORS.white} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDelete(item.id, `${item.first_name} ${item.last_name}`)}
          >
            <MaterialIcons name="delete" size={16} color={COLORS.white} />
            <Text style={styles.actionBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
        <Text style={styles.headerTitle}>Manage Technicians</Text>
        <TouchableOpacity onPress={openAddModal}>
          <MaterialIcons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
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

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <MaterialIcons name="close" size={24} color={COLORS.dark} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingId ? 'Edit Technician' : 'Add Technician'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {!editingId && (
              <>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  value={formData.username}
                  onChangeText={(text) => setFormData({ ...formData, username: text })}
                  editable={!submitting}
                  autoCapitalize="none"
                />
              </>
            )}

            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="First name"
              value={formData.first_name}
              onChangeText={(text) => setFormData({ ...formData, first_name: text })}
              editable={!submitting}
            />

            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Last name"
              value={formData.last_name}
              onChangeText={(text) => setFormData({ ...formData, last_name: text })}
              editable={!submitting}
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              editable={!submitting}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>
              {editingId ? 'Password (leave blank to keep current)' : 'Password'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={editingId ? 'Leave blank to keep current' : 'Password'}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry
              editable={!submitting}
            />

            <TouchableOpacity
              style={[styles.saveButton, submitting && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="save" size={18} color={COLORS.white} />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
    textAlign: 'center',
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
    marginBottom: 12,
  },
  detail: {
    fontSize: 12,
    color: COLORS.dark,
    marginLeft: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    backgroundColor: COLORS.primary,
  },
  deleteBtn: {
    backgroundColor: COLORS.danger,
  },
  actionBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
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
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  modalHeader: {
    backgroundColor: COLORS.dark,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  modalContent: {
    padding: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.dark,
    backgroundColor: COLORS.white,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
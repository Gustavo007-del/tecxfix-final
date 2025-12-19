// E:\study\techfix\techfix-app\src\screens\RegisterTechnicianStockScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '../api/client';
import { COLORS } from '../theme/colors';

export default function RegisterTechnicianStockScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [existingStocks, setExistingStocks] = useState([]);
  
  // Form state
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [sheetTechnicianName, setSheetTechnicianName] = useState('');
  const [sheetId, setSheetId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await client.get('/register-technician-stock/');
      setUsers(response.data.users || []);
      setExistingStocks(response.data.existing_stocks || []);
    } catch (error) {
      console.log('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load technicians');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTechnician) {
      Alert.alert('Error', 'Please select a technician');
      return;
    }

    if (!sheetTechnicianName.trim()) {
      Alert.alert('Error', 'Please enter sheet technician name');
      return;
    }

    setSubmitting(true);
    try {
      const response = await client.post('/register-technician-stock/', {
        technician_id: selectedTechnician,
        sheet_technician_name: sheetTechnicianName.trim(),
        sheet_id: sheetId.trim() || null,
      });

      Alert.alert('Success', response.data.message, [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.log('Error submitting:', error);
      const errorMsg = error.response?.data?.error || 'Failed to register technician stock';
      Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getAvailableTechnicians = () => {
    const registeredIds = existingStocks.map(stock => stock.technician_id);
    return users.filter(user => !registeredIds.includes(user.id));
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

  const availableTechnicians = getAvailableTechnicians();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register Technician Stock</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <MaterialIcons name="info" size={24} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Register stock metadata for technicians. This links technician accounts to their Google
            Sheet stock records.
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Select Technician <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedTechnician}
                onValueChange={setSelectedTechnician}
                style={styles.picker}
              >
                <Picker.Item label="-- Select Technician --" value="" />
                {availableTechnicians.map(user => (
                  <Picker.Item
                    key={user.id}
                    label={`${user.username} (${user.first_name} ${user.last_name})`}
                    value={user.id}
                  />
                ))}
              </Picker>
            </View>
            {availableTechnicians.length === 0 && (
              <Text style={styles.helperText}>
                All technicians have been registered. No available technicians.
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Sheet Technician Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={sheetTechnicianName}
              onChangeText={setSheetTechnicianName}
              placeholder="e.g., amal, arun kakkodi"
              placeholderTextColor={COLORS.gray}
            />
            <Text style={styles.helperText}>
              Enter the name as it appears in Google Sheets
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Sheet ID (Optional)</Text>
            <TextInput
              style={styles.input}
              value={sheetId}
              onChangeText={setSheetId}
              placeholder="Google Sheet ID"
              placeholderTextColor={COLORS.gray}
            />
            <Text style={styles.helperText}>
              Optional: Google Sheet ID for this technician
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (submitting || !selectedTechnician || !sheetTechnicianName.trim()) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || !selectedTechnician || !sheetTechnicianName.trim()}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <MaterialIcons name="check" size={24} color={COLORS.white} />
                <Text style={styles.submitButtonText}>Register Stock</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {existingStocks.length > 0 && (
          <View style={styles.existingContainer}>
            <Text style={styles.sectionTitle}>Existing Registrations</Text>
            {existingStocks.map(stock => (
              <View key={stock.id} style={styles.stockCard}>
                <MaterialIcons name="person" size={24} color={COLORS.primary} />
                <View style={styles.stockInfo}>
                  <Text style={styles.stockUsername}>{stock.technician_username}</Text>
                  <Text style={styles.stockDetail}>
                    Sheet Name: {stock.sheet_technician_name || 'N/A'}
                  </Text>
                  {stock.sheet_id && (
                    <Text style={styles.stockDetail}>Sheet ID: {stock.sheet_id}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.dark,
    lineHeight: 20,
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 8,
  },
  required: {
    color: COLORS.error,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  picker: {
    height: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.dark,
    backgroundColor: COLORS.white,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.gray,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  existingContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 12,
  },
  stockCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: COLORS.light,
    borderRadius: 8,
    marginBottom: 8,
  },
  stockInfo: {
    flex: 1,
    marginLeft: 12,
  },
  stockUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 4,
  },
  stockDetail: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
});
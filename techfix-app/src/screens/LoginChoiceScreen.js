// E:\study\techfix\techfix-app\src\screens\LoginChoiceScreen.js
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';

export default function LoginChoiceScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>TEX FIX</Text>
        <Text style={styles.subtitle}>Attendance System</Text>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('TechnicianLogin')}
        >
          <MaterialIcons name="person" size={28} color={COLORS.dark} />
          <Text style={styles.buttonText}>Technician Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginButton, styles.adminButton]}
          onPress={() => navigation.navigate('AdminLogin')}
        >
          <MaterialIcons name="admin-panel-settings" size={28} color={COLORS.dark} />
          <Text style={styles.buttonText}>Admin Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 56,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.light,
    marginTop: 12,
    fontWeight: '500',
  },
  buttonsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  adminButton: {
    marginBottom: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginLeft: 16,
  },
});

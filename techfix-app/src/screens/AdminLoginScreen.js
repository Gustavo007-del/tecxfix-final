// E:\study\techfix\techfix-app\src\screens\AdminLoginScreen.js
import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme/colors';

export default function AdminLoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin@123');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { dispatch } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }

    console.log('Attempting to login with:', { username });
    setLoading(true);
    
    try {
      const response = await client.post('/login/admin/', {
        username,
        password,
      });

      console.log('Login response:', response.data);

      if (response.data && response.data.access) {
        const user = response.data.user || { username, role: 'admin' };
        const accessToken = response.data.access;
        const refreshToken = response.data.refresh;

        console.log('Login successful, saving tokens...');
        
        // Save tokens and user info
        await AsyncStorage.setItem('access_token', accessToken);
        await AsyncStorage.setItem('refresh_token', refreshToken || '');
        await AsyncStorage.setItem('userToken', accessToken);
        await AsyncStorage.setItem('role', user.role || 'admin');
        await AsyncStorage.setItem('user', JSON.stringify(user));

        console.log('Dispatching sign in...');
        dispatch({
          type: 'SIGN_IN',
          token: accessToken,
          role: user.role || 'admin',
          user,
        });
      } else {
        console.log('Unexpected response format:', response.data);
        Alert.alert(
          'Login Failed',
          'Unexpected response from server. Please try again.'
        );
      }
    } catch (error) {
      console.error('Login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      let errorMessage = 'Invalid credentials';
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Invalid username or password';
        } else if (error.response.data) {
          errorMessage = error.response.data.detail || 
                        error.response.data.error || 
                        JSON.stringify(error.response.data);
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      }
      
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>TEX FIX</Text>
          <Text style={styles.subtitle}>Admin Panel</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>Admin Login</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter admin username"
              placeholderTextColor={COLORS.gray}
              value={username}
              onChangeText={setUsername}
              editable={!loading}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter admin password"
                placeholderTextColor={COLORS.gray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={{ fontSize: 16 }}>{showPassword ? '👁' : '👁‍🗨'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color={COLORS.dark} size="small" />
                <Text style={styles.loginButtonText}>Logging in...</Text>
              </>
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
  scrollContent: {
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  logo: {
    fontSize: 44,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.light,
    marginTop: 8,
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 32,
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
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
    backgroundColor: COLORS.light,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    backgroundColor: COLORS.light,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.dark,
  },
  eyeIcon: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: COLORS.dark,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  backText: {
    color: COLORS.gray,
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  demoContainer: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  demoText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '600',
    marginBottom: 12,
  },
  credentialBox: {
    backgroundColor: COLORS.light,
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  demoCredentials: {
    fontSize: 12,
    color: COLORS.dark,
    marginVertical: 2,
    fontWeight: '500',
  },
});

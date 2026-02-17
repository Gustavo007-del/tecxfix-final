// E:\study\techfix\techfix-app\App.js
import React, { useEffect, useContext, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { COLORS } from './src/theme/colors';
import ErrorBoundary from './src/utils/ErrorBoundary';
import StockOutScreen from './src/screens/StockOutScreen';
import StockOrderedScreen from './src/screens/StockOrderedScreen';
import OrderHistoryScreen from './src/screens/OrderHistoryScreen';
import ReceivedHistoryScreen from './src/screens/ReceivedHistoryScreen';
import TechCourierScreen from './src/screens/TechCourierScreen';

// Auth Screens
import LoginChoiceScreen from './src/screens/LoginChoiceScreen';
import TechnicianLoginScreen from './src/screens/TechnicianLoginScreen';
import AdminLoginScreen from './src/screens/AdminLoginScreen';

// Technician Screens
import AttendanceScreen from './src/screens/AttendanceScreen';
import TechnicianStockScreen from './src/screens/TechnicianStockScreen';
import SparePendingScreen from './src/screens/SparePendingScreen';
import MyRequestsScreen from './src/screens/MyRequestsScreen';
import ReceiveCourierScreen from './src/screens/ReceiveCourierScreen';

// Admin Screens
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import CourierStockScreen from './src/screens/CourierStockScreen';
import CreateCourierScreen from './src/screens/CreateCourierScreen';
import CourierViewScreen from './src/screens/CourierViewScreen';
import AllCouriersScreen from './src/screens/AllCouriersScreen';
import TechnicianListScreen from './src/screens/TechnicianListScreen';
import ManageTechniciansScreen from './src/screens/ManageTechniciansScreen';
import AdminAttendanceRecordScreen from './src/screens/AdminAttendanceRecordScreen';
import AdminSpareApprovalsScreen from './src/screens/AdminSpareApprovalsScreen';
import AttendanceListScreen from './src/screens/AttendanceListScreen';
import RegisterTechnicianStockScreen from './src/screens/RegisterTechnicianStockScreen';
import MemberLocationsScreen from './src/screens/MemberLocationsScreen';
import MemberLocationMapScreen from './src/screens/MemberLocationMapScreen';
import LocationDisclosureScreen from './src/screens/LocationDisclosureScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ============================================
// TECHNICIAN NAVIGATION
// ============================================

function TechnicianNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'AttendanceStack') {
                        iconName = 'check-circle';
                    } else if (route.name === 'TechStockStack') {
                        iconName = 'inventory';
                    } else if (route.name === 'CouriersStack') {
                        iconName = 'add-shopping-cart';
                    } else if (route.name === 'ReceiveCourierStack') {
                        iconName = 'local-shipping';
                    } else if (route.name === 'RequestsStack') {
                        iconName = 'list';
                    }
                    return <MaterialIcons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.gray,
                tabBarStyle: {
                    backgroundColor: COLORS.white,
                    borderTopColor: COLORS.lightGray,
                    paddingBottom: 5,
                },
            })}
        >
            <Tab.Screen
                name="AttendanceStack"
                component={AttendanceScreenStack}
                options={{
                    tabBarLabel: 'Attendance',
                    tabBarLabelStyle: { fontSize: 11 },
                }}
            />
            <Tab.Screen
                name="TechStockStack"
                component={TechStockScreenStack}
                options={{
                    tabBarLabel: 'My Stock',
                    tabBarLabelStyle: { fontSize: 11 },
                }}
            />
            <Tab.Screen
                name="CouriersStack"
                component={CouriersScreenStack}
                options={{
                    tabBarLabel: 'complaints',
                    tabBarLabelStyle: { fontSize: 11 },
                }}
            />
            <Tab.Screen
                name="ReceiveCourierStack"
                component={ReceiveCourierScreenStack}
                options={{
                    tabBarLabel: 'Courier',
                    tabBarLabelStyle: { fontSize: 11 },
                }}
            />
            <Tab.Screen
                name="RequestsStack"
                component={RequestsScreenStack}
                options={{
                    tabBarLabel: 'Requests',
                    tabBarLabelStyle: { fontSize: 11 },
                }}
            />
            
        </Tab.Navigator>
    );
}

function AttendanceScreenStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AttendanceMain" component={AttendanceScreen} />
            <Stack.Screen
                name="CourierHistory"
                component={TechCourierScreen}
            />
            <Stack.Screen
                name="Profile"
                component={TechnicianProfileScreen}
            />
        </Stack.Navigator>
    );
}

function TechStockScreenStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="TechStockMain" component={TechnicianStockScreen} />
        </Stack.Navigator>
    );
}

function CouriersScreenStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="CouriersMain" component={SparePendingScreen} />
            <Stack.Screen name="CourierView" component={CourierViewScreen} />
            <Stack.Screen name="ReceiveCourier" component={ReceiveCourierScreen} />
        </Stack.Navigator>
    );
}

function ReceiveCourierScreenStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen 
                name="ReceiveCourierMain" 
                component={ReceiveCourierScreen} 
                initialParams={{ fromTab: true }} // Indicate this is from tab navigation
            />
            <Stack.Screen 
                name="ReceiveCourierDetails" 
                component={ReceiveCourierScreen}
                initialParams={{ fromTab: false }}
            />
        </Stack.Navigator>
    );
}

function RequestsScreenStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="RequestsMain" component={MyRequestsScreen} />
        </Stack.Navigator>
    );
}

// ============================================
// ADMIN NAVIGATION
// ============================================

function AdminNavigator() {
    const { state } = useContext(AuthContext);
    const isSpareAdmin = state?.user?.username === 'SpareAdmin';

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'DashboardStack') {
                        iconName = 'dashboard';
                    } else if (route.name === 'StockStack') {
                        iconName = 'inventory';
                    } else if (route.name === 'CourierStack') {
                        iconName = 'local-shipping';
                    } else if (route.name === 'SettingsStack') {
                        iconName = 'settings';
                    }
                    return <MaterialIcons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.gray,
                tabBarStyle: {
                    backgroundColor: COLORS.white,
                    borderTopColor: COLORS.lightGray,
                    paddingBottom: 5,
                },
            })}
        >
            <Tab.Screen
                name="DashboardStack"
                component={DashboardStackScreen}
                options={{
                    tabBarLabel: 'Dashboard',
                    tabBarLabelStyle: { fontSize: 11 },
                }}
            />
            <Tab.Screen
                name="StockStack"
                component={StockStackScreen}
                options={{
                    tabBarLabel: 'Stock',
                    tabBarLabelStyle: { fontSize: 11 },
                }}
            />
            <Tab.Screen
                name="CourierStack"
                component={CourierStackScreen}
                options={{
                    tabBarLabel: 'Courier',
                    tabBarLabelStyle: { fontSize: 11 },
                }}
            />
            {!isSpareAdmin && (
                <Tab.Screen
                    name="SettingsStack"
                    component={SettingsStackScreen}
                    options={{
                        tabBarLabel: 'Settings',
                        tabBarLabelStyle: { fontSize: 11 },
                    }}
                />
            )}
        </Tab.Navigator>
    );
}

function DashboardStackScreen() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AdminDashboardMain" component={AdminDashboardScreen} />
            <Stack.Screen name="AttendanceList" component={AttendanceListScreen} />
            <Stack.Screen name="AdminAttendanceRecordScreen" component={AdminAttendanceRecordScreen} />
            <Stack.Screen name="ManageTechnicians" component={ManageTechniciansScreen} />
            <Stack.Screen name="RegisterTechnicianStock" component={RegisterTechnicianStockScreen} />
            <Stack.Screen name="TechnicianList" component={TechnicianListScreen} />
            <Stack.Screen name="AdminSpareApprovalsScreen" component={AdminSpareApprovalsScreen} />
            <Stack.Screen name="CreateCourier" component={CreateCourierScreen} />
            <Stack.Screen name="CourierStock" component={CourierStockScreen} />
            <Stack.Screen name="AllCouriers" component={AllCouriersScreen} />
            <Stack.Screen name="CourierView" component={CourierViewScreen} />
            <Stack.Screen name="StockOut" component={StockOutScreen} />
            <Stack.Screen name="StockOrdered" component={StockOrderedScreen} />
            <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
            <Stack.Screen name="ReceivedHistory" component={ReceivedHistoryScreen} />
            <Stack.Screen name="MemberLocations" component={MemberLocationsScreen} />
            <Stack.Screen name="MemberLocationMap" component={MemberLocationMapScreen} />
        </Stack.Navigator>
    );
}

function StockStackScreen() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="CourierStockMain" component={CourierStockScreen} />
            <Stack.Screen name="AdminSpareApprovals" component={AdminSpareApprovalsScreen} />
        </Stack.Navigator>
    );
}

function CourierStackScreen() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="CreateCourierMain" component={CreateCourierScreen} />
            <Stack.Screen name="CourierView" component={CourierViewScreen} />
            <Stack.Screen name="AllCouriers" component={AllCouriersScreen} />
        </Stack.Navigator>
    );
}

function SettingsStackScreen() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="SettingsMain" component={ManageTechniciansScreen} />
            <Stack.Screen name="TechnicianList" component={TechnicianListScreen} />
        </Stack.Navigator>
    );
}

// ============================================
// AUTH NAVIGATION
// ============================================

function AuthNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="LoginChoice" component={LoginChoiceScreen} />
            <Stack.Screen name="TechnicianLogin" component={TechnicianLoginScreen} />
            <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
        </Stack.Navigator>
    );
}

// ============================================
// ROOT NAVIGATOR
// ============================================

function RootNavigator() {
    const { state } = useContext(AuthContext);

    if (state.isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer>
            {state.userToken == null ? (
                <AuthNavigator />
            ) : state.role === 'technician' ? (
                <TechnicianNavigator />
            ) : (
                <AdminNavigator />
            )}
        </NavigationContainer>
    );
}

// ============================================
// MAIN APP
// ============================================

function LocationPermissionScreen({ onRetry }) {
  return (
    <View style={styles.container}>
      <MaterialIcons name="location-off" size={64} color={COLORS.danger} />
      <Text style={styles.title}>Location Permission Required</Text>
      <Text style={styles.message}>
        TECHFIX requires location access for essential field service operations:
        
        • Verify attendance check-in/check-out with precise location
        • Enable continuous location tracking during work hours
        • Provide technician safety monitoring
        • Support real-time operational coordination
        
        Background location ensures accurate work records and technician safety.
      </Text>
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => {
          Linking.openSettings();
        }}
      >
        <Text style={styles.buttonText}>Open Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: COLORS.primary }]} 
        onPress={onRetry}
      >
        <Text style={styles.buttonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const [locationPermission, setLocationPermission] = useState(null);
  const [storagePermission, setStoragePermission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDisclosure, setShowDisclosure] = useState(true);

  const handleDisclosureAccept = async () => {
    setShowDisclosure(false);
    await checkPermissions();
  };

  const handleDisclosureDecline = () => {
    setShowDisclosure(false);
    checkPermissions(); // Still check permissions but user was informed
  };

  const checkPermissions = async () => {
    setLoading(true);
    try {
      // Check location permission
      const locationStatus = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(locationStatus.status === 'granted');
      
      // Check storage permission
      const mediaStatus = await MediaLibrary.requestPermissionsAsync();
      setStoragePermission(mediaStatus.status === 'granted');
      
      // If either permission is denied, show the permission screen
      if (locationStatus.status !== 'granted' || mediaStatus.status !== 'granted') {
        setLocationPermission(false);
        setStoragePermission(false);
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setLocationPermission(false);
      setStoragePermission(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Remove automatic permission check - let user see disclosure first
  }, []);

  // Show disclosure screen first
  if (showDisclosure) {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <LocationDisclosureScreen onAccept={handleDisclosureAccept} onDecline={handleDisclosureDecline} />
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  if (loading) {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  if (locationPermission === false || storagePermission === false) {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <LocationPermissionScreen onRetry={checkPermissions} />
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  // Only render the app if both permissions are granted
  if (locationPermission === true && storagePermission === true) {
    return (
      <ErrorBoundary>
        <AuthProvider>
          <SafeAreaProvider>
            <RootNavigator />
          </SafeAreaProvider>
        </AuthProvider>
      </ErrorBoundary>
    );
  }
  
  // Fallback in case of any unexpected state
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 20,
    textAlign: 'center',
    color: COLORS.dark,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: COLORS.gray,
    lineHeight: 24,
  },
  button: {
    backgroundColor: COLORS.danger,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
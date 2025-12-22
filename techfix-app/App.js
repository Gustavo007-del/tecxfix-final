// E:\study\techfix\techfix-app\App.js
import React, { useEffect, useContext } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { COLORS } from './src/theme/colors';
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
            <Tab.Screen
                name="SettingsStack"
                component={SettingsStackScreen}
                options={{
                    tabBarLabel: 'Settings',
                    tabBarLabelStyle: { fontSize: 11 },
                }}
            />
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

export default function App() {
    return (
        <AuthProvider>
            <RootNavigator />
        </AuthProvider>
    );
}
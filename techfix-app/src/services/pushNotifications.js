import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { API_ENDPOINTS } from '../api/client';

const PUSH_TOKEN_STORAGE_KEY = 'expo_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForCourierPushNotifications() {
  if (!Device.isDevice || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('couriers', {
      name: 'Courier updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E1A325',
      sound: 'default',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return null;

  const projectId =
    Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('Expo EAS project ID is missing from app configuration.');

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await client.post(API_ENDPOINTS.PUSH_DEVICE_TOKEN, {
    token,
    platform: Platform.OS,
  });
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  return token;
}

export async function unregisterCourierPushNotifications() {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;

  try {
    await client.delete(API_ENDPOINTS.PUSH_DEVICE_TOKEN, { data: { token } });
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }
}

export function isCourierPushNotification(response) {
  const data = response?.notification?.request?.content?.data;
  return data?.type === 'courier';
}

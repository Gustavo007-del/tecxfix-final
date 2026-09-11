import { Alert } from 'react-native';
import client from './client';

export async function syncTrackingSnapshot() {
  try {
    await client.post('/tracking/sync/');
    return true;
  } catch (error) {
    console.error('Tracking snapshot sync failed:', error);
    Alert.alert(
      'Tracking Refresh Failed',
      'Tracking data could not be updated. The latest available data will be shown.'
    );
    return false;
  }
}
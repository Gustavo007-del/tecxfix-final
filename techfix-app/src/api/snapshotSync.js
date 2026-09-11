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

export async function syncCompanyStockSnapshot() {
  try {
    const response = await client.post('/admin/sync-mrp-list/');
    return response.data.company_stock_rows;
  } catch (error) {
    console.error('Company stock snapshot sync failed:', error);
    Alert.alert(
      'Company Stock Refresh Failed',
      'The MRP List could not be updated. The latest available stock data will be shown.'
    );
    return null;
  }
}
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import client from '../api/client';

const LOCATION_TASK_NAME = 'background-location-task';
const TRACKING_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    return;
  }
  
  if (data) {
    try {
      const { locations } = data;
      if (locations && locations.length > 0) {
        const location = locations[0];
        
        // Send location to backend
        await client.post('/tracking/location/', {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        });
        
      }
    } catch (err) {
    }
  }
});

export const LocationTrackingService = {
  /**
   * Start location tracking
   */
  async startTracking() {
    try {
      // Check if already tracking
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTracking) {
        return { success: true, message: 'Already tracking' };
      }

      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        return { 
          success: false, 
          error: 'Foreground location permission not granted' 
        };
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
      }

      // Start tracking with 5-minute intervals
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: TRACKING_INTERVAL,
        distanceInterval: 0, // Update based on time only
        foregroundService: {
          notificationTitle: 'Location Tracking Active',
          notificationBody: 'Your location is being tracked for work purposes',
          notificationColor: '#4CAF50',
        },
        pausesUpdatesAutomatically: false,
      });

      return { success: true, message: 'Tracking started' };
    } catch (err) {
      return { 
        success: false, 
        error: err.message || 'Failed to start tracking' 
      };
    }
  },

  /**
   * Stop location tracking
   */
  async stopTracking() {
    try {
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!isTracking) {
        return { success: true, message: 'Not tracking' };
      }

      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      return { success: true, message: 'Tracking stopped' };
    } catch (err) {
      return { 
        success: false, 
        error: err.message || 'Failed to stop tracking' 
      };
    }
  },

  /**
   * Check if currently tracking
   */
  async isTracking() {
    try {
      return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch (err) {
      return false;
    }
  },

  /**
   * Send current location immediately
   */
  async sendCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await client.post('/tracking/location/', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
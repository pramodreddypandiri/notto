import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notificationService from './notificationService';
import { supabase } from '../config/supabase';

// Task names
const GEOFENCE_TASK = 'location-geofence-task';
const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Storage keys
const SAVED_LOCATIONS_KEY = '@saved_locations';
const LOCATION_SETTINGS_KEY = '@location_settings';
const LAST_DETECTED_STORE_KEY = '@last_detected_store';
const STORE_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown between same store notifications

// User's personal locations (manually added)
export type LocationType = 'home' | 'work' | 'gym';

export interface SavedLocation {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  createdAt: string;
}

export interface LocationSettings {
  enabled: boolean;
  smartFilteringEnabled: boolean; // Only notify when relevant pending items exist
  leaveHomeReminder: boolean; // "Don't forget!" reminder when leaving home
  autoDetectStores: boolean; // Automatically detect grocery stores, pharmacies, etc.
}

// Note categories that can be triggered by locations
export type NoteCategory =
  | 'shopping'
  | 'grocery'
  | 'pharmacy'
  | 'health'
  | 'errand'
  | 'work'
  | 'fitness'
  | 'general';

// Mapping of user's personal location types to relevant note categories
const LOCATION_TO_CATEGORIES: Record<LocationType, NoteCategory[]> = {
  home: [], // Home triggers "leaving" reminders, not category-based
  work: ['work'],
  gym: ['fitness'],
};

// Store chains by category for auto-detection
export const STORE_CHAINS: Record<NoteCategory, string[]> = {
  grocery: [
    'walmart', 'costco', 'kroger', 'target', 'safeway', 'whole foods',
    'trader joe', 'aldi', 'publix', 'wegmans', 'heb', 'meijer',
    'food lion', 'giant', 'stop & shop', 'albertsons', 'vons',
    'ralphs', 'fred meyer', 'winco', 'sprouts', 'market basket',
  ],
  pharmacy: [
    'cvs', 'walgreens', 'rite aid', 'pharmacy', 'drugstore',
    'duane reade', 'kinney drugs',
  ],
  shopping: [
    'mall', 'outlet', 'shopping center', 'department store',
    'best buy', 'home depot', 'lowes', 'ikea', 'bed bath',
  ],
  health: ['hospital', 'clinic', 'doctor', 'medical center', 'urgent care'],
  fitness: ['gym', 'fitness', 'ymca', 'planet fitness', '24 hour fitness', 'la fitness'],
  work: ['office', 'workplace'],
  errand: ['post office', 'bank', 'dry cleaner', 'auto shop'],
  general: [],
};

class LocationService {
  private isInitialized = false;
  private static instance: LocationService;

  /**
   * Initialize the location service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    LocationService.instance = this;

    // Define the geofencing task for user's personal locations (home, work, gym)
    if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
      TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
        if (error) {
          console.error('[Geofence] Task error:', error);
          return;
        }

        const { eventType, region } = data as {
          eventType: Location.GeofencingEventType;
          region: Location.LocationRegion;
        };

        console.log('[Geofence] Event:', eventType, 'Region:', region.identifier);

        await LocationService.instance.handleGeofenceEvent(eventType, region);
      });
    }

    // Define background location task for automatic store detection
    if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
      TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
        if (error) {
          console.error('[BackgroundLocation] Task error:', error);
          return;
        }

        const { locations } = data as { locations: Location.LocationObject[] };
        if (locations && locations.length > 0) {
          const latestLocation = locations[locations.length - 1];
          await LocationService.instance.handleLocationUpdate(latestLocation);
        }
      });
    }

    this.isInitialized = true;
    console.log('[LocationService] Initialized');
  }

  /**
   * Check if running in Expo Go (which doesn't support background location)
   */
  isExpoGo(): boolean {
    // @ts-ignore - Constants.expoConfig exists in Expo
    const Constants = require('expo-constants').default;
    return Constants.appOwnership === 'expo';
  }

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // First request foreground permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.warn('[LocationService] Foreground permission denied');
        return false;
      }

      // Skip background permission request in Expo Go (not supported)
      if (this.isExpoGo()) {
        console.warn('[LocationService] Running in Expo Go - background location not supported');
        return true; // Return true since foreground works
      }

      // Then request background permission for geofencing
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('[LocationService] Background permission denied - geofencing may not work');
        // Still return true as foreground is granted
      }

      return true;
    } catch (error: any) {
      // Handle Expo Go limitation error
      if (error?.message?.includes('NSLocation') || error?.message?.includes('Info.plist')) {
        console.warn('[LocationService] Running in Expo Go - background location requires a development build');
        return false;
      }
      console.error('[LocationService] Permission request error:', error);
      return false;
    }
  }

  /**
   * Check if location permissions are granted
   */
  async hasPermissions(): Promise<{ foreground: boolean; background: boolean }> {
    const { status: foreground } = await Location.getForegroundPermissionsAsync();
    const { status: background } = await Location.getBackgroundPermissionsAsync();
    return {
      foreground: foreground === 'granted',
      background: background === 'granted',
    };
  }

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch (error) {
      console.error('[LocationService] Get current location error:', error);
      return null;
    }
  }

  /**
   * Save a location
   */
  async saveLocation(location: Omit<SavedLocation, 'id' | 'createdAt'>): Promise<SavedLocation> {
    const newLocation: SavedLocation = {
      ...location,
      id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    const locations = await this.getSavedLocations();
    locations.push(newLocation);
    await AsyncStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations));

    // Start geofencing for this location
    await this.updateGeofencing();

    return newLocation;
  }

  /**
   * Get all saved locations
   */
  async getSavedLocations(): Promise<SavedLocation[]> {
    try {
      const data = await AsyncStorage.getItem(SAVED_LOCATIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[LocationService] Get saved locations error:', error);
      return [];
    }
  }

  /**
   * Delete a saved location
   */
  async deleteLocation(locationId: string): Promise<void> {
    const locations = await this.getSavedLocations();
    const filtered = locations.filter(loc => loc.id !== locationId);
    await AsyncStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(filtered));
    await this.updateGeofencing();
  }

  /**
   * Update a saved location
   */
  async updateLocation(locationId: string, updates: Partial<SavedLocation>): Promise<void> {
    const locations = await this.getSavedLocations();
    const index = locations.findIndex(loc => loc.id === locationId);
    if (index !== -1) {
      locations[index] = { ...locations[index], ...updates };
      await AsyncStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations));
      await this.updateGeofencing();
    }
  }

  /**
   * Get location settings
   */
  async getSettings(): Promise<LocationSettings> {
    try {
      const data = await AsyncStorage.getItem(LOCATION_SETTINGS_KEY);
      return data ? JSON.parse(data) : {
        enabled: false,
        smartFilteringEnabled: true,
        leaveHomeReminder: true,
        autoDetectStores: true,
      };
    } catch (error) {
      return {
        enabled: false,
        smartFilteringEnabled: true,
        leaveHomeReminder: true,
        autoDetectStores: true,
      };
    }
  }

  /**
   * Update location settings
   */
  async updateSettings(settings: Partial<LocationSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(LOCATION_SETTINGS_KEY, JSON.stringify(updated));

    if (updated.enabled) {
      await this.updateGeofencing();
      if (updated.autoDetectStores) {
        await this.startBackgroundLocationMonitoring();
      } else {
        await this.stopBackgroundLocationMonitoring();
      }
    } else {
      await this.stopGeofencing();
      await this.stopBackgroundLocationMonitoring();
    }
  }

  /**
   * Start/update geofencing for all saved locations
   */
  async updateGeofencing(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled) {
      console.log('[LocationService] Geofencing disabled');
      return;
    }

    const permissions = await this.hasPermissions();
    if (!permissions.background) {
      console.warn('[LocationService] Background permission required for geofencing');
      return;
    }

    const locations = await this.getSavedLocations();
    if (locations.length === 0) {
      console.log('[LocationService] No locations to monitor');
      return;
    }

    const regions: Location.LocationRegion[] = locations.map(loc => ({
      identifier: loc.id,
      latitude: loc.latitude,
      longitude: loc.longitude,
      radius: loc.radius,
      notifyOnEnter: loc.notifyOnEnter,
      notifyOnExit: loc.notifyOnExit,
    }));

    try {
      await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
      console.log(`[LocationService] Geofencing started for ${regions.length} locations`);
    } catch (error) {
      console.error('[LocationService] Start geofencing error:', error);
    }
  }

  /**
   * Stop all geofencing
   */
  async stopGeofencing(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
      if (isRegistered) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
        console.log('[LocationService] Geofencing stopped');
      }
    } catch (error) {
      console.error('[LocationService] Stop geofencing error:', error);
    }
  }

  /**
   * Handle geofence events (enter/exit)
   */
  private async handleGeofenceEvent(
    eventType: Location.GeofencingEventType,
    region: Location.LocationRegion
  ): Promise<void> {
    const settings = await this.getSettings();
    const locations = await this.getSavedLocations();
    const location = locations.find(loc => loc.id === region.identifier);

    if (!location) {
      console.warn('[Geofence] Unknown location:', region.identifier);
      return;
    }

    console.log(`[Geofence] ${eventType === Location.GeofencingEventType.Enter ? 'Entered' : 'Exited'} ${location.name}`);

    if (eventType === Location.GeofencingEventType.Exit && location.type === 'home') {
      // Leaving home - check for pending items
      await this.handleLeavingHome(settings);
    } else if (eventType === Location.GeofencingEventType.Enter) {
      // Arriving at a location - show relevant notes
      await this.handleArrivingAtLocation(location, settings);
    }
  }

  /**
   * Handle leaving home - show "Don't forget!" notification with pending items
   */
  private async handleLeavingHome(settings: LocationSettings): Promise<void> {
    if (!settings.leaveHomeReminder) return;

    // Get pending location-based notes
    const pendingNotes = await this.getPendingLocationNotes();

    if (pendingNotes.length === 0 && settings.smartFilteringEnabled) {
      // No pending items, don't notify
      console.log('[Geofence] No pending items, skipping leave-home notification');
      return;
    }

    let notificationBody = "Hope you got everything!";

    if (pendingNotes.length > 0) {
      const itemCount = pendingNotes.length;
      const previewItems = pendingNotes
        .slice(0, 3)
        .map(n => n.parsed_data?.summary || n.transcript.substring(0, 30))
        .join(', ');

      notificationBody = `You have ${itemCount} item${itemCount > 1 ? 's' : ''}: ${previewItems}${itemCount > 3 ? '...' : ''}`;
    }

    await notificationService.scheduleNotification(
      '🏠 Leaving Home',
      notificationBody,
      new Date(Date.now() + 1000) // Immediate
    );
  }

  /**
   * Handle arriving at a location - show relevant notes
   */
  private async handleArrivingAtLocation(
    location: SavedLocation,
    settings: LocationSettings
  ): Promise<void> {
    // Get relevant note categories for this location type
    const relevantCategories = LOCATION_TO_CATEGORIES[location.type] || [];

    if (relevantCategories.length === 0) {
      return;
    }

    // Get notes matching these categories
    const relevantNotes = await this.getNotesForCategories(relevantCategories);

    if (relevantNotes.length === 0 && settings.smartFilteringEnabled) {
      console.log(`[Geofence] No relevant notes for ${location.name}`);
      return;
    }

    if (relevantNotes.length > 0) {
      const itemCount = relevantNotes.length;
      const previewItems = relevantNotes
        .slice(0, 3)
        .map(n => n.parsed_data?.summary || n.transcript.substring(0, 30))
        .join(', ');

      await notificationService.scheduleNotification(
        `📍 Near ${location.name}`,
        `${itemCount} item${itemCount > 1 ? 's' : ''}: ${previewItems}${itemCount > 3 ? '...' : ''}`,
        new Date(Date.now() + 1000)
      );
    }
  }

  /**
   * Get all pending notes that have location triggers
   * Only returns notes with a location_category (not time-based reminders)
   */
  private async getPendingLocationNotes(): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .not('location_category', 'is', null)
        .eq('location_completed', false)
        .or('is_reminder.is.null,is_reminder.eq.false') // Exclude time-based reminders
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[LocationService] Get pending notes error:', error);
      return [];
    }
  }

  /**
   * Get notes for specific categories
   * Only returns location-relevant notes (not time-based reminders)
   */
  private async getNotesForCategories(
    categories: NoteCategory[]
  ): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('location_completed', false)
        .or('is_reminder.is.null,is_reminder.eq.false') // Exclude time-based reminders
        .order('created_at', { ascending: false });

      if (categories.length > 0) {
        query = query.in('location_category', categories);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[LocationService] Get notes for categories error:', error);
      return [];
    }
  }

  /**
   * Mark a note as completed (for location-based notes)
   */
  async markNoteLocationCompleted(noteId: string): Promise<void> {
    try {
      await supabase
        .from('notes')
        .update({ location_completed: true })
        .eq('id', noteId);
    } catch (error) {
      console.error('[LocationService] Mark note completed error:', error);
    }
  }

  /**
   * Detect location category from address/name (for auto-categorization)
   */
  detectLocationCategory(name: string, address: string): NoteCategory | null {
    const searchText = `${name} ${address}`.toLowerCase();

    for (const [category, chains] of Object.entries(STORE_CHAINS)) {
      if (chains.some(chain => searchText.includes(chain))) {
        return category as NoteCategory;
      }
    }

    return null;
  }

  /**
   * Search for places using address (uses device geocoding)
   */
  async searchAddress(query: string): Promise<Location.LocationGeocodedAddress[]> {
    try {
      const results = await Location.geocodeAsync(query);
      return results.map((result, index) => ({
        ...result,
        name: query,
        formattedAddress: query,
      })) as any;
    } catch (error) {
      console.error('[LocationService] Geocode error:', error);
      return [];
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<Location.LocationGeocodedAddress | null> {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      return results[0] || null;
    } catch (error) {
      console.error('[LocationService] Reverse geocode error:', error);
      return null;
    }
  }

  // ===== AUTOMATIC STORE DETECTION =====

  /**
   * Start background location monitoring for automatic store detection
   */
  async startBackgroundLocationMonitoring(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.autoDetectStores) {
      console.log('[LocationService] Auto store detection disabled');
      return;
    }

    const permissions = await this.hasPermissions();
    if (!permissions.background) {
      console.warn('[LocationService] Background permission required for store detection');
      return;
    }

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (isRegistered) {
        console.log('[LocationService] Background location already running');
        return;
      }

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5 * 60 * 1000, // Every 5 minutes
        distanceInterval: 100, // Or every 100 meters
        deferredUpdatesInterval: 5 * 60 * 1000,
        showsBackgroundLocationIndicator: false,
        foregroundService: {
          notificationTitle: 'Location Reminders Active',
          notificationBody: 'Monitoring for nearby stores',
          notificationColor: '#4A90A4',
        },
      });
      console.log('[LocationService] Background location monitoring started');
    } catch (error) {
      console.error('[LocationService] Start background location error:', error);
    }
  }

  /**
   * Stop background location monitoring
   */
  async stopBackgroundLocationMonitoring(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('[LocationService] Background location monitoring stopped');
      }
    } catch (error) {
      console.error('[LocationService] Stop background location error:', error);
    }
  }

  /**
   * Handle location updates from background monitoring
   * Uses reverse geocoding to detect if user is near a store
   */
  async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.autoDetectStores) return;

    const { latitude, longitude } = location.coords;

    try {
      // Reverse geocode to get place information
      const address = await this.reverseGeocode(latitude, longitude);
      if (!address) return;

      // Build a search string from address components
      const searchText = [
        address.name,
        address.street,
        address.city,
        address.region,
      ].filter(Boolean).join(' ').toLowerCase();

      console.log('[LocationService] Checking location:', searchText);

      // Detect store category from the address
      const detectedCategory = this.detectStoreCategoryFromAddress(searchText);
      if (!detectedCategory) return;

      // Check cooldown to avoid spamming notifications
      const canNotify = await this.checkNotificationCooldown(detectedCategory, latitude, longitude);
      if (!canNotify) {
        console.log(`[LocationService] Cooldown active for ${detectedCategory}`);
        return;
      }

      // Get relevant notes for this category
      const relevantNotes = await this.getNotesForCategories([detectedCategory]);

      if (relevantNotes.length === 0 && settings.smartFilteringEnabled) {
        console.log(`[LocationService] No relevant notes for ${detectedCategory}`);
        return;
      }

      if (relevantNotes.length > 0) {
        // Save this detection to prevent repeat notifications
        await this.saveLastDetection(detectedCategory, latitude, longitude);

        const storeName = this.getStoreNameFromAddress(searchText);
        const itemCount = relevantNotes.length;
        const previewItems = relevantNotes
          .slice(0, 3)
          .map(n => n.parsed_data?.summary || n.transcript.substring(0, 30))
          .join(', ');

        const emoji = this.getCategoryEmoji(detectedCategory);
        await notificationService.scheduleNotification(
          `${emoji} Near ${storeName}`,
          `${itemCount} item${itemCount > 1 ? 's' : ''}: ${previewItems}${itemCount > 3 ? '...' : ''}`,
          new Date(Date.now() + 1000)
        );

        console.log(`[LocationService] Sent notification for ${detectedCategory} at ${storeName}`);
      }
    } catch (error) {
      console.error('[LocationService] Handle location update error:', error);
    }
  }

  /**
   * Detect store category from address text
   */
  private detectStoreCategoryFromAddress(addressText: string): NoteCategory | null {
    const lower = addressText.toLowerCase();

    // Check each category's store chains
    for (const [category, chains] of Object.entries(STORE_CHAINS)) {
      if (chains.some(chain => lower.includes(chain))) {
        return category as NoteCategory;
      }
    }

    return null;
  }

  /**
   * Get a friendly store name from address
   */
  private getStoreNameFromAddress(addressText: string): string {
    const lower = addressText.toLowerCase();

    // Try to match known store names
    const allStores = Object.values(STORE_CHAINS).flat();
    for (const store of allStores) {
      if (lower.includes(store)) {
        // Capitalize first letter of each word
        return store.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }

    return 'a store';
  }

  /**
   * Get emoji for category
   */
  private getCategoryEmoji(category: NoteCategory): string {
    const emojis: Record<NoteCategory, string> = {
      grocery: '🛒',
      shopping: '🛍️',
      pharmacy: '💊',
      health: '🏥',
      fitness: '💪',
      work: '💼',
      errand: '📬',
      general: '📍',
    };
    return emojis[category] || '📍';
  }

  /**
   * Check if we can send a notification (cooldown logic)
   */
  private async checkNotificationCooldown(
    category: NoteCategory,
    latitude: number,
    longitude: number
  ): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(LAST_DETECTED_STORE_KEY);
      if (!data) return true;

      const lastDetection = JSON.parse(data);
      const now = Date.now();

      // Check if same category and within cooldown period
      if (lastDetection.category === category) {
        const timeSinceLastDetection = now - lastDetection.timestamp;
        if (timeSinceLastDetection < STORE_COOLDOWN_MS) {
          // Also check if we're still in roughly the same location (within 500m)
          const distance = this.calculateDistance(
            latitude,
            longitude,
            lastDetection.latitude,
            lastDetection.longitude
          );
          if (distance < 500) {
            return false; // Still at same store, don't notify again
          }
        }
      }

      return true;
    } catch (error) {
      return true; // If error, allow notification
    }
  }

  /**
   * Save last store detection
   */
  private async saveLastDetection(
    category: NoteCategory,
    latitude: number,
    longitude: number
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_DETECTED_STORE_KEY, JSON.stringify({
        category,
        latitude,
        longitude,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('[LocationService] Save detection error:', error);
    }
  }

  /**
   * Calculate distance between two coordinates in meters (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export default new LocationService();

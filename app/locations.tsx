/**
 * Locations Screen - Manage saved locations for location-based reminders
 *
 * Features:
 * - Add/edit/delete saved locations (home, work, gym, grocery stores, pharmacy)
 * - Enable/disable location-based reminders
 * - Configure "leaving home" reminders
 * - Search for addresses
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  TextInput,
  Modal,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';

// Theme
import { colors, typography, spacing, borderRadius, shadows, layout, getThemedColors } from '../theme';

// Components
import AnimatedPressable from '../components/ui/AnimatedPressable';
import PremiumButton from '../components/ui/PremiumButton';

// Services
import locationService, {
  SavedLocation,
  LocationType,
  LocationSettings,
} from '../services/locationService';
import {
  autocompleteAddress,
  getPlaceDetailsById,
  AddressSuggestion,
} from '../services/googlePlacesService';

// Context
import { useTheme } from '../context/ThemeContext';

// Location type options (user's personal locations only)
// Stores like Walmart, Costco, CVS are detected automatically
const LOCATION_TYPES: { type: LocationType; label: string; icon: string }[] = [
  { type: 'home', label: 'Home', icon: 'home' },
  { type: 'work', label: 'Work', icon: 'briefcase' },
  { type: 'gym', label: 'Gym', icon: 'fitness' },
];

export default function LocationsScreen() {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [settings, setSettings] = useState<LocationSettings>({
    enabled: false,
    smartFilteringEnabled: true,
    leaveHomeReminder: true,
    autoDetectStores: true,
  });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);

  // Theme
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await locationService.initialize();
      const [savedLocations, savedSettings] = await Promise.all([
        locationService.getSavedLocations(),
        locationService.getSettings(),
      ]);
      setLocations(savedLocations);
      setSettings(savedSettings);
    } catch (error) {
      console.error('Failed to load location data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (value) {
      // Check if running in Expo Go
      if (locationService.isExpoGo()) {
        Alert.alert(
          'Development Build Required',
          'Background location features require a development build. In Expo Go, only foreground location works.\n\nTo enable full location reminders, run:\nnpx expo run:ios',
          [{ text: 'OK' }]
        );
        // Still allow enabling for foreground features
      }

      // Request permissions when enabling
      const granted = await locationService.requestPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Location permission is required for location-based reminders. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    setSettings(prev => ({ ...prev, enabled: value }));
    await locationService.updateSettings({ enabled: value });
  };

  const handleToggleSmartFiltering = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings(prev => ({ ...prev, smartFilteringEnabled: value }));
    await locationService.updateSettings({ smartFilteringEnabled: value });
  };

  const handleToggleLeaveHome = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings(prev => ({ ...prev, leaveHomeReminder: value }));
    await locationService.updateSettings({ leaveHomeReminder: value });
  };

  const handleToggleAutoDetect = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings(prev => ({ ...prev, autoDetectStores: value }));
    await locationService.updateSettings({ autoDetectStores: value });
  };

  const handleDeleteLocation = (location: SavedLocation) => {
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${location.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await locationService.deleteLocation(location.id);
            setLocations(prev => prev.filter(l => l.id !== location.id));
          },
        },
      ]
    );
  };

  const handleSaveLocation = async (locationData: Omit<SavedLocation, 'id' | 'createdAt'>) => {
    try {
      if (editingLocation) {
        // Update existing
        await locationService.updateLocation(editingLocation.id, locationData);
        setLocations(prev =>
          prev.map(l =>
            l.id === editingLocation.id ? { ...l, ...locationData } : l
          )
        );
      } else {
        // Add new
        const newLocation = await locationService.saveLocation(locationData);
        setLocations(prev => [...prev, newLocation]);
      }
      setShowAddModal(false);
      setEditingLocation(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save location:', error);
      Alert.alert('Error', 'Failed to save location');
    }
  };

  const hasHomeLocation = locations.some(l => l.type === 'home');

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={colors.gradients.primary as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={styles.backButton}
            hapticType="light"
          >
            <Ionicons name="arrow-back" size={24} color={colors.neutral[0]} />
          </AnimatedPressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Location Reminders</Text>
            <Text style={styles.subtitle}>Get notified at the right place</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>This feature might be inconsistent</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Enable/Disable Section */}
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={styles.section}
          >
            <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
              <View style={styles.settingsRow}>
                <View style={styles.settingsRowIcon}>
                  <Ionicons name="location" size={22} color={colors.primary[500]} />
                </View>
                <View style={styles.settingsRowContent}>
                  <Text style={[styles.settingsRowTitle, { color: themedColors.text.primary }]}>
                    Location Reminders
                  </Text>
                  <Text style={[styles.settingsRowDescription, { color: themedColors.text.tertiary }]}>
                    Get notified when you arrive at or leave saved locations
                  </Text>
                </View>
                <Switch
                  value={settings.enabled}
                  onValueChange={handleToggleEnabled}
                  trackColor={{
                    false: colors.neutral[200],
                    true: colors.primary[400],
                  }}
                  thumbColor={colors.neutral[0]}
                />
              </View>

              {settings.enabled && (
                <>
                  <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowIcon}>
                      <Ionicons name="storefront" size={22} color={colors.primary[500]} />
                    </View>
                    <View style={styles.settingsRowContent}>
                      <Text style={[styles.settingsRowTitle, { color: themedColors.text.primary }]}>
                        Auto-Detect Stores
                      </Text>
                      <Text style={[styles.settingsRowDescription, { color: themedColors.text.tertiary }]}>
                        Notify at Walmart, Costco, CVS, and other stores automatically
                      </Text>
                    </View>
                    <Switch
                      value={settings.autoDetectStores}
                      onValueChange={handleToggleAutoDetect}
                      trackColor={{
                        false: colors.neutral[200],
                        true: colors.primary[400],
                      }}
                      thumbColor={colors.neutral[0]}
                    />
                  </View>

                  <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowIcon}>
                      <Ionicons name="filter" size={22} color={colors.primary[500]} />
                    </View>
                    <View style={styles.settingsRowContent}>
                      <Text style={[styles.settingsRowTitle, { color: themedColors.text.primary }]}>
                        Smart Filtering
                      </Text>
                      <Text style={[styles.settingsRowDescription, { color: themedColors.text.tertiary }]}>
                        Only notify when you have relevant pending items
                      </Text>
                    </View>
                    <Switch
                      value={settings.smartFilteringEnabled}
                      onValueChange={handleToggleSmartFiltering}
                      trackColor={{
                        false: colors.neutral[200],
                        true: colors.primary[400],
                      }}
                      thumbColor={colors.neutral[0]}
                    />
                  </View>

                  {hasHomeLocation && (
                    <>
                      <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

                      <View style={styles.settingsRow}>
                        <View style={styles.settingsRowIcon}>
                          <Ionicons name="home" size={22} color={colors.primary[500]} />
                        </View>
                        <View style={styles.settingsRowContent}>
                          <Text style={[styles.settingsRowTitle, { color: themedColors.text.primary }]}>
                            Leaving Home Reminder
                          </Text>
                          <Text style={[styles.settingsRowDescription, { color: themedColors.text.tertiary }]}>
                            "Hope you got everything!" when leaving home
                          </Text>
                        </View>
                        <Switch
                          value={settings.leaveHomeReminder}
                          onValueChange={handleToggleLeaveHome}
                          trackColor={{
                            false: colors.neutral[200],
                            true: colors.primary[400],
                          }}
                          thumbColor={colors.neutral[0]}
                        />
                      </View>
                    </>
                  )}
                </>
              )}
            </View>
          </Animated.View>

          {/* Saved Locations Section */}
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>
                Saved Locations
              </Text>
              <AnimatedPressable
                onPress={() => {
                  setEditingLocation(null);
                  setShowAddModal(true);
                }}
                style={[styles.addButton, { backgroundColor: colors.primary[500] }]}
                hapticType="light"
              >
                <Ionicons name="add" size={20} color={colors.neutral[0]} />
              </AnimatedPressable>
            </View>

            {locations.length === 0 ? (
              <View style={[styles.emptyCard, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
                <Ionicons name="location-outline" size={48} color={themedColors.text.muted} />
                <Text style={[styles.emptyTitle, { color: themedColors.text.primary }]}>
                  No personal locations saved
                </Text>
                <Text style={[styles.emptyDescription, { color: themedColors.text.tertiary }]}>
                  Add your home to get "Don't forget!" reminders when leaving. Stores like Walmart, Costco, and CVS are detected automatically.
                </Text>
                <PremiumButton
                  onPress={() => {
                    setEditingLocation(null);
                    setShowAddModal(true);
                  }}
                  icon={<Ionicons name="add" size={18} color={colors.neutral[0]} />}
                >
                  Add Home Location
                </PremiumButton>
              </View>
            ) : (
              <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
                {locations.map((location, index) => (
                  <React.Fragment key={location.id}>
                    {index > 0 && (
                      <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />
                    )}
                    <LocationRow
                      location={location}
                      themedColors={themedColors}
                      onEdit={() => {
                        setEditingLocation(location);
                        setShowAddModal(true);
                      }}
                      onDelete={() => handleDeleteLocation(location)}
                    />
                  </React.Fragment>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Info Section */}
          <Animated.View
            entering={FadeInDown.delay(300).springify()}
            style={styles.section}
          >
            <View style={[styles.infoCard, { backgroundColor: colors.primary[50] }]}>
              <Ionicons name="information-circle" size={24} color={colors.primary[500]} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: colors.primary[700] }]}>
                  How it works
                </Text>
                <Text style={[styles.infoText, { color: colors.primary[600] }]}>
                  • Voice notes like "I'm out of milk" trigger at grocery stores{'\n'}
                  • "Need cold medicine" triggers at pharmacies like CVS{'\n'}
                  • Stores (Walmart, Costco, Kroger, etc.) are detected automatically{'\n'}
                  • Add your home to get "Don't forget!" reminders when leaving
                </Text>
              </View>
            </View>
          </Animated.View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Add/Edit Location Modal */}
      <AddLocationModal
        visible={showAddModal}
        location={editingLocation}
        onClose={() => {
          setShowAddModal(false);
          setEditingLocation(null);
        }}
        onSave={handleSaveLocation}
        themedColors={themedColors}
      />
    </View>
  );
}

// Location Row Component
function LocationRow({
  location,
  themedColors,
  onEdit,
  onDelete,
}: {
  location: SavedLocation;
  themedColors: ReturnType<typeof getThemedColors>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeInfo = LOCATION_TYPES.find(t => t.type === location.type) || LOCATION_TYPES[0];

  return (
    <View style={styles.locationRow}>
      <View style={[styles.locationIcon, { backgroundColor: colors.primary[50] }]}>
        <Ionicons name={typeInfo.icon as any} size={22} color={colors.primary[500]} />
      </View>
      <View style={styles.locationContent}>
        <Text style={[styles.locationName, { color: themedColors.text.primary }]}>
          {location.name}
        </Text>
        <Text style={[styles.locationAddress, { color: themedColors.text.tertiary }]} numberOfLines={1}>
          {location.address}
        </Text>
        <View style={styles.locationBadges}>
          {location.notifyOnEnter && (
            <View style={[styles.badge, { backgroundColor: colors.accent.emerald.light }]}>
              <Text style={[styles.badgeText, { color: colors.accent.emerald.dark }]}>
                On arrival
              </Text>
            </View>
          )}
          {location.notifyOnExit && (
            <View style={[styles.badge, { backgroundColor: colors.accent.amber.light }]}>
              <Text style={[styles.badgeText, { color: colors.accent.amber.dark }]}>
                On leaving
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.locationActions}>
        <AnimatedPressable onPress={onEdit} style={styles.actionButton} hapticType="light">
          <Ionicons name="pencil" size={18} color={themedColors.text.tertiary} />
        </AnimatedPressable>
        <AnimatedPressable onPress={onDelete} style={styles.actionButton} hapticType="light">
          <Ionicons name="trash" size={18} color={colors.semantic.error} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

// Add/Edit Location Modal
function AddLocationModal({
  visible,
  location,
  onClose,
  onSave,
  themedColors,
}: {
  visible: boolean;
  location: SavedLocation | null;
  onClose: () => void;
  onSave: (data: Omit<SavedLocation, 'id' | 'createdAt'>) => void;
  themedColors: ReturnType<typeof getThemedColors>;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<LocationType>('home');
  const [notifyOnEnter, setNotifyOnEnter] = useState(true);
  const [notifyOnExit, setNotifyOnExit] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [coordinates, setCoordinates] = useState({ lat: 0, lng: 0 });
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when modal opens/closes or location changes
  useEffect(() => {
    if (visible) {
      if (location) {
        setName(location.name);
        setAddress(location.address);
        setType(location.type);
        setNotifyOnEnter(location.notifyOnEnter);
        setNotifyOnExit(location.notifyOnExit);
        setCoordinates({ lat: location.latitude, lng: location.longitude });
      } else {
        setName('');
        setAddress('');
        setType('home');
        setNotifyOnEnter(true);
        setNotifyOnExit(false);
        setCoordinates({ lat: 0, lng: 0 });
      }
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [visible, location]);

  // Auto-set exit notification for home
  useEffect(() => {
    if (type === 'home') {
      setNotifyOnExit(true);
      setNotifyOnEnter(false);
    } else {
      setNotifyOnExit(false);
      setNotifyOnEnter(true);
    }
  }, [type]);

  // Debounced address autocomplete
  const handleAddressChange = useCallback((text: string) => {
    setAddress(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSuggestionsLoading(true);
    setShowSuggestions(true);
    debounceRef.current = setTimeout(async () => {
      const results = await autocompleteAddress(text);
      setSuggestions(results);
      setSuggestionsLoading(false);
    }, 300);
  }, []);

  const handleSelectSuggestion = useCallback(async (suggestion: AddressSuggestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddress(suggestion.fullText);
    setSuggestions([]);
    setShowSuggestions(false);

    // Fetch place details for coordinates
    setSearchLoading(true);
    try {
      const details = await getPlaceDetailsById(suggestion.placeId);
      if (details) {
        setCoordinates({ lat: details.latitude, lng: details.longitude });
      }
    } catch (error) {
      console.error('Failed to get place details:', error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleUseCurrentLocation = async () => {
    setSearchLoading(true);
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        setCoordinates({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });

        // Try to get address from coordinates
        const addressResult = await locationService.reverseGeocode(
          location.coords.latitude,
          location.coords.longitude
        );

        if (addressResult) {
          const parts = [
            addressResult.street,
            addressResult.city,
            addressResult.region,
          ].filter(Boolean);
          setAddress(parts.join(', '));
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Failed to get current location:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for this location');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }

    onSave({
      name: name.trim(),
      address: address.trim(),
      type,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      radius: 100, // 100 meters default
      notifyOnEnter,
      notifyOnExit,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.modalContainer, { backgroundColor: themedColors.background.primary }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Modal Header */}
        <View style={[styles.modalHeader, { borderBottomColor: themedColors.surface.border }]}>
          <AnimatedPressable onPress={onClose} hapticType="light">
            <Text style={[styles.modalCancel, { color: colors.primary[500] }]}>Cancel</Text>
          </AnimatedPressable>
          <Text style={[styles.modalTitle, { color: themedColors.text.primary }]}>
            {location ? 'Edit Location' : 'Add Location'}
          </Text>
          <AnimatedPressable onPress={handleSave} hapticType="light">
            <Text style={[styles.modalSave, { color: colors.primary[500] }]}>Save</Text>
          </AnimatedPressable>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Location Type */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: themedColors.text.secondary }]}>Type</Text>
            <View style={styles.typeGrid}>
              {LOCATION_TYPES.map(typeOption => (
                <AnimatedPressable
                  key={typeOption.type}
                  onPress={() => setType(typeOption.type)}
                  style={[
                    styles.typeOption,
                    {
                      backgroundColor:
                        type === typeOption.type
                          ? colors.primary[500]
                          : themedColors.surface.secondary,
                      borderColor:
                        type === typeOption.type
                          ? colors.primary[500]
                          : themedColors.surface.border,
                    },
                  ]}
                  hapticType="light"
                >
                  <Ionicons
                    name={typeOption.icon as any}
                    size={20}
                    color={type === typeOption.type ? colors.neutral[0] : themedColors.text.primary}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      {
                        color:
                          type === typeOption.type ? colors.neutral[0] : themedColors.text.primary,
                      },
                    ]}
                  >
                    {typeOption.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>

          {/* Name */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: themedColors.text.secondary }]}>Name</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: themedColors.input.background,
                  borderColor: themedColors.input.border,
                  color: themedColors.text.primary,
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="e.g., My Home, Office, Costco"
              placeholderTextColor={themedColors.input.placeholder}
            />
          </View>

          {/* Address */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: themedColors.text.secondary }]}>Address</Text>
            <View style={styles.addressInputContainer}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.addressInput,
                  {
                    backgroundColor: themedColors.input.background,
                    borderColor: themedColors.input.border,
                    color: themedColors.text.primary,
                  },
                ]}
                value={address}
                onChangeText={handleAddressChange}
                placeholder="Search for an address"
                placeholderTextColor={themedColors.input.placeholder}
              />
              <AnimatedPressable
                onPress={handleUseCurrentLocation}
                style={[styles.locationButton, { backgroundColor: colors.primary[500] }]}
                hapticType="light"
              >
                {searchLoading ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <Ionicons name="locate" size={20} color={colors.neutral[0]} />
                )}
              </AnimatedPressable>
            </View>

            {/* Address Suggestions Dropdown */}
            {showSuggestions && (
              <View style={[styles.suggestionsContainer, shadows.md, { backgroundColor: themedColors.surface.primary, borderColor: themedColors.surface.border }]}>
                {suggestionsLoading && suggestions.length === 0 ? (
                  <View style={styles.suggestionsLoading}>
                    <ActivityIndicator size="small" color={colors.primary[500]} />
                    <Text style={[styles.suggestionsLoadingText, { color: themedColors.text.tertiary }]}>
                      Searching...
                    </Text>
                  </View>
                ) : suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={suggestion.placeId}
                      style={[
                        styles.suggestionRow,
                        index < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: themedColors.surface.border },
                      ]}
                      onPress={() => handleSelectSuggestion(suggestion)}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="location-outline" size={18} color={themedColors.text.tertiary} style={styles.suggestionIcon} />
                      <View style={styles.suggestionText}>
                        <Text style={[styles.suggestionMain, { color: themedColors.text.primary }]} numberOfLines={1}>
                          {suggestion.mainText}
                        </Text>
                        {suggestion.secondaryText ? (
                          <Text style={[styles.suggestionSecondary, { color: themedColors.text.tertiary }]} numberOfLines={1}>
                            {suggestion.secondaryText}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.suggestionsLoading}>
                    <Text style={[styles.suggestionsLoadingText, { color: themedColors.text.tertiary }]}>
                      No results found
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Text style={[styles.formHint, { color: themedColors.text.muted }]}>
              Type to search or tap the location button for current location
            </Text>
          </View>

          {/* Notification Triggers */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: themedColors.text.secondary }]}>
              Notify me when I...
            </Text>
            <View style={[styles.card, { backgroundColor: themedColors.surface.primary }]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleContent}>
                  <Text style={[styles.toggleTitle, { color: themedColors.text.primary }]}>
                    Arrive at this location
                  </Text>
                  <Text style={[styles.toggleHint, { color: themedColors.text.tertiary }]}>
                    Show relevant notes when I get here
                  </Text>
                </View>
                <Switch
                  value={notifyOnEnter}
                  onValueChange={setNotifyOnEnter}
                  trackColor={{
                    false: colors.neutral[200],
                    true: colors.primary[400],
                  }}
                  thumbColor={colors.neutral[0]}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleContent}>
                  <Text style={[styles.toggleTitle, { color: themedColors.text.primary }]}>
                    Leave this location
                  </Text>
                  <Text style={[styles.toggleHint, { color: themedColors.text.tertiary }]}>
                    Remind me of things I might need
                  </Text>
                </View>
                <Switch
                  value={notifyOnExit}
                  onValueChange={setNotifyOnExit}
                  trackColor={{
                    false: colors.neutral[200],
                    true: colors.primary[400],
                  }}
                  thumbColor={colors.neutral[0]}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: layout.statusBarOffset + spacing[4],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing[3],
    padding: spacing[1],
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: 'rgba(255,255,255,0.8)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[5],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
    marginLeft: spacing[1],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
  },
  emptyCard: {
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing[2],
  },
  emptyDescription: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
    marginBottom: spacing[2],
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  settingsRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  settingsRowContent: {
    flex: 1,
    marginRight: spacing[3],
  },
  settingsRowTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  settingsRowDescription: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing[1],
  },
  divider: {
    height: 1,
    marginVertical: spacing[3],
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  locationContent: {
    flex: 1,
  },
  locationName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  locationAddress: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing[1],
  },
  locationBadges: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  locationActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  actionButton: {
    padding: spacing[2],
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[3],
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing[1],
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
  },
  bottomSpacer: {
    height: spacing[10],
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
  },
  modalCancel: {
    fontSize: typography.fontSize.base,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalSave: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  modalContent: {
    flex: 1,
    padding: spacing[4],
  },
  formGroup: {
    marginBottom: spacing[5],
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[2],
  },
  formHint: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing[2],
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing[2],
  },
  typeLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: typography.fontSize.base,
  },
  addressInputContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  addressInput: {
    flex: 1,
  },
  locationButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    marginTop: spacing[1],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 240,
  },
  suggestionsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  suggestionsLoadingText: {
    fontSize: typography.fontSize.sm,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  suggestionIcon: {
    marginRight: spacing[2],
  },
  suggestionText: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  suggestionSecondary: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  toggleContent: {
    flex: 1,
    marginRight: spacing[3],
  },
  toggleTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  toggleHint: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing[1],
  },
});

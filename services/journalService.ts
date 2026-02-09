/**
 * Journal Service - Local photo storage and management
 *
 * Handles:
 * - Photo CRUD operations (local file system)
 * - Photo metadata storage (AsyncStorage)
 * - Category filtering
 * - Pattern detection for insights
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Directory, Paths } from 'expo-file-system/next';
import * as ImagePicker from 'expo-image-picker';

// Storage keys
const JOURNAL_PHOTOS_KEY = '@journal_photos';
const JOURNAL_STATS_KEY = '@journal_stats';

// Photo categories
export type PhotoCategory = 'food' | 'selfie' | 'other';

// Photo entry interface
export interface JournalPhoto {
  id: string;
  localUri: string;
  category: PhotoCategory;
  caption: string;
  createdAt: string; // ISO string
}

// Stats for pattern detection
export interface JournalStats {
  totalPhotos: number;
  foodCount: number;
  selfieCount: number;
  otherCount: number;
  lastPhotoDate: string | null;
  lastFoodDate: string | null;
  lastSelfieDate: string | null;
  weeklyPhotoCount: number;
  updatedAt: string;
}

// Default stats
const DEFAULT_STATS: JournalStats = {
  totalPhotos: 0,
  foodCount: 0,
  selfieCount: 0,
  otherCount: 0,
  lastPhotoDate: null,
  lastFoodDate: null,
  lastSelfieDate: null,
  weeklyPhotoCount: 0,
  updatedAt: new Date().toISOString(),
};

// Directory for storing photos
const JOURNAL_PHOTOS_DIR_NAME = 'journal_photos';

/**
 * Get the journal photos directory
 */
function getJournalDirectory(): Directory {
  return new Directory(Paths.document, JOURNAL_PHOTOS_DIR_NAME);
}

/**
 * Ensure the photos directory exists
 */
async function ensureDirectory(): Promise<void> {
  const dir = getJournalDirectory();
  if (!dir.exists) {
    dir.create();
  }
}

/**
 * Generate unique photo ID
 */
function generatePhotoId(): string {
  return `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Pick photo from camera
 */
export async function pickFromCamera(): Promise<string | null> {
  const hasPermission = await requestCameraPermissions();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Pick photo from gallery
 */
export async function pickFromGallery(): Promise<string | null> {
  const hasPermission = await requestMediaLibraryPermissions();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Save photo to local storage
 */
export async function savePhoto(
  tempUri: string,
  category: PhotoCategory,
  caption: string
): Promise<JournalPhoto | null> {
  try {
    await ensureDirectory();

    const photoId = generatePhotoId();
    const fileExtension = tempUri.split('.').pop() || 'jpg';
    const fileName = `${photoId}.${fileExtension}`;

    const dir = getJournalDirectory();
    const destinationFile = new File(dir, fileName);

    // Copy photo to app's document directory
    const sourceFile = new File(tempUri);
    sourceFile.copy(destinationFile);

    const photo: JournalPhoto = {
      id: photoId,
      localUri: destinationFile.uri,
      category,
      caption,
      createdAt: new Date().toISOString(),
    };

    // Get existing photos
    const photos = await getAllPhotos();
    photos.unshift(photo); // Add to beginning

    // Save to AsyncStorage
    await AsyncStorage.setItem(JOURNAL_PHOTOS_KEY, JSON.stringify(photos));

    // Update stats
    await updateStats(category, 'add');

    return photo;
  } catch (error) {
    console.error('Failed to save photo:', error);
    return null;
  }
}

/**
 * Get all photos
 */
export async function getAllPhotos(): Promise<JournalPhoto[]> {
  try {
    const data = await AsyncStorage.getItem(JOURNAL_PHOTOS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get photos:', error);
    return [];
  }
}

/**
 * Get photos by category
 */
export async function getPhotosByCategory(category: PhotoCategory): Promise<JournalPhoto[]> {
  const photos = await getAllPhotos();
  return photos.filter(p => p.category === category);
}

/**
 * Get recent photos (last N days)
 */
export async function getRecentPhotos(days: number = 7): Promise<JournalPhoto[]> {
  const photos = await getAllPhotos();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return photos.filter(p => new Date(p.createdAt) >= cutoff);
}

/**
 * Delete photo
 */
export async function deletePhoto(photoId: string): Promise<boolean> {
  try {
    const photos = await getAllPhotos();
    const photoIndex = photos.findIndex(p => p.id === photoId);

    if (photoIndex === -1) {
      return false;
    }

    const photo = photos[photoIndex];

    // Delete file from storage
    try {
      const file = new File(photo.localUri);
      if (file.exists) {
        file.delete();
      }
    } catch (fileError) {
      console.warn('Could not delete photo file:', fileError);
    }

    // Remove from array
    photos.splice(photoIndex, 1);
    await AsyncStorage.setItem(JOURNAL_PHOTOS_KEY, JSON.stringify(photos));

    // Update stats
    await updateStats(photo.category, 'remove');

    return true;
  } catch (error) {
    console.error('Failed to delete photo:', error);
    return false;
  }
}

/**
 * Update photo caption
 */
export async function updatePhotoCaption(
  photoId: string,
  caption: string
): Promise<boolean> {
  try {
    const photos = await getAllPhotos();
    const photoIndex = photos.findIndex(p => p.id === photoId);

    if (photoIndex === -1) {
      return false;
    }

    photos[photoIndex].caption = caption;
    await AsyncStorage.setItem(JOURNAL_PHOTOS_KEY, JSON.stringify(photos));

    return true;
  } catch (error) {
    console.error('Failed to update photo caption:', error);
    return false;
  }
}

/**
 * Get journal stats
 */
export async function getStats(): Promise<JournalStats> {
  try {
    const data = await AsyncStorage.getItem(JOURNAL_STATS_KEY);
    if (!data) {
      return DEFAULT_STATS;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get stats:', error);
    return DEFAULT_STATS;
  }
}

/**
 * Update stats after adding/removing photo
 */
async function updateStats(
  category: PhotoCategory,
  operation: 'add' | 'remove'
): Promise<void> {
  try {
    const stats = await getStats();
    const now = new Date().toISOString();
    const delta = operation === 'add' ? 1 : -1;

    stats.totalPhotos = Math.max(0, stats.totalPhotos + delta);

    switch (category) {
      case 'food':
        stats.foodCount = Math.max(0, stats.foodCount + delta);
        if (operation === 'add') stats.lastFoodDate = now;
        break;
      case 'selfie':
        stats.selfieCount = Math.max(0, stats.selfieCount + delta);
        if (operation === 'add') stats.lastSelfieDate = now;
        break;
      case 'other':
        stats.otherCount = Math.max(0, stats.otherCount + delta);
        break;
    }

    if (operation === 'add') {
      stats.lastPhotoDate = now;
    }

    // Recalculate weekly count
    const photos = await getAllPhotos();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    stats.weeklyPhotoCount = photos.filter(p => new Date(p.createdAt) >= weekAgo).length;

    stats.updatedAt = now;

    await AsyncStorage.setItem(JOURNAL_STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Failed to update stats:', error);
  }
}

/**
 * Recalculate all stats from photos
 */
export async function recalculateStats(): Promise<JournalStats> {
  try {
    const photos = await getAllPhotos();
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stats: JournalStats = {
      totalPhotos: photos.length,
      foodCount: photos.filter(p => p.category === 'food').length,
      selfieCount: photos.filter(p => p.category === 'selfie').length,
      otherCount: photos.filter(p => p.category === 'other').length,
      lastPhotoDate: photos.length > 0 ? photos[0].createdAt : null,
      lastFoodDate: photos.find(p => p.category === 'food')?.createdAt || null,
      lastSelfieDate: photos.find(p => p.category === 'selfie')?.createdAt || null,
      weeklyPhotoCount: photos.filter(p => new Date(p.createdAt) >= weekAgo).length,
      updatedAt: now.toISOString(),
    };

    await AsyncStorage.setItem(JOURNAL_STATS_KEY, JSON.stringify(stats));
    return stats;
  } catch (error) {
    console.error('Failed to recalculate stats:', error);
    return DEFAULT_STATS;
  }
}

/**
 * Get photos grouped by date for timeline view
 */
export async function getPhotosGroupedByDate(): Promise<{ date: string; photos: JournalPhoto[] }[]> {
  const photos = await getAllPhotos();
  const grouped: Record<string, JournalPhoto[]> = {};

  photos.forEach(photo => {
    const date = new Date(photo.createdAt).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(photo);
  });

  return Object.entries(grouped).map(([date, photos]) => ({ date, photos }));
}

/**
 * Get photo count for last N days (for activity graph)
 */
export async function getActivityHistory(days: number = 30): Promise<{ date: string; count: number }[]> {
  const photos = await getAllPhotos();
  const history: { date: string; count: number }[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const count = photos.filter(p => p.createdAt.startsWith(dateStr)).length;
    history.push({ date: dateStr, count });
  }

  return history.reverse();
}

/**
 * Clear all journal data (for testing/reset)
 */
export async function clearAllJournalData(): Promise<void> {
  try {
    // Delete all photo files
    const dir = getJournalDirectory();
    if (dir.exists) {
      dir.delete();
    }

    // Clear AsyncStorage
    await AsyncStorage.removeItem(JOURNAL_PHOTOS_KEY);
    await AsyncStorage.removeItem(JOURNAL_STATS_KEY);
  } catch (error) {
    console.error('Failed to clear journal data:', error);
  }
}

export default {
  requestCameraPermissions,
  requestMediaLibraryPermissions,
  pickFromCamera,
  pickFromGallery,
  savePhoto,
  getAllPhotos,
  getPhotosByCategory,
  getRecentPhotos,
  deletePhoto,
  updatePhotoCaption,
  getStats,
  recalculateStats,
  getPhotosGroupedByDate,
  getActivityHistory,
  clearAllJournalData,
};

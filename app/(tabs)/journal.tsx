/**
 * Journal Tab - Photo journaling for well-being tracking
 *
 * Features:
 * - Photos tab: Timeline of photos with category filters
 * - Insights tab: AI-generated summaries and suggestions
 * - Add photo bottom sheet
 * - Swipe to delete photos
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  Modal,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';

// Theme
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../../theme';

// Components
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { TopBar } from '../../components/common/TopBar';
import { PhotoCard } from '../../components/journal/PhotoCard';
import { CategoryFilter, FilterOption } from '../../components/journal/CategoryFilter';
import { CameraView } from '../../components/journal/CameraView';
import { InsightsView } from '../../components/journal/InsightsView';
import { EmptyJournalState } from '../../components/journal/EmptyJournalState';

// Services
import journalService, {
  JournalPhoto,
  PhotoCategory,
  getStats,
  JournalStats,
} from '../../services/journalService';
import { clearInsightsCache } from '../../services/journalInsightsService';
import { rescheduleNotificationsIfNeeded } from '../../services/journalNotificationService';

// Context
import { useTheme } from '../../context/ThemeContext';

type TabMode = 'photos' | 'insights';

export default function JournalScreen() {
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  // State
  const [activeTab, setActiveTab] = useState<TabMode>('photos');
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Load photos and stats
  const loadData = async () => {
    try {
      const [photosData, statsData] = await Promise.all([
        journalService.getAllPhotos(),
        getStats(),
      ]);
      setPhotos(photosData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load journal data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
      // Reschedule notifications on app focus
      rescheduleNotificationsIfNeeded();
    }, [])
  );

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filter photos
  const filteredPhotos =
    filter === 'all' ? photos : photos.filter((p) => p.category === filter);

  // Get counts for filter badges
  const filterCounts: Record<FilterOption, number> = {
    all: photos.length,
    food: photos.filter((p) => p.category === 'food').length,
    selfie: photos.filter((p) => p.category === 'selfie').length,
    other: photos.filter((p) => p.category === 'other').length,
  };

  // Handle photo delete
  const handleDeletePhoto = async (photoId: string) => {
    const success = await journalService.deletePhoto(photoId);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Clear insights cache to regenerate with new data
      await clearInsightsCache();
      loadData();
    }
  };

  // Handle add photo
  const handleAddPhoto = async (
    imageUri: string,
    category: PhotoCategory,
    caption: string
  ) => {
    const photo = await journalService.savePhoto(imageUri, category, caption);
    if (photo) {
      // Clear insights cache to regenerate with new data
      await clearInsightsCache();
      // Reschedule notifications based on new patterns
      await rescheduleNotificationsIfNeeded();
      loadData();
    }
  };

  // Handle tab change
  const handleTabChange = (tab: TabMode) => {
    if (tab !== activeTab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(tab);
    }
  };

  // Render photo item
  const renderPhotoItem = ({ item, index }: { item: JournalPhoto; index: number }) => (
    <PhotoCard
      photo={item}
      index={index}
      onDelete={handleDeletePhoto}
      onPress={(photo) => {
        // Could open a detail view in the future
        console.log('Photo pressed:', photo.id);
      }}
    />
  );

  // Render header with tabs and filters
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Tab Switcher */}
      <View style={[styles.tabSwitcher, { backgroundColor: themedColors.surface.secondary }]}>
        <AnimatedPressable
          onPress={() => handleTabChange('photos')}
          style={[
            styles.tabButton,
            activeTab === 'photos' && {
              backgroundColor: themedColors.surface.primary,
              ...shadows.sm,
            },
          ]}
          hapticType="light"
        >
          <Text
            style={[
              styles.tabButtonText,
              {
                color:
                  activeTab === 'photos'
                    ? themedColors.text.primary
                    : themedColors.text.tertiary,
              },
            ]}
          >
            photos
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => handleTabChange('insights')}
          style={[
            styles.tabButton,
            activeTab === 'insights' && {
              backgroundColor: themedColors.surface.primary,
              ...shadows.sm,
            },
          ]}
          hapticType="light"
        >
          <Text
            style={[
              styles.tabButtonText,
              {
                color:
                  activeTab === 'insights'
                    ? themedColors.text.primary
                    : themedColors.text.tertiary,
              },
            ]}
          >
            Insights
          </Text>
        </AnimatedPressable>
      </View>

      {/* Category Filter (only for photos tab) */}
      {activeTab === 'photos' && photos.length > 0 && (
        <CategoryFilter
          selected={filter}
          onSelect={setFilter}
          counts={filterCounts}
        />
      )}
    </View>
  );

  // Render empty state
  const renderEmptyState = () => {
    if (activeTab === 'insights') {
      return <InsightsView onRefresh={loadData} />;
    }

    if (filter !== 'all' && filteredPhotos.length === 0) {
      // Empty for specific filter
      return (
        <Animated.View entering={FadeIn} style={styles.emptyFilter}>
          <Ionicons
            name="images-outline"
            size={48}
            color={themedColors.text.tertiary}
          />
          <Text style={[styles.emptyFilterText, { color: themedColors.text.tertiary }]}>
            No {filter} photos yet
          </Text>
          <AnimatedPressable
            onPress={() => setShowCamera(true)}
            style={[styles.emptyFilterButton, { borderColor: colors.primary[500] }]}
            hapticType="light"
          >
            <Text style={[styles.emptyFilterButtonText, { color: colors.primary[500] }]}>
              Add {filter} photo
            </Text>
          </AnimatedPressable>
        </Animated.View>
      );
    }

    return <EmptyJournalState onAddPhoto={() => setShowCamera(true)} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <TopBar themedColors={themedColors} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: themedColors.text.tertiary }]}>
            Loading journal...
          </Text>
        </View>
      ) : (
        <>
          {renderHeader()}

          {activeTab === 'insights' ? (
            <InsightsView onRefresh={loadData} />
          ) : photos.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={filteredPhotos}
              keyExtractor={(item) => item.id}
              renderItem={renderPhotoItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmptyState()}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary[500]}
                  colors={[colors.primary[500]]}
                />
              }
            />
          )}
        </>
      )}

      {/* Floating Add Button */}
      {activeTab === 'photos' && !showCamera && (
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowCamera(true);
          }}
          style={[styles.fab, shadows.primary, { backgroundColor: colors.primary[500] }]}
          hapticType="medium"
        >
          <Ionicons name="camera" size={28} color={colors.neutral[0]} />
        </AnimatedPressable>
      )}

      {/* Full-screen Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
      >
        <CameraView
          visible={showCamera}
          onClose={() => setShowCamera(false)}
          onCapture={handleAddPhoto}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  headerContainer: {
    paddingTop: spacing[2],
  },
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[1],
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  listContent: {
    padding: spacing[4],
    paddingBottom: 120,
  },
  emptyFilter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
    gap: spacing[3],
  },
  emptyFilterText: {
    fontSize: typography.fontSize.base,
  },
  emptyFilterButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginTop: spacing[2],
  },
  emptyFilterButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: spacing[4],
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

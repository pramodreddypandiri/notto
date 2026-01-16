import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { createWeekendPlans, submitFeedback } from '../../services/plansService';
import { supabase } from '../../config/supabase';

// Demo mode: set to true to test UI without backend
const DEMO_MODE = true;

const DEMO_PLANS = [
  {
    id: '1',
    plan_data: {
      title: 'Saturday Evening Adventure',
      date: 'Saturday',
      startTime: '6:00 PM',
      endTime: '10:00 PM',
      activities: [
        {
          time: '6:00 PM',
          name: 'Lucky Strike Bowling',
          address: '123 Main St',
          duration: '1.5 hours',
        },
        {
          time: '7:45 PM',
          name: 'Casa Luna Mexican Restaurant',
          address: '456 Oak Ave',
          duration: '1.5 hours',
        },
        {
          time: '9:30 PM',
          name: 'Dessert at Sweet Treats',
          address: '789 Park Blvd',
          duration: '30 minutes',
        },
      ],
      reasoning: 'Based on your interest in bowling and Mexican food!',
    },
  },
  {
    id: '2',
    plan_data: {
      title: 'Sunday Afternoon Chill',
      date: 'Sunday',
      startTime: '2:00 PM',
      endTime: '6:00 PM',
      activities: [
        {
          time: '2:00 PM',
          name: 'Downtown Bowling Alley',
          address: '321 Center St',
          duration: '2 hours',
        },
        {
          time: '4:15 PM',
          name: 'Taco Paradise',
          address: '654 Elm St',
          duration: '1.5 hours',
        },
      ],
      reasoning: 'A more relaxed Sunday option with your favorite activities',
    },
  },
];

export default function PlansScreen() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGeneratePlans = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        setPlans(DEMO_PLANS);
        return;
      }

      // Get user location from preferences
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (!prefs?.location_city) {
        Alert.alert(
          'Location Required',
          'Please set your location in Settings first'
        );
        return;
      }

      const userLocation = {
        lat: prefs.location_lat,
        lng: prefs.location_lng,
        city: prefs.location_city,
      };

      const newPlans = await createWeekendPlans(userLocation);
      setPlans(newPlans);
    } catch (error) {
      console.error('Failed to generate plans:', error);
      Alert.alert('Error', 'Failed to generate plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (planId: string, rating: 'up' | 'down') => {
    try {
      if (DEMO_MODE) {
        Alert.alert('Thanks!', 'Your feedback helps us improve your plans (Demo Mode)');
        return;
      }
      await submitFeedback(planId, rating);
      Alert.alert('Thanks!', 'Your feedback helps us improve your plans');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const renderPlan = (plan: any) => (
    <View key={plan.id} style={styles.planCard}>
      <Text style={styles.planTitle}>{plan.plan_data.title}</Text>
      <Text style={styles.planDate}>
        {plan.plan_data.date} • {plan.plan_data.startTime} - {plan.plan_data.endTime}
      </Text>

      {/* Activities */}
      {plan.plan_data.activities.map((activity: any, index: number) => (
        <View key={index} style={styles.activity}>
          <Text style={styles.activityTime}>{activity.time}</Text>
          <View style={styles.activityDetails}>
            <Text style={styles.activityName}>{activity.name}</Text>
            <Text style={styles.activityAddress}>{activity.address}</Text>
            <Text style={styles.activityDuration}>{activity.duration}</Text>
          </View>
        </View>
      ))}

      {/* Reasoning */}
      <View style={styles.reasoning}>
        <Text style={styles.reasoningText}>💡 {plan.plan_data.reasoning}</Text>
      </View>

      {/* Feedback Buttons */}
      <View style={styles.feedbackButtons}>
        <TouchableOpacity
          style={[styles.feedbackButton, styles.feedbackUp]}
          onPress={() => handleFeedback(plan.id, 'up')}
        >
          <Text style={styles.feedbackIcon}>👍</Text>
          <Text style={styles.feedbackText}>I like this</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedbackButton, styles.feedbackDown]}
          onPress={() => handleFeedback(plan.id, 'down')}
        >
          <Text style={styles.feedbackIcon}>👎</Text>
          <Text style={styles.feedbackText}>Not for me</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekend Plans</Text>
      </View>

      {plans.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Ready to plan your weekend?</Text>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGeneratePlans}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateButtonText}>Generate Plans</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.plansContainer}>
          {plans.map(renderPlan)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#6366f1',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  generateButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  plansContainer: {
    flex: 1,
    padding: 20,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  planDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  activity: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    width: 70,
  },
  activityDetails: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  activityAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  activityDuration: {
    fontSize: 12,
    color: '#999',
  },
  reasoning: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  reasoningText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  feedbackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  feedbackUp: {
    backgroundColor: '#10b981',
  },
  feedbackDown: {
    backgroundColor: '#ef4444',
  },
  feedbackIcon: {
    fontSize: 20,
  },
  feedbackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

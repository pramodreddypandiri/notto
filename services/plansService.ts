import { supabase } from '../config/supabase';
import { generatePlaceSuggestions } from './claudeService';
import { getRecentNotes } from './notesService';

// Place suggestion with database fields
export interface StoredPlaceSuggestion {
  id: string;
  user_id: string;
  name: string;
  address: string;
  category: string;
  description: string;
  reason: string;
  price_range: string;
  source: string;
  status: 'suggested' | 'liked' | 'disliked';
  feedback_at: string | null;
  created_at: string;
  expires_at: string;
}

// Generate and save new place suggestions
export const createPlaceSuggestions = async (
  userLocation: { lat: number; lng: number; city: string }
): Promise<StoredPlaceSuggestion[]> => {
  try {
    // Get user's recent notes
    const notes = await getRecentNotes(7);

    // Get past feedback for learning
    const pastFeedback = await getPastFeedbackSummary();

    // Generate suggestions with Claude
    const suggestions = await generatePlaceSuggestions(notes, userLocation, pastFeedback);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Save suggestions to database
    const savedSuggestions: StoredPlaceSuggestion[] = [];
    for (const suggestion of suggestions) {
      // Use upsert to avoid duplicates
      const { data, error } = await supabase
        .from('place_suggestions')
        .upsert({
          user_id: user.id,
          name: suggestion.name,
          address: suggestion.address,
          category: suggestion.category,
          description: suggestion.description,
          reason: suggestion.reason,
          price_range: suggestion.priceRange,
          source: suggestion.source,
          status: 'suggested',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        }, {
          onConflict: 'user_id,name,address',
          ignoreDuplicates: true,
        })
        .select()
        .single();

      if (!error && data) {
        savedSuggestions.push(data);
      }
    }

    return savedSuggestions;
  } catch (error) {
    console.error('Failed to create place suggestions:', error);
    throw error;
  }
};

// Get all active suggestions (not expired, status = 'suggested')
export const getSuggestions = async (): Promise<StoredPlaceSuggestion[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('place_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'suggested')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to get suggestions:', error);
    throw error;
  }
};

// Get liked places (the "Going" section)
export const getLikedPlaces = async (): Promise<StoredPlaceSuggestion[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('place_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'liked')
      .order('feedback_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to get liked places:', error);
    throw error;
  }
};

// Update suggestion status (like or dislike)
export const updateSuggestionStatus = async (
  suggestionId: string,
  status: 'liked' | 'disliked'
): Promise<StoredPlaceSuggestion> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('place_suggestions')
      .update({
        status,
        feedback_at: new Date().toISOString(),
      })
      .eq('id', suggestionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to update suggestion status:', error);
    throw error;
  }
};

// Remove a liked place from "Going" list
export const removeLikedPlace = async (suggestionId: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('place_suggestions')
      .delete()
      .eq('id', suggestionId)
      .eq('user_id', user.id);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to remove liked place:', error);
    throw error;
  }
};

// Get summary of past feedback for AI learning
const getPastFeedbackSummary = async (): Promise<{ name: string; status: 'liked' | 'disliked' }[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('place_suggestions')
      .select('name, status')
      .eq('user_id', user.id)
      .in('status', ['liked', 'disliked'])
      .order('feedback_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return (data || []).map(d => ({
      name: d.name,
      status: d.status as 'liked' | 'disliked',
    }));
  } catch (error) {
    console.error('Failed to get past feedback:', error);
    return [];
  }
};

// Legacy exports for backwards compatibility
/** @deprecated Use createPlaceSuggestions instead */
export const createWeekendPlans = createPlaceSuggestions;

/** @deprecated Use getSuggestions instead */
export const getPlans = getSuggestions;

/** @deprecated Use updateSuggestionStatus instead */
export const submitFeedback = async (
  planId: string,
  rating: 'up' | 'down',
  _reason?: string
) => {
  return updateSuggestionStatus(planId, rating === 'up' ? 'liked' : 'disliked');
};
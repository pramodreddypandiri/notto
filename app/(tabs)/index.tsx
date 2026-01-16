import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import voiceService from '../../services/voiceService';
import { createNote, getNotes } from '../../services/notesService';
import notificationService from '../../services/notificationService';

// Demo mode: set to true to test UI without backend
const DEMO_MODE = true;

type NoteTag = 'reminder' | 'preference' | 'my_type' | 'my_vibe';

interface Note {
  id: string;
  transcript: string;
  parsed_data?: {
    summary: string;
    type: string;
  };
  created_at: string;
  tags?: NoteTag[];
  reminder_time?: string;
}

const DEMO_NOTES: Note[] = [
  {
    id: '1',
    transcript: 'I want to go bowling this weekend',
    parsed_data: { summary: 'Want to: go bowling', type: 'intent' },
    created_at: new Date().toISOString(),
    tags: ['preference'],
  },
  {
    id: '2',
    transcript: 'Try Mexican food',
    parsed_data: { summary: 'Preference: Mexican food', type: 'preference' },
    created_at: new Date(Date.now() - 3600000).toISOString(),
    tags: ['my_type'],
  },
  {
    id: '3',
    transcript: 'Email Jack about interview on Thursday',
    parsed_data: { summary: 'Task: Email Jack about interview', type: 'task' },
    created_at: new Date(Date.now() - 7200000).toISOString(),
    tags: ['reminder'],
    reminder_time: 'Thursday, 9:00 AM',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(2); // Demo count

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      if (DEMO_MODE) {
        setNotes(DEMO_NOTES);
        return;
      }
      const data = await getNotes(20);
      setNotes(data || []);
    } catch (error) {
      console.error('Failed to load notes:', error);
      setNotes(DEMO_NOTES);
    }
  };

  const handleRecordPress = async () => {
    if (isRecording) {
      setLoading(true);
      try {
        const audioUri = await voiceService.stopRecording();

        if (audioUri) {
          if (DEMO_MODE) {
            const newNote: Note = {
              id: Date.now().toString(),
              transcript: 'New voice note recorded',
              parsed_data: { summary: 'Voice note recorded (demo mode)', type: 'intent' },
              created_at: new Date().toISOString(),
            };
            setNotes([newNote, ...notes]);
          } else {
            const transcript = 'Audio recorded - transcription not implemented yet';
            await createNote(transcript, audioUri);
            await loadNotes();
          }
        }
      } catch (error) {
        console.error('Recording error:', error);
      } finally {
        setIsRecording(false);
        setLoading(false);
      }
    } else {
      try {
        await voiceService.startRecording();
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    }
  };

  const handleDeleteNote = (noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setNotes(notes.filter(note => note.id !== noteId));
          },
        },
      ]
    );
  };

  const handleTagNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setShowTagModal(true);
  };

  const applyTag = (tag: NoteTag) => {
    if (!selectedNoteId) return;

    setNotes(notes.map(note => {
      if (note.id === selectedNoteId) {
        const currentTags = note.tags || [];
        const hasTag = currentTags.includes(tag);

        return {
          ...note,
          tags: hasTag
            ? currentTags.filter(t => t !== tag)
            : [...currentTags, tag],
        };
      }
      return note;
    }));

    setShowTagModal(false);
    setSelectedNoteId(null);
  };

  const getTagColor = (tag: NoteTag): string => {
    const colors: Record<NoteTag, string> = {
      reminder: '#ef4444',
      preference: '#10b981',
      my_type: '#8b5cf6',
      my_vibe: '#f59e0b',
    };
    return colors[tag];
  };

  const getTagIcon = (tag: NoteTag): string => {
    const icons: Record<NoteTag, string> = {
      reminder: 'alarm',
      preference: 'heart',
      my_type: 'star',
      my_vibe: 'musical-notes',
    };
    return icons[tag];
  };

  const renderNote = ({ item }: { item: Note }) => (
    <View style={styles.noteCard}>
      <View style={styles.noteHeader}>
        <View style={styles.noteContent}>
          <Text style={styles.noteText}>
            {item.parsed_data?.summary || item.transcript}
          </Text>
          <Text style={styles.noteTime}>
            {new Date(item.created_at).toLocaleString()}
          </Text>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {item.tags.map((tag) => (
                <View
                  key={tag}
                  style={[styles.tag, { backgroundColor: getTagColor(tag) }]}
                >
                  <Ionicons
                    name={getTagIcon(tag) as any}
                    size={12}
                    color="#fff"
                  />
                  <Text style={styles.tagText}>
                    {tag.replace('_', ' ')}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Reminder Time */}
          {item.reminder_time && (
            <View style={styles.reminderTime}>
              <Ionicons name="time" size={14} color="#6366f1" />
              <Text style={styles.reminderTimeText}>{item.reminder_time}</Text>
            </View>
          )}
        </View>

        <View style={styles.noteActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleTagNote(item.id)}
          >
            <Ionicons name="pricetag" size={20} color="#6366f1" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteNote(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Weekend Planner</Text>
          {notificationCount > 0 && (
            <TouchableOpacity style={styles.notificationButton}>
              <Ionicons name="notifications" size={24} color="#fff" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{notificationCount}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.planButton}
          onPress={() => {
            // @ts-ignore - Expo Router group routes
            router.push('/(tabs)/plans');
          }}
        >
          <Text style={styles.planButtonText}>Plan My Weekend</Text>
        </TouchableOpacity>
      </View>

      {/* Notes List */}
      <View style={styles.notesSection}>
        <Text style={styles.sectionTitle}>Recent Notes</Text>
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.notesList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Bottom Microphone Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.micButton,
            isRecording && styles.micButtonRecording,
          ]}
          onPress={handleRecordPress}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={32}
              color="#fff"
            />
          )}
        </TouchableOpacity>
        <Text style={styles.recordHint}>
          {isRecording ? 'Tap to stop recording' : 'Tap to record a note'}
        </Text>
      </View>

      {/* Tag Selection Modal */}
      <Modal
        visible={showTagModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTagModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tag Note</Text>
              <TouchableOpacity onPress={() => setShowTagModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <TouchableOpacity
                style={[styles.tagOption, { borderLeftColor: '#ef4444' }]}
                onPress={() => applyTag('reminder')}
              >
                <Ionicons name="alarm" size={24} color="#ef4444" />
                <View style={styles.tagOptionText}>
                  <Text style={styles.tagOptionTitle}>Reminder</Text>
                  <Text style={styles.tagOptionDesc}>Get notified at a specific time</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tagOption, { borderLeftColor: '#10b981' }]}
                onPress={() => applyTag('preference')}
              >
                <Ionicons name="heart" size={24} color="#10b981" />
                <View style={styles.tagOptionText}>
                  <Text style={styles.tagOptionTitle}>Preference</Text>
                  <Text style={styles.tagOptionDesc}>Things you like or want to try</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tagOption, { borderLeftColor: '#8b5cf6' }]}
                onPress={() => applyTag('my_type')}
              >
                <Ionicons name="star" size={24} color="#8b5cf6" />
                <View style={styles.tagOptionText}>
                  <Text style={styles.tagOptionTitle}>My Type</Text>
                  <Text style={styles.tagOptionDesc}>Activities that match your style</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tagOption, { borderLeftColor: '#f59e0b' }]}
                onPress={() => applyTag('my_vibe')}
              >
                <Ionicons name="musical-notes" size={24} color="#f59e0b" />
                <View style={styles.tagOptionText}>
                  <Text style={styles.tagOptionTitle}>My Vibe</Text>
                  <Text style={styles.tagOptionDesc}>Mood and atmosphere preferences</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  planButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
  notesSection: {
    flex: 1,
    padding: 20,
    paddingBottom: 100, // Space for bottom mic button
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  notesList: {
    paddingBottom: 20,
  },
  noteCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  noteContent: {
    flex: 1,
    marginRight: 12,
  },
  noteText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
    lineHeight: 22,
  },
  noteTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  reminderTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  reminderTimeText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '500',
  },
  noteActions: {
    gap: 8,
  },
  actionButton: {
    padding: 6,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  micButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  micButtonRecording: {
    backgroundColor: '#ef4444',
  },
  recordHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderLeftWidth: 4,
    backgroundColor: '#f9fafb',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
    gap: 16,
  },
  tagOptionText: {
    flex: 1,
  },
  tagOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  tagOptionDesc: {
    fontSize: 13,
    color: '#666',
  },
});

import { supabase } from '../config/supabase';
import { saveEnrichmentData } from './notesService';
import { isAIConfigured, callAIForJSON } from './aiService';

export interface EnrichmentLink {
  title: string;
  url: string;
  source: string; // 'amazon' | 'google' | 'yelp' | 'generic'
}

export interface TaskEnrichment {
  links: EnrichmentLink[];
  tips: string[];
  estimatedDuration?: number; // in minutes
}

// Keywords that indicate simple tasks (no enrichment needed)
const SIMPLE_TASK_KEYWORDS = [
  'call', 'text', 'email', 'message',
  'ask', 'tell', 'remind',
  'check', 'review', 'read',
  'think about', 'consider',
];

// Keywords that indicate enrichable tasks
const ENRICHABLE_KEYWORDS = [
  'buy', 'purchase', 'order', 'shop',
  'book', 'schedule', 'reserve',
  'fix', 'repair', 'install',
  'learn', 'study', 'research',
  'cook', 'make', 'prepare',
  'exercise', 'workout', 'gym',
  'travel', 'trip', 'visit',
];

class TaskEnrichmentService {
  private maxLinksPerTask = 3;
  private maxTipsPerTask = 2;

  /**
   * Check if a task is simple (doesn't need enrichment)
   */
  isSimpleTask(taskText: string): boolean {
    const lower = taskText.toLowerCase();

    // Check for simple task keywords
    const hasSimpleKeyword = SIMPLE_TASK_KEYWORDS.some(kw => lower.includes(kw));

    // Check for enrichable keywords
    const hasEnrichableKeyword = ENRICHABLE_KEYWORDS.some(kw => lower.includes(kw));

    // Simple if it has simple keywords but no enrichable keywords
    // OR if it's very short (less than 5 words)
    const wordCount = taskText.trim().split(/\s+/).length;

    return (hasSimpleKeyword && !hasEnrichableKeyword) || wordCount < 4;
  }

  /**
   * Enrich a task with links and tips
   */
  async enrichTask(
    noteId: string,
    taskText: string,
    category?: string
  ): Promise<TaskEnrichment | null> {
    try {
      // Skip if simple task
      if (this.isSimpleTask(taskText)) {
        return null;
      }

      // Use Claude to analyze the task and generate enrichment
      const enrichment = await this.generateEnrichmentWithAI(taskText, category);

      if (enrichment && (enrichment.links.length > 0 || enrichment.tips.length > 0)) {
        // Save enrichment to database
        await saveEnrichmentData(noteId, enrichment);
        return enrichment;
      }

      return null;
    } catch (error) {
      console.error('Error enriching task:', error);
      return null;
    }
  }

  /**
   * Generate enrichment using Claude AI
   */
  private async generateEnrichmentWithAI(
    taskText: string,
    category?: string
  ): Promise<TaskEnrichment | null> {
    try {
      if (!isAIConfigured()) {
        return null;
      }

      const prompt = `You are a helpful task assistant. Analyze this task and provide helpful resources.

Task: "${taskText}"
${category ? `Category: ${category}` : ''}

Provide enrichment in this exact JSON format:
{
  "needsEnrichment": boolean,
  "links": [
    { "title": "Short title (max 40 chars)", "url": "https://...", "source": "amazon|google|yelp|generic" }
  ],
  "tips": ["Practical tip 1", "Practical tip 2"],
  "estimatedDuration": number (minutes, optional)
}

Rules:
1. Only add links if truly helpful (product purchases, service bookings, learning resources)
2. Maximum 3 links, prioritize most relevant
3. Maximum 2 tips, make them actionable and specific
4. For shopping tasks: include Amazon or relevant store links
5. For service tasks: suggest how to find/book services
6. For learning tasks: suggest resources
7. Simple tasks like "call mom" or "send email" should have needsEnrichment: false
8. Estimate duration realistically (e.g., grocery shopping = 45-60 min)

Return ONLY valid JSON, no other text.`;

      const parsed = await callAIForJSON(prompt, { maxTokens: 512 });

      if (!parsed.needsEnrichment) {
        return null;
      }

      // Validate and limit results
      const enrichment: TaskEnrichment = {
        links: (parsed.links || []).slice(0, this.maxLinksPerTask).map((link: any) => ({
          title: String(link.title || '').slice(0, 40),
          url: String(link.url || ''),
          source: link.source || 'generic',
        })),
        tips: (parsed.tips || []).slice(0, this.maxTipsPerTask).map((tip: any) => String(tip)),
        estimatedDuration: parsed.estimatedDuration ? Number(parsed.estimatedDuration) : undefined,
      };

      return enrichment;
    } catch (error) {
      console.error('Error generating enrichment with AI:', error);
      return null;
    }
  }

  /**
   * Enrich a task in the background (call after note is saved)
   */
  async enrichTaskInBackground(
    noteId: string,
    taskText: string,
    category?: string
  ): Promise<void> {
    // Run enrichment without blocking
    this.enrichTask(noteId, taskText, category).catch(err => {
      console.error('Background enrichment failed:', err);
    });
  }

  /**
   * Get cached enrichment for a note
   */
  async getEnrichment(noteId: string): Promise<TaskEnrichment | null> {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('enrichment_data')
        .eq('id', noteId)
        .single();

      if (error || !data?.enrichment_data) {
        return null;
      }

      return data.enrichment_data as TaskEnrichment;
    } catch (error) {
      console.error('Error getting enrichment:', error);
      return null;
    }
  }

  /**
   * Generate quick tips for common task categories (no AI needed)
   */
  getQuickTips(category: string): string[] {
    const categoryTips: Record<string, string[]> = {
      grocery: [
        'Check your pantry before shopping to avoid duplicates',
        'Shop the perimeter of the store for fresh items first',
      ],
      shopping: [
        'Compare prices online before heading to the store',
        'Check for coupons or cashback offers',
      ],
      fitness: [
        'Warm up for 5-10 minutes before intense exercise',
        'Stay hydrated throughout your workout',
      ],
      health: [
        'Bring a list of current medications to appointments',
        'Write down questions beforehand so you don\'t forget',
      ],
      work: [
        'Break large tasks into smaller, manageable chunks',
        'Set a specific time block to focus without distractions',
      ],
      errand: [
        'Group nearby errands together to save time',
        'Check business hours before heading out',
      ],
    };

    return categoryTips[category] || [];
  }

  /**
   * Format duration for display
   */
  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `~${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `~${hours} hr`;
    }
    return `~${hours} hr ${mins} min`;
  }
}

export default new TaskEnrichmentService();

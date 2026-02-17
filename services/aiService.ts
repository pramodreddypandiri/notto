/**
 * AI Service - Centralized wrapper for AI API calls
 *
 * Uses DeepSeek API (OpenAI-compatible format).
 * To switch providers, only change the URL and model below.
 */

import { ENV } from '../config/env';

const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

/**
 * Check if the AI API is configured
 */
export function isAIConfigured(): boolean {
  return !!(ENV.DEEPSEEK_API_KEY && ENV.DEEPSEEK_API_KEY !== 'sk-YOUR_DEEPSEEK_API_KEY_HERE');
}

/**
 * Call the AI API and return the text response
 */
export async function callAI(
  prompt: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const maxTokens = options?.maxTokens ?? 1024;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ENV.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('AI API error:', response.status, errorData);
    throw new Error(errorData.error?.message || `AI API request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call the AI API and parse the response as JSON
 */
export async function callAIForJSON<T = any>(
  prompt: string,
  options?: { maxTokens?: number }
): Promise<T> {
  const text = await callAI(prompt, options);

  // Remove markdown code blocks if present
  let jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();

  // Try to extract JSON array or object
  const jsonMatch = jsonStr.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  return JSON.parse(jsonStr) as T;
}

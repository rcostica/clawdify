/**
 * Session Summarization Engine
 *
 * Implements progressive conversation compression:
 * - Detects session boundaries (>2h gap between messages)
 * - Generates summaries of completed sessions via the gateway
 * - Loads recent summaries alongside raw messages for context
 *
 * Part of the tiered memory system (see memory-system-design.md).
 */

import { db, messages, sessionSummaries } from '@/lib/db';
import { chat } from '@/lib/gateway/client';
import { eq, desc, asc, gt, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Session boundary: 2 hours of inactivity = new session
const SESSION_GAP_MS = 2 * 60 * 60 * 1000;

// Min messages to bother summarizing
const MIN_MESSAGES_FOR_SUMMARY = 4;

// Max messages to include in a single summary prompt
const MAX_MESSAGES_PER_SUMMARY = 60;

// Track in-flight summaries to prevent duplicates
const _pendingSummaries = new Set<string>();

/**
 * Detect if there's a session boundary and return messages that need summarizing.
 * Returns null if no summarization is needed.
 */
export function detectSessionBoundary(threadId: string): {
  messagesToSummarize: Array<{ id: string; role: string; content: string; createdAt: Date }>;
} | null {
  // Find the most recent message (the one the user just sent will be the newest)
  const recentMessages = db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(desc(messages.createdAt))
    .limit(2)
    .all();

  if (recentMessages.length < 2) return null;

  const newest = recentMessages[0];
  const secondNewest = recentMessages[1];

  const newestTime = newest.createdAt instanceof Date
    ? newest.createdAt.getTime()
    : Number(newest.createdAt) * (Number(newest.createdAt) < 1e12 ? 1000 : 1);
  const secondTime = secondNewest.createdAt instanceof Date
    ? secondNewest.createdAt.getTime()
    : Number(secondNewest.createdAt) * (Number(secondNewest.createdAt) < 1e12 ? 1000 : 1);

  const gap = newestTime - secondTime;

  if (gap < SESSION_GAP_MS) return null;

  // There's a gap! Find messages from the previous session that haven't been summarized yet.
  // Get the last summary's end point
  const lastSummary = db
    .select()
    .from(sessionSummaries)
    .where(eq(sessionSummaries.threadId, threadId))
    .orderBy(desc(sessionSummaries.lastMessageAt))
    .limit(1)
    .get();

  // Fetch messages between last summary and the gap
  let unsummarized;
  if (lastSummary) {
    const afterTime = lastSummary.lastMessageAt instanceof Date
      ? lastSummary.lastMessageAt
      : new Date(Number(lastSummary.lastMessageAt) * (Number(lastSummary.lastMessageAt) < 1e12 ? 1000 : 1));

    unsummarized = db
      .select()
      .from(messages)
      .where(and(
        eq(messages.threadId, threadId),
        gt(messages.createdAt, afterTime),
      ))
      .orderBy(asc(messages.createdAt))
      .all();
  } else {
    // No summaries yet — get all messages before the current one
    unsummarized = db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(asc(messages.createdAt))
      .all();
  }

  // Exclude the newest message (current session)
  const previousSession = unsummarized.filter(m => {
    const t = m.createdAt instanceof Date
      ? m.createdAt.getTime()
      : Number(m.createdAt) * (Number(m.createdAt) < 1e12 ? 1000 : 1);
    return t < newestTime;
  });

  if (previousSession.length < MIN_MESSAGES_FOR_SUMMARY) return null;

  return {
    messagesToSummarize: previousSession.slice(-MAX_MESSAGES_PER_SUMMARY).map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt instanceof Date
        ? m.createdAt
        : new Date(Number(m.createdAt) * (Number(m.createdAt) < 1e12 ? 1000 : 1)),
    })),
  };
}

/**
 * Generate a session summary and store it in the DB.
 * Runs in the background — fire and forget.
 */
export async function generateAndStoreSummary(
  threadId: string,
  msgs: Array<{ id: string; role: string; content: string; createdAt: Date }>,
): Promise<void> {
  // Prevent duplicate summaries for the same thread
  if (_pendingSummaries.has(threadId)) return;
  _pendingSummaries.add(threadId);

  try {
    // Build the conversation text for summarization
    const conversationText = msgs.map(m => {
      const time = m.createdAt.toISOString().slice(0, 16).replace('T', ' ');
      const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'AI' : 'System';
      // Truncate very long messages to keep the summary prompt reasonable
      const content = m.content.length > 2000
        ? m.content.slice(0, 2000) + '... [truncated]'
        : m.content;
      return `[${time}] ${role}: ${content}`;
    }).join('\n\n');

    const firstTime = msgs[0].createdAt;
    const lastTime = msgs[msgs.length - 1].createdAt;
    const dateStr = firstTime.toISOString().slice(0, 10);

    const summaryPrompt = [
      'Summarize this conversation session concisely. Focus on:',
      '- Decisions made and their rationale',
      '- Problems identified or solved',
      '- Tasks completed or started',
      '- Current state at end of session',
      '- Unresolved questions or blockers',
      '',
      'Format: 2-5 bullet points. Max 300 words. Skip greetings and pleasantries.',
      `Date: ${dateStr} | Messages: ${msgs.length}`,
      '',
      '---',
      conversationText,
    ].join('\n');

    const result = await chat({
      messages: [
        {
          role: 'system',
          content: 'You are a conversation summarizer. Output ONLY the summary bullets, nothing else. Be concise and factual.',
        },
        { role: 'user', content: summaryPrompt },
      ],
      sessionKey: `clawdify:summarizer:${threadId}`,
      user: `clawdify:summarizer:${threadId}`,
    });

    const summaryContent = result?.choices?.[0]?.message?.content;
    if (!summaryContent || summaryContent.length < 20) {
      console.warn('[session-summary] Summary too short or empty, skipping storage');
      return;
    }

    // Format with date prefix for easy scanning
    const formattedSummary = `Session ${dateStr} (${msgs.length} messages):\n${summaryContent}`;

    db.insert(sessionSummaries).values({
      id: uuidv4(),
      threadId,
      content: formattedSummary,
      messageCount: msgs.length,
      firstMessageAt: firstTime,
      lastMessageAt: lastTime,
      lastMessageId: msgs[msgs.length - 1].id,
      createdAt: new Date(),
    }).run();

    console.log(`[session-summary] Stored summary for thread ${threadId}: ${msgs.length} messages → ${summaryContent.length} chars`);
  } catch (error) {
    console.error('[session-summary] Failed to generate summary:', error);
  } finally {
    _pendingSummaries.delete(threadId);
  }
}

/**
 * Load recent session summaries for a thread.
 * Returns them formatted for injection into the chat context.
 */
export function loadSessionSummaries(threadId: string, limit: number = 10): string {
  const summaries = db
    .select()
    .from(sessionSummaries)
    .where(eq(sessionSummaries.threadId, threadId))
    .orderBy(desc(sessionSummaries.lastMessageAt))
    .limit(limit)
    .all();

  if (summaries.length === 0) return '';

  // Reverse to chronological order
  summaries.reverse();

  const lines = ['## Previous Session Summaries'];
  for (const s of summaries) {
    lines.push('', s.content);
  }

  return lines.join('\n');
}

/**
 * Fire-and-forget: detect boundary and summarize if needed.
 * Call this after saving the user's message but before building the response.
 */
export function triggerSummarizationIfNeeded(threadId: string): void {
  const boundary = detectSessionBoundary(threadId);
  if (!boundary) return;

  console.log(`[session-summary] Session boundary detected for thread ${threadId}, summarizing ${boundary.messagesToSummarize.length} messages`);

  // Fire and forget — don't block the user's message
  generateAndStoreSummary(threadId, boundary.messagesToSummarize).catch(err => {
    console.error('[session-summary] Background summarization failed:', err);
  });
}

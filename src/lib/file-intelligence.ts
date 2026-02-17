/**
 * File Intelligence: Access Tracking & Auto-Generated Tags
 *
 * Manages sidecar JSON files per project:
 * - .clawdify/file-access-counts.json — tracks file read frequency
 * - .clawdify/file-tags.json — auto-generated keyword tags for .md files
 *
 * Part of Phase 3 of the tiered memory system.
 */

import fs from 'fs/promises';
import path from 'path';

// ---------------------------------------------------------------------------
// File Access Tracking
// ---------------------------------------------------------------------------

interface FileAccessCounts {
  [relativePath: string]: number;
}

/**
 * Get the path to the .clawdify directory for a project.
 * Creates the directory if it doesn't exist.
 */
async function ensureClawdifyDir(projectDir: string): Promise<string> {
  const dir = path.join(projectDir, '.clawdify');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Load file access counts for a project.
 */
export async function loadFileAccessCounts(projectDir: string): Promise<FileAccessCounts> {
  try {
    const filePath = path.join(projectDir, '.clawdify', 'file-access-counts.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as FileAccessCounts;
  } catch {
    return {};
  }
}

/**
 * Increment the access count for a file and persist.
 */
export async function incrementFileAccess(projectDir: string, relativePath: string): Promise<void> {
  const dir = await ensureClawdifyDir(projectDir);
  const filePath = path.join(dir, 'file-access-counts.json');

  const counts = await loadFileAccessCounts(projectDir);
  counts[relativePath] = (counts[relativePath] || 0) + 1;

  await fs.writeFile(filePath, JSON.stringify(counts, null, 2), 'utf-8');
}

/**
 * Get the top N most-accessed files for a project.
 */
export async function getTopAccessedFiles(
  projectDir: string,
  topN: number = 5,
): Promise<Array<{ path: string; count: number }>> {
  const counts = await loadFileAccessCounts(projectDir);
  return Object.entries(counts)
    .map(([p, count]) => ({ path: p, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// ---------------------------------------------------------------------------
// Auto-Generated File Tags (TF-IDF style)
// ---------------------------------------------------------------------------

interface FileTags {
  [relativePath: string]: string[];
}

// Common English stopwords to skip
const STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see',
  'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
  'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work',
  'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were', 'been', 'has',
  'had', 'does', 'did', 'being', 'having', 'doing', 'should', 'may', 'might',
  'must', 'shall', 'need', 'each', 'every', 'both', 'few', 'more', 'many',
  'such', 'here', 'where', 'why', 'very', 'still', 'own', 'same', 'much',
  'through', 'before', 'between', 'under', 'during', 'without', 'again',
  'once', 'used', 'using', 'file', 'files', 'example', 'using', 'based',
  // Markdown-specific noise
  'md', 'http', 'https', 'www', 'com', 'org', 'io', 'etc',
  'todo', 'note', 'notes', 'see', 'also', 'below', 'above',
]);

/**
 * Load file tags for a project.
 */
export async function loadFileTags(projectDir: string): Promise<FileTags> {
  try {
    const filePath = path.join(projectDir, '.clawdify', 'file-tags.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as FileTags;
  } catch {
    return {};
  }
}

/**
 * Save file tags for a project.
 */
async function saveFileTags(projectDir: string, tags: FileTags): Promise<void> {
  const dir = await ensureClawdifyDir(projectDir);
  const filePath = path.join(dir, 'file-tags.json');
  await fs.writeFile(filePath, JSON.stringify(tags, null, 2), 'utf-8');
}

/**
 * Extract top N distinctive words from file content using simple TF-IDF style scoring.
 * No LLM — pure word frequency analysis with stopword filtering.
 */
function extractDistinctiveWords(content: string, topN: number = 3): string[] {
  // Strip markdown syntax
  const cleaned = content
    .replace(/```[\s\S]*?```/g, '')       // code blocks
    .replace(/`[^`]+`/g, '')              // inline code
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
    .replace(/[#*_~>|[\](){}]/g, ' ')     // markdown chars
    .replace(/<!--[\s\S]*?-->/g, '')      // HTML comments
    .replace(/https?:\/\/\S+/g, '')       // URLs
    .toLowerCase();

  // Tokenize: extract words 3+ chars, alphanumeric + hyphens
  const words = cleaned.match(/[a-z][a-z0-9-]{2,}/g) || [];

  // Count frequencies
  const freq = new Map<string, number>();
  for (const word of words) {
    if (STOPWORDS.has(word)) continue;
    if (/^\d+$/.test(word)) continue; // skip pure numbers
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Score: frequency × inverse-commonality (prefer words that appear multiple times
  // but aren't too generic). Simple heuristic: freq * log(freq + 1) favors
  // moderately frequent words.
  const scored = Array.from(freq.entries())
    .filter(([, count]) => count >= 2) // must appear at least twice
    .map(([word, count]) => ({
      word,
      score: count * Math.log(count + 1),
    }))
    .sort((a, b) => b.score - a.score);

  // If we don't have enough words with freq >= 2, relax the constraint
  if (scored.length < topN) {
    const relaxed = Array.from(freq.entries())
      .map(([word, count]) => ({ word, score: count }))
      .sort((a, b) => b.score - a.score);
    return relaxed.slice(0, topN).map(s => s.word);
  }

  return scored.slice(0, topN).map(s => s.word);
}

/**
 * Generate simple keyword tags for a .md file.
 * Uses TF-IDF style word extraction — no LLM.
 */
export async function generateFileTags(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    if (content.length < 50) return []; // too short to tag meaningfully
    return extractDistinctiveWords(content, 3);
  } catch {
    return [];
  }
}

/**
 * Get or generate tags for a file within a project.
 * Caches results in .clawdify/file-tags.json.
 */
export async function getOrGenerateFileTags(
  projectDir: string,
  relativePath: string,
): Promise<string[]> {
  const tags = await loadFileTags(projectDir);

  if (tags[relativePath] && tags[relativePath].length > 0) {
    return tags[relativePath];
  }

  // Generate tags for .md files only
  if (!relativePath.toLowerCase().endsWith('.md')) return [];

  const fullPath = path.join(projectDir, relativePath);
  const generated = await generateFileTags(fullPath);

  if (generated.length > 0) {
    tags[relativePath] = generated;
    await saveFileTags(projectDir, tags);
  }

  return generated;
}

/**
 * Read the first 2-3 lines of a file (for hot file promotion in manifest).
 */
export async function readFirstLines(filePath: string, lineCount: number = 3): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n')
      .filter(l => l.trim().length > 0)
      .slice(0, lineCount);
    return lines.join('\n');
  } catch {
    return '';
  }
}

import { createClient } from '@/lib/supabase/client';
import type { DetectedArtifact } from './detector';

/**
 * Persist detected artifacts to Supabase.
 */
export async function persistArtifacts(
  projectId: string,
  messageId: string,
  artifacts: DetectedArtifact[],
): Promise<void> {
  if (artifacts.length === 0) return;

  const supabase = createClient();
  const rows = artifacts.map((a) => ({
    project_id: projectId,
    message_id: messageId,
    name: a.name,
    type: a.type,
    language: a.language ?? null,
    content: a.content,
  }));

  const { error } = await supabase.from('artifacts').insert(rows);
  if (error) {
    console.error('Failed to persist artifacts:', error);
  }
}

/**
 * Load artifacts from Supabase for a project.
 */
export async function loadPersistedArtifacts(
  projectId: string,
): Promise<DetectedArtifact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as DetectedArtifact['type'],
    name: row.name as string,
    language: (row.language as string) ?? undefined,
    content: row.content as string,
    startOffset: 0,
    endOffset: 0,
  }));
}

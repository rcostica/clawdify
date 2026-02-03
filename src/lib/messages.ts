import { createClient } from '@/lib/supabase/client';
import type { ChatMessage } from '@/stores/chat-store';

export async function persistMessage(
  projectId: string,
  message: ChatMessage,
): Promise<void> {
  const supabase = createClient();
  await supabase.from('messages').insert({
    project_id: projectId,
    role: message.role,
    content: message.content,
    tool_calls: message.toolCalls ?? [],
    run_id: message.runId,
    metadata: message.metadata ?? {},
  });
}

export async function loadPersistedMessages(
  projectId: string,
): Promise<ChatMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(200);

  return (data ?? []).map(
    (row: Record<string, unknown>) =>
      ({
        id: row.id as string,
        role: row.role as ChatMessage['role'],
        content: row.content as string,
        toolCalls: row.tool_calls as unknown[] | undefined,
        runId: row.run_id as string | undefined,
        metadata: row.metadata as Record<string, unknown> | undefined,
        createdAt: row.created_at as string,
      }) satisfies ChatMessage,
  );
}

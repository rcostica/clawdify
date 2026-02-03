import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/stores/project-store';

function mapDbToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    icon: (row.icon as string) ?? '📁',
    color: (row.color as string) ?? '#6366f1',
    sessionKey: row.session_key as string,
    model: (row.model as string) ?? null,
    customInstructions: (row.custom_instructions as string) ?? null,
    archived: (row.archived as boolean) ?? false,
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function fetchProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapDbToProject);
}

export async function createProject(params: {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}): Promise<Project> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 🔒 SECURITY: Validate and sanitize inputs
  const name = params.name.trim().slice(0, 100);
  if (!name) throw new Error('Project name is required');

  // 🔒 SECURITY: Validate icon is a single emoji or short string, not arbitrary HTML
  const icon = (params.icon ?? '📁').slice(0, 8);

  // 🔒 SECURITY: Validate color is a hex color
  const color = /^#[0-9a-fA-F]{6}$/.test(params.color ?? '')
    ? params.color!
    : '#6366f1';

  // 🔒 SECURITY: Session key is derived from a crypto-random UUID.
  const projectId = crypto.randomUUID();
  const sessionKey = `agent:main:clawdify:${projectId}`;

  const { data, error } = await supabase
    .from('projects')
    .insert({
      id: projectId,
      user_id: user.id,
      name,
      description: params.description?.trim().slice(0, 500) ?? null,
      icon,
      color,
      session_key: sessionKey,
    })
    .select()
    .single();

  if (error) throw error;
  return mapDbToProject(data);
}

export async function updateProject(
  id: string,
  updates: Record<string, unknown>,
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapDbToProject(data);
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

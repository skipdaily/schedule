import { createClient } from '@supabase/supabase-js';
import { Project } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseEnv) {
  console.error('Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = hasSupabaseEnv ? createClient(supabaseUrl as string, supabaseAnonKey as string) : null;

export const fetchProjects = async (): Promise<Project[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('projects').select('id,data');
  if (error) {
    console.error('Failed to fetch projects', error);
    return [];
  }
  return (data || []).map(row => row.data as Project).filter(Boolean);
};

export const upsertProject = async (project: Project): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase
    .from('projects')
    .upsert({ id: project.id, data: project, updated_at: new Date().toISOString() });
  if (error) {
    console.error('Failed to upsert project', error);
  }
};

export const deleteProject = async (projectId: string): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) {
    console.error('Failed to delete project', error);
  }
};

export const fetchAppState = async (): Promise<string | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_state')
    .select('current_project_id')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.error('Failed to fetch app_state', error);
    return null;
  }
  return data?.current_project_id ?? null;
};

export const saveAppState = async (currentProjectId: string | null): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase
    .from('app_state')
    .upsert({ id: 1, current_project_id: currentProjectId, updated_at: new Date().toISOString() });
  if (error) {
    console.error('Failed to save app_state', error);
  }
};

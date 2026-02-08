import { create } from 'zustand';
import type { Project } from '@/lib/db/schema';

interface ProjectsState {
  projects: Project[];
  selectedProjectId: string | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  setProjects: (projects: Project[]) => void;
  selectProject: (id: string | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  selectedProjectId: null,
  loading: true,
  error: null,

  setProjects: (projects) => set({ projects, loading: false }),
  
  selectProject: (id) => set({ selectedProjectId: id }),
  
  addProject: (project) => 
    set((state) => ({ projects: [...state.projects, project] })),
  
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  
  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
    })),
  
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

// Helper to get project tree (nested structure)
export function buildProjectTree(projects: Project[]): (Project & { children: Project[] })[] {
  const projectMap = new Map<string, Project & { children: Project[] }>();
  const roots: (Project & { children: Project[] })[] = [];

  // First pass: create entries
  projects.forEach((p) => {
    projectMap.set(p.id, { ...p, children: [] });
  });

  // Second pass: build tree
  projects.forEach((p) => {
    const node = projectMap.get(p.id)!;
    if (p.parentId && projectMap.has(p.parentId)) {
      projectMap.get(p.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

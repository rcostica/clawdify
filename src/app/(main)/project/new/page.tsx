'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectsStore } from '@/lib/stores/projects';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Project } from '@/lib/db/schema';

const EMOJI_OPTIONS = ['📁', '🚀', '💡', '📊', '🎯', '🔧', '📝', '🎨', '💰', '🔬', '📱', '🌐'];

export default function NewProjectPage() {
  return (
    <Suspense>
      <NewProjectForm />
    </Suspense>
  );
}

function NewProjectForm() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📁');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parentProject, setParentProject] = useState<Project | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addProject } = useProjectsStore();

  const parentId = searchParams.get('parentId');

  // Fetch parent project info if parentId is present
  useEffect(() => {
    if (parentId) {
      fetch(`/api/projects/${parentId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.project) setParentProject(data.project);
        })
        .catch(console.error);
    }
  }, [parentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          icon,
          ...(parentId ? { parentId } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      addProject(data.project);
      toast.success(`${parentId ? 'Sub-project' : 'Project'} "${data.project.name}" created`);
      router.push(`/project/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>
            {parentId ? 'Create Sub-Project' : 'Create New Project'}
          </CardTitle>
          <CardDescription>
            {parentId && parentProject ? (
              <span className="flex items-center gap-1 mt-1">
                Creating sub-project of{' '}
                <Link
                  href={`/project/${parentProject.id}`}
                  className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                >
                  <span>{parentProject.icon || '📁'}</span>
                  {parentProject.name}
                </Link>
              </span>
            ) : (
              'Projects help organize your conversations, files, and tasks'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Parent breadcrumb */}
            {parentProject && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                <span>{parentProject.icon || '📁'}</span>
                <Link href={`/project/${parentProject.id}`} className="hover:underline">
                  {parentProject.name}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-foreground font-medium">{name || 'New sub-project'}</span>
              </div>
            )}

            {/* Icon Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Icon</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`w-10 h-10 text-xl rounded-md border-2 transition-colors ${
                      icon === emoji
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent hover:bg-muted'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                {parentId ? 'Sub-Project Name' : 'Project Name'} <span className="text-destructive">*</span>
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={parentId ? 'e.g., Frontend, API, Docs' : 'e.g., Airdrop Platform'}
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the project"
              />
            </div>

            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !name.trim()}>
                {loading ? 'Creating...' : parentId ? 'Create Sub-Project' : 'Create Project'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

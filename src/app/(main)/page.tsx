import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome to Clawdify 🐒</h1>
        <p className="text-muted-foreground mt-1">
          Your Mission Control for OpenClaw
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>📁</span> Projects
            </CardTitle>
            <CardDescription>
              Organize your work into projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/project/new" 
              className="text-primary hover:underline"
            >
              Create your first project →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>💬</span> Chat
            </CardTitle>
            <CardDescription>
              Talk to your agent with project context
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Select a project to start chatting
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>📋</span> Kanban
            </CardTitle>
            <CardDescription>
              Track tasks and projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/kanban" 
              className="text-primary hover:underline"
            >
              Open Kanban board →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>📂</span> Files
            </CardTitle>
            <CardDescription>
              Browse your workspace files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/files" 
              className="text-primary hover:underline"
            >
              Browse files →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🔌</span> Gateway
            </CardTitle>
            <CardDescription>
              OpenClaw Gateway status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connected to localhost:18789
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>⚙️</span> Settings
            </CardTitle>
            <CardDescription>
              Configure Clawdify
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/settings" 
              className="text-primary hover:underline"
            >
              Open settings →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

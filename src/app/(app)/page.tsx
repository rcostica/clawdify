import { MessageSquarePlus } from 'lucide-react';

export default function AppHomePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <MessageSquarePlus className="h-16 w-16 opacity-30" />
      <h2 className="text-xl font-semibold">Welcome to Clawdify</h2>
      <p className="max-w-md text-center text-sm">
        Select a project from the sidebar or create a new one to start
        chatting with your AI agent.
      </p>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { MessageSquare, CheckSquare, FolderOpen } from "lucide-react";

export type ProjectMobileTab = "chat" | "tasks" | "files";

interface ProjectMobileTabsProps {
  activeTab: ProjectMobileTab;
  onTabChange: (tab: ProjectMobileTab) => void;
  unreadMessages?: boolean;
}

const tabs: { key: ProjectMobileTab; icon: typeof MessageSquare; label: string }[] = [
  { key: "chat", icon: MessageSquare, label: "Chat" },
  { key: "tasks", icon: CheckSquare, label: "Tasks" },
  { key: "files", icon: FolderOpen, label: "Files" },
];

export function ProjectMobileTabs({
  activeTab,
  onTabChange,
  unreadMessages = false,
}: ProjectMobileTabsProps) {
  return (
    <div className="flex lg:hidden border-b bg-background">
      {tabs.map(({ key, icon: Icon, label }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors relative",
              isActive
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            {key === "chat" && unreadMessages && !isActive && (
              <span className="absolute top-1.5 right-1/4 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}

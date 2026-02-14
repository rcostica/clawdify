import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { SearchModal } from '@/components/search-modal';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { MobileNav } from '@/components/mobile-nav';
import { SearchTrigger } from '@/components/search-trigger';
import { NotificationPermission } from '@/components/notification-permission';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1" />
          <SearchTrigger />
        </header>
        <main className="flex-1 overflow-hidden pb-16 md:pb-0 min-w-0">
          {children}
        </main>
      </SidebarInset>
      <MobileNav />
      <SearchModal />
      <KeyboardShortcuts />
      <NotificationPermission />
    </SidebarProvider>
  );
}

'use client';

import { Suspense } from 'react';
import { Sidebar } from '@/components/sidebar/sidebar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { GatewayProvider } from '@/components/gateway-provider';
import { QuickConnectHandler } from '@/components/quick-connect-handler';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <GatewayProvider>
      <Suspense fallback={null}>
        <QuickConnectHandler />
      </Suspense>
      <div className="flex h-dvh overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        {/* Mobile sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-2 top-2 z-40 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </GatewayProvider>
  );
}

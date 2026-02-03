'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGatewayStore } from '@/stores/gateway-store';
import { validateGatewayUrl } from '@/lib/gateway/types';

/**
 * Handles quick-connect URLs: ?gatewayUrl=...&token=...
 *
 * 🔒 SECURITY: Token is stripped from URL immediately on load to prevent
 * leakage via browser history, Referer headers, and extensions.
 */
export function QuickConnectHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setConfig = useGatewayStore((s) => s.setConfig);

  useEffect(() => {
    const gatewayUrl = searchParams.get('gatewayUrl');
    const token = searchParams.get('token');

    if (gatewayUrl) {
      // 🔒 SECURITY: Validate the URL before accepting it
      const validation = validateGatewayUrl(gatewayUrl);
      if (!validation.valid) {
        console.warn(
          '[quick-connect] Invalid gateway URL:',
          validation.error,
        );
      } else {
        // Set config in memory (token stays in Zustand memory, NOT localStorage)
        setConfig({
          url: gatewayUrl,
          token: token ?? undefined,
          insecureAuth: searchParams.get('insecure') === '1',
        });

        // 🔒 SECURITY: Persist to Supabase encrypted so token doesn't stay in URL/memory
        if (token) {
          import('@/lib/supabase/client').then(async ({ createClient }) => {
            const supabase = createClient();
            const { error } = await supabase
              .rpc('save_gateway_connection', {
                p_name: 'Default',
                p_gateway_url: gatewayUrl,
                p_gateway_token: token,
              });
            if (error) console.error('Failed to save connection:', error);
          });
        }
      }

      // 🔒 SECURITY: Strip sensitive params from URL IMMEDIATELY.
      const url = new URL(window.location.href);
      url.searchParams.delete('gatewayUrl');
      url.searchParams.delete('token');
      url.searchParams.delete('insecure');
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, setConfig, router]);

  return null;
}

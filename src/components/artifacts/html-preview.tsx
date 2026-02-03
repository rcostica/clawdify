'use client';

/**
 * 🔒 SECURITY: HTML Preview uses a heavily sandboxed iframe.
 *
 * NEVER add 'allow-same-origin' to the sandbox. With allow-same-origin,
 * scripts inside the iframe can access the parent page's cookies, localStorage,
 * and Supabase auth tokens.
 *
 * The sandbox attribute set is:
 * - allow-scripts: Let the HTML run JavaScript (needed for interactive previews)
 *
 * Explicitly BLOCKED by omission:
 * - allow-same-origin: Blocks access to parent page's origin/storage/cookies
 * - allow-forms: Blocks form submission
 * - allow-popups: Blocks window.open()
 * - allow-top-navigation: Blocks redirecting the parent page
 * - allow-modals: Blocks alert(), confirm(), prompt()
 */

function wrapWithCSP(html: string): string {
  // 🔒 Inject a Content-Security-Policy meta tag that restricts the iframe content
  const cspTag = `<meta http-equiv="Content-Security-Policy" content="${[
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval'",
    "style-src 'unsafe-inline'",
    "img-src data: https:",
    "connect-src 'none'",
    "font-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
  ].join('; ')}">`;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${cspTag}</head>`);
  }
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${cspTag}`);
  }
  return `<head>${cspTag}</head>${html}`;
}

export function HtmlPreview({ content }: { content: string }) {
  const safeContent = wrapWithCSP(content);

  return (
    <iframe
      srcDoc={safeContent}
      sandbox="allow-scripts"
      className="w-full h-full border-0 bg-white rounded"
      title="HTML Preview"
      allow=""
      referrerPolicy="no-referrer"
    />
  );
}

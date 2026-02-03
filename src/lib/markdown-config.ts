import { defaultSchema } from 'hast-util-sanitize';
import type { Schema } from 'hast-util-sanitize';

/**
 * 🔒 SECURITY: Custom sanitization schema for assistant messages.
 * Start from the GitHub-flavored default and REMOVE dangerous elements.
 * This prevents XSS from AI-generated or compromised gateway content.
 */
export const sanitizeSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow class names for syntax highlighting (rehype-highlight)
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className'],
    // 🔒 Block all event handler attributes globally
    '*': (defaultSchema.attributes?.['*'] ?? []).filter(
      (attr) => typeof attr !== 'string' || !attr.startsWith('on'),
    ),
  },
  // 🔒 Remove dangerous tags that could execute scripts
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (tag) =>
      ![
        'script',
        'style',
        'iframe',
        'object',
        'embed',
        'form',
        'input',
        'textarea',
        'button',
        'select',
      ].includes(tag),
  ),
  // 🔒 Only allow safe URL protocols in links and images
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
};

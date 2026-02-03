export interface DetectedArtifact {
  id: string;
  type: 'html' | 'markdown' | 'code' | 'image';
  name: string;
  language?: string;
  content: string;
  startOffset: number;
  endOffset: number;
}

const PREVIEWABLE_LANGUAGES = new Set([
  'html', 'css', 'javascript', 'typescript', 'jsx', 'tsx',
  'python', 'json', 'yaml', 'toml', 'xml', 'sql',
  'markdown', 'md', 'bash', 'sh', 'shell',
  'rust', 'go', 'java', 'c', 'cpp', 'ruby', 'php',
  'swift', 'kotlin', 'dart', 'svelte', 'vue',
]);

export function detectArtifacts(content: string): DetectedArtifact[] {
  const artifacts: DetectedArtifact[] = [];

  // Detect fenced code blocks with language
  const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1]!.toLowerCase();
    const code = match[2]!.trim();

    if (code.length < 20) continue;
    if (!PREVIEWABLE_LANGUAGES.has(language)) continue;

    const type =
      language === 'html'
        ? 'html'
        : language === 'markdown' || language === 'md'
          ? 'markdown'
          : 'code';

    const ext =
      language === 'typescript'
        ? 'ts'
        : language === 'javascript'
          ? 'js'
          : language === 'python'
            ? 'py'
            : language;

    artifacts.push({
      id: crypto.randomUUID(),
      type,
      name: `snippet.${ext}`,
      language,
      content: code,
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    });
  }

  // Detect base64 images
  const imgRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
  while ((match = imgRegex.exec(content)) !== null) {
    artifacts.push({
      id: crypto.randomUUID(),
      type: 'image',
      name: match[1] || 'image',
      content: match[2]!,
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    });
  }

  return artifacts;
}

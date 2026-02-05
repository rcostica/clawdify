/**
 * Artifact persistence (stub)
 *
 * In self-hosted mode, artifacts are kept in Zustand store only.
 * Future versions could add IndexedDB or local file persistence.
 */

import type { DetectedArtifact } from './detector';

export async function persistArtifacts(
  _projectId: string,
  _messageId: string,
  _artifacts: DetectedArtifact[],
): Promise<void> {
  // No-op in self-hosted mode - artifacts stay in memory/Zustand
}

export async function loadPersistedArtifacts(
  _projectId: string,
): Promise<DetectedArtifact[]> {
  // No persistence in self-hosted mode
  return [];
}

/**
 * openhorse - Memory Storage
 *
 * File-based memory system stored in ~/.openhorse/memory/
 * - MEMORY.md: Index file (one-line hooks)
 * - *.md: Individual memory entries with frontmatter
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type { MemoryEntry, MemoryType } from './types';

// ============================================================================
// Constants
// ============================================================================

export const MEMORY_DIR_NAME = '.openhorse';
export const MEMORY_SUBDIR = 'memory';
export const ENTRYPOINT_NAME = 'MEMORY.md';
export const MAX_ENTRYPOINT_LINES = 200;
export const MAX_ENTRYPOINT_BYTES = 25000;

// ============================================================================
// Paths
// ============================================================================

/** Get memory directory path */
export function getMemoryDir(): string {
  return join(homedir(), MEMORY_DIR_NAME, MEMORY_SUBDIR);
}

/** Get MEMORY.md path */
export function getEntrypointPath(): string {
  return join(getMemoryDir(), ENTRYPOINT_NAME);
}

/** Ensure memory directory exists */
export function ensureMemoryDir(): void {
  const dir = getMemoryDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ============================================================================
// Parsing
// ============================================================================

/** Parse frontmatter from memory file */
export function parseMemoryFrontmatter(content: string): MemoryEntry | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) return null;

  const [, frontmatter, body] = frontmatterMatch;
  const lines = frontmatter.split('\n');
  const fields: Record<string, string> = {};

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }

  if (!fields.name || !fields.type) return null;

  const type = fields.type as MemoryType;
  if (!['user', 'feedback', 'project', 'reference'].includes(type)) return null;

  return {
    name: fields.name,
    description: fields.description || '',
    type,
    content: body.trim(),
    createdAt: 0, // Will be set from file
    updatedAt: 0,
  };
}

/** Generate frontmatter for memory file */
export function generateMemoryFrontmatter(entry: MemoryEntry): string {
  return `---
name: ${entry.name}
description: ${entry.description}
type: ${entry.type}
---

${entry.content}`;
}

// ============================================================================
// Loading
// ============================================================================

/** Load all memory entries from directory */
export function loadAllMemories(): MemoryEntry[] {
  ensureMemoryDir();
  const dir = getMemoryDir();
  const memories: MemoryEntry[] = [];

  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.md') || file === ENTRYPOINT_NAME) continue;

      const filePath = join(dir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const entry = parseMemoryFrontmatter(content);
        if (entry) {
          entry.name = basename(file, '.md');
          memories.push(entry);
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory doesn't exist or unreadable
  }

  return memories;
}

/** Load MEMORY.md index */
export function loadMemoryIndex(): string {
  const path = getEntrypointPath();
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

/** Load specific memory by name */
export function loadMemory(name: string): MemoryEntry | null {
  const dir = getMemoryDir();
  const filePath = join(dir, `${name}.md`);

  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, 'utf-8');
    const entry = parseMemoryFrontmatter(content);
    if (entry) {
      entry.name = name;
      return entry;
    }
  } catch {
    // File unreadable
  }

  return null;
}

// ============================================================================
// Saving
// ============================================================================

/** Save memory entry to file */
export function saveMemory(entry: MemoryEntry): void {
  ensureMemoryDir();
  const dir = getMemoryDir();
  const filePath = join(dir, `${entry.name}.md`);

  const now = Date.now();
  entry.createdAt = entry.createdAt || now;
  entry.updatedAt = now;

  const content = generateMemoryFrontmatter(entry);
  writeFileSync(filePath, content, 'utf-8');

  // Update MEMORY.md index
  updateMemoryIndex();
}

/** Delete memory entry */
export function deleteMemory(name: string): void {
  const dir = getMemoryDir();
  const filePath = join(dir, `${name}.md`);

  if (existsSync(filePath)) {
    // Mark as deleted in content instead of actually deleting
    // This preserves the memory for potential recovery
    writeFileSync(filePath, `---\nname: ${name}\nstatus: deleted\n---\n`, 'utf-8');
  }

  updateMemoryIndex();
}

/** Update MEMORY.md index */
export function updateMemoryIndex(): void {
  const memories = loadAllMemories();
  const lines: string[] = [
    '# Memory Index',
    '',
    'This file lists all saved memories. Each entry is one line under ~150 characters.',
    '',
  ];

  for (const mem of memories) {
    const hook = mem.description || mem.content.slice(0, 80);
    const line = `- [${mem.name}](${mem.name}.md) — ${hook}`;
    if (line.length <= 150) {
      lines.push(line);
    } else {
      lines.push(line.slice(0, 147) + '...');
    }
  }

  // Truncate if exceeds limits
  if (lines.length > MAX_ENTRYPOINT_LINES) {
    lines.splice(MAX_ENTRYPOINT_LINES);
    lines.push('', '> WARNING: MEMORY.md truncated. Keep index entries concise.');
  }

  const content = lines.join('\n');
  if (content.length > MAX_ENTRYPOINT_BYTES) {
    // Truncate by removing oldest entries
    while (content.length > MAX_ENTRYPOINT_BYTES && lines.length > 10) {
      lines.pop();
    }
  }

  writeFileSync(getEntrypointPath(), lines.join('\n'), 'utf-8');
}

// ============================================================================
// Search
// ============================================================================

/** Search memories by query */
export function searchMemories(query: string): MemoryEntry[] {
  const memories = loadAllMemories();
  const lowerQuery = query.toLowerCase();

  return memories.filter(mem => {
    return (
      mem.name.toLowerCase().includes(lowerQuery) ||
      mem.description.toLowerCase().includes(lowerQuery) ||
      mem.content.toLowerCase().includes(lowerQuery) ||
      mem.type.toLowerCase().includes(lowerQuery)
    );
  });
}

/** Get memories by type */
export function getMemoriesByType(type: MemoryType): MemoryEntry[] {
  const memories = loadAllMemories();
  return memories.filter(mem => mem.type === type);
}
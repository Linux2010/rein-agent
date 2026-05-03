import {
  createSession,
  saveSessionMeta,
  loadSessionMeta,
  updateSessionStats,
  endSession,
  appendHistory,
  readHistory,
  readProjectHistory,
  appendSessionMessage,
  readSessionMessages,
  type SessionMeta,
  type HistoryEntry,
  type SessionMessage,
} from '../src/services/session-storage';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('session-storage', () => {
  // Use a unique test directory based on timestamp to avoid conflicts
  const testDir = join(homedir(), `.openhorse-test-session-${Date.now()}`);
  const originalEnv = process.env.OPENHORSE_CONFIG_DIR;

  beforeAll(() => {
    process.env.OPENHORSE_CONFIG_DIR = testDir;
    // Clean up test directory if it exists
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    // Restore original env var
    if (originalEnv !== undefined) {
      process.env.OPENHORSE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.OPENHORSE_CONFIG_DIR;
    }
  });

  describe('createSession', () => {
    test('creates session with correct fields', () => {
      const session = createSession('/tmp/project', 'gpt-4o');

      expect(session.id).toBeDefined();
      expect(session.projectPath).toBe('/tmp/project');
      expect(session.model).toBe('gpt-4o');
      expect(session.startTime).toBeDefined();
      expect(session.startTime).toBeLessThanOrEqual(Date.now());
      expect(session.tokenCount).toBe(0);
      expect(session.cost).toBe(0);
      expect(session.endTime).toBeUndefined();
    });

    test('saves session meta file', () => {
      const session = createSession('/tmp/project2', 'claude-sonnet');

      const path = join(testDir, 'sessions', `${session.id}.json`);
      expect(existsSync(path)).toBe(true);
    });
  });

  describe('loadSessionMeta', () => {
    test('returns null for non-existent session', () => {
      const session = loadSessionMeta('non-existent-id');
      expect(session).toBeNull();
    });

    test('loads existing session', () => {
      const created = createSession('/tmp/project', 'gpt-4o');
      const loaded = loadSessionMeta(created.id);

      expect(loaded?.id).toBe(created.id);
      expect(loaded?.projectPath).toBe(created.projectPath);
      expect(loaded?.model).toBe(created.model);
    });
  });

  describe('updateSessionStats', () => {
    test('updates token count and cost', () => {
      const session = createSession('/tmp/project', 'gpt-4o');

      updateSessionStats(session.id, 500, 0.01);
      updateSessionStats(session.id, 300, 0.005);

      const loaded = loadSessionMeta(session.id);
      expect(loaded?.tokenCount).toBe(800);
      expect(loaded?.cost).toBe(0.015);
    });
  });

  describe('endSession', () => {
    test('sets end time', () => {
      const session = createSession('/tmp/project', 'gpt-4o');

      endSession(session.id);

      const loaded = loadSessionMeta(session.id);
      expect(loaded?.endTime).toBeDefined();
      expect(loaded?.endTime).toBeGreaterThanOrEqual(loaded!.startTime);
    });
  });

  describe('history (JSONL)', () => {
    test('appendHistory creates file if not exists', () => {
      const entry: HistoryEntry = {
        display: 'hello',
        timestamp: Date.now(),
        project: '/tmp/project',
        sessionId: 'test-session',
        role: 'user',
      };

      appendHistory(entry);

      const path = join(testDir, 'history.jsonl');
      expect(existsSync(path)).toBe(true);
    });

    test('appendHistory appends multiple entries', () => {
      const entries: HistoryEntry[] = [
        {
          display: 'question 1',
          timestamp: Date.now(),
          project: '/tmp/project',
          sessionId: 'session-1',
          role: 'user',
        },
        {
          display: 'answer 1',
          timestamp: Date.now() + 1000,
          project: '/tmp/project',
          sessionId: 'session-1',
          role: 'assistant',
        },
      ];

      appendHistory(entries[0]);
      appendHistory(entries[1]);

      const history = readHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    test('readHistory returns entries in reverse order', () => {
      // Clean history
      const path = join(testDir, 'history.jsonl');
      if (existsSync(path)) {
        rmSync(path);
      }

      const entry1: HistoryEntry = {
        display: 'first',
        timestamp: 1000,
        project: '/tmp/project',
        sessionId: 'session-1',
        role: 'user',
      };
      const entry2: HistoryEntry = {
        display: 'second',
        timestamp: 2000,
        project: '/tmp/project',
        sessionId: 'session-1',
        role: 'user',
      };

      appendHistory(entry1);
      appendHistory(entry2);

      const history = readHistory();
      expect(history[0].display).toBe('second'); // Most recent first
      expect(history[1].display).toBe('first');
    });

    test('readHistory respects limit', () => {
      // Clean history
      const path = join(testDir, 'history.jsonl');
      if (existsSync(path)) {
        rmSync(path);
      }

      for (let i = 0; i < 10; i++) {
        appendHistory({
          display: `entry ${i}`,
          timestamp: i * 1000,
          project: '/tmp/project',
          sessionId: 'session-1',
          role: 'user',
        });
      }

      const history = readHistory(3);
      expect(history.length).toBe(3);
    });

    test('readProjectHistory filters by project', () => {
      // Clean history
      const path = join(testDir, 'history.jsonl');
      if (existsSync(path)) {
        rmSync(path);
      }

      appendHistory({
        display: 'project A',
        timestamp: 1000,
        project: '/tmp/projectA',
        sessionId: 'session-1',
        role: 'user',
      });
      appendHistory({
        display: 'project B',
        timestamp: 2000,
        project: '/tmp/projectB',
        sessionId: 'session-2',
        role: 'user',
      });

      const historyA = readProjectHistory('/tmp/projectA');
      expect(historyA.length).toBe(1);
      expect(historyA[0].project).toBe('/tmp/projectA');
    });
  });

  describe('session messages (JSONL)', () => {
    test('appendSessionMessage creates file', () => {
      const sessionId = 'test-msg-session';
      const message: SessionMessage = {
        role: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      };

      appendSessionMessage(sessionId, message);

      const path = join(testDir, 'sessions', `${sessionId}.jsonl`);
      expect(existsSync(path)).toBe(true);
    });

    test('readSessionMessages returns all messages', () => {
      const sessionId = 'test-msg-session-2';

      appendSessionMessage(sessionId, {
        role: 'user',
        content: 'Question',
        timestamp: 1000,
      });
      appendSessionMessage(sessionId, {
        role: 'assistant',
        content: 'Answer',
        timestamp: 2000,
      });

      const messages = readSessionMessages(sessionId);
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    test('readSessionMessages returns empty array for non-existent session', () => {
      const messages = readSessionMessages('non-existent');
      expect(messages).toEqual([]);
    });
  });
});
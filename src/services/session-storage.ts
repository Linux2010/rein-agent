/**
 * openhorse - 会话存储
 *
 * 使用 JSONL 格式存储会话历史和对话记录。
 * 参考 OpenClaude 的 history.jsonl 和 sessions/ 目录。
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { ensureConfigDir, getHistoryPath, getSessionMetaPath, getSessionMessagesPath, getSessionsDir } from './config-dir';

// ============================================================================
// 类型定义
// ============================================================================

/** 会话元数据 */
export interface SessionMeta {
  /** 会话 ID */
  id: string;
  /** 项目路径 */
  projectPath: string;
  /** 使用的模型 */
  model: string;
  /** 开始时间 (timestamp ms) */
  startTime: number;
  /** 结束时间 (timestamp ms) */
  endTime?: number;
  /** token 数 */
  tokenCount: number;
  /** 成本 (USD) */
  cost: number;
}

/** 历史记录条目 */
export interface HistoryEntry {
  /** 显示文本 */
  display: string;
  /** 时间戳 (ms) */
  timestamp: number;
  /** 项目路径 */
  project: string;
  /** 会话 ID */
  sessionId: string;
  /** 角色 */
  role: 'user' | 'assistant';
}

/** 对话消息 */
export interface SessionMessage {
  /** 角色 */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** 内容 */
  content: string;
  /** 时间戳 (ms) */
  timestamp: number;
  /** 工具调用 ID (tool role) */
  toolCallId?: string;
}

// ============================================================================
// 会话管理
// ============================================================================

/**
 * 创建新会话
 */
export function createSession(projectPath: string, model: string): SessionMeta {
  ensureConfigDir();

  const session: SessionMeta = {
    id: randomUUID(),
    projectPath,
    model,
    startTime: Date.now(),
    tokenCount: 0,
    cost: 0,
  };

  saveSessionMeta(session);
  return session;
}

/**
 * 保存会话元数据
 */
export function saveSessionMeta(session: SessionMeta): void {
  ensureConfigDir();
  const path = getSessionMetaPath(session.id);
  writeFileSync(path, JSON.stringify(session, null, 2), { mode: 0o600 });
}

/**
 * 加载会话元数据
 */
export function loadSessionMeta(sessionId: string): SessionMeta | null {
  const path = getSessionMetaPath(sessionId);

  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as SessionMeta;
  } catch {
    return null;
  }
}

/**
 * 更新会话统计
 */
export function updateSessionStats(sessionId: string, tokens: number, cost: number): void {
  const session = loadSessionMeta(sessionId);
  if (!session) return;

  session.tokenCount += tokens;
  session.cost += cost;
  saveSessionMeta(session);
}

/**
 * 结束会话
 */
export function endSession(sessionId: string): void {
  const session = loadSessionMeta(sessionId);
  if (!session) return;

  session.endTime = Date.now();
  saveSessionMeta(session);
}

/**
 * 获取项目最近的会话
 */
export function getLastSession(projectPath: string): SessionMeta | null {
  ensureConfigDir();
  const sessionsDir = getSessionsDir();

  if (!existsSync(sessionsDir)) {
    return null;
  }

  // 遍历所有会话文件，找到该项目路径最近的
  const files = readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

  let latest: SessionMeta | null = null;
  for (const file of files) {
    try {
      const content = readFileSync(join(sessionsDir, file), 'utf-8');
      const session = JSON.parse(content) as SessionMeta;
      if (session.projectPath === projectPath) {
        if (!latest || session.startTime > latest.startTime) {
          latest = session;
        }
      }
    } catch {
      // ignore
    }
  }

  return latest;
}

// ============================================================================
// 历史记录 (JSONL)
// ============================================================================

/**
 * 追加历史记录
 */
export function appendHistory(entry: HistoryEntry): void {
  ensureConfigDir();
  const path = getHistoryPath();
  const line = JSON.stringify(entry) + '\n';
  appendFileSync(path, line, { mode: 0o600 });
}

/**
 * 读取历史记录
 * @param limit 最大条数（从最新开始）
 */
export function readHistory(limit?: number): HistoryEntry[] {
  const path = getHistoryPath();

  if (!existsSync(path)) {
    return [];
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries = lines.map(line => JSON.parse(line) as HistoryEntry);

    // 从最新开始
    const reversed = entries.reverse();
    return limit ? reversed.slice(0, limit) : reversed;
  } catch {
    return [];
  }
}

/**
 * 按项目过滤历史记录
 */
export function readProjectHistory(projectPath: string, limit?: number): HistoryEntry[] {
  const all = readHistory();
  const filtered = all.filter(e => e.project === projectPath);
  return limit ? filtered.slice(0, limit) : filtered;
}

// ============================================================================
// 会话对话记录 (JSONL)
// ============================================================================

/**
 * 追加会话消息
 */
export function appendSessionMessage(sessionId: string, message: SessionMessage): void {
  ensureConfigDir();
  const path = getSessionMessagesPath(sessionId);
  const line = JSON.stringify(message) + '\n';
  appendFileSync(path, line, { mode: 0o600 });
}

/**
 * 追加多条会话消息
 */
export function appendSessionMessages(sessionId: string, messages: SessionMessage[]): void {
  ensureConfigDir();
  const path = getSessionMessagesPath(sessionId);
  const lines = messages.map(m => JSON.stringify(m)).join('\n') + '\n';
  appendFileSync(path, lines, { mode: 0o600 });
}

/**
 * 读取会话消息
 */
export function readSessionMessages(sessionId: string): SessionMessage[] {
  const path = getSessionMessagesPath(sessionId);

  if (!existsSync(path)) {
    return [];
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.map(line => JSON.parse(line) as SessionMessage);
  } catch {
    return [];
  }
}


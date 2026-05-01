/**
 * rein-agent - 通用 Agent 智能体框架
 *
 * 公共 API 导出入口
 */

// 核心
export { Brain } from './core/brain';
export type { BrainConfig } from './core/brain';

export { BaseAgent } from './core/agent';
export type { AgentConfig, Task, TaskResult, AgentStatus } from './core/agent';

// Agent 实现
export { LeaderAgent } from './agents/leader';
export { CoderAgent } from './agents/coder';

// 初始化与运行时
export { init, Harness, MemorySystem } from './init';
export type {
  ReinConfig,
  ReinRuntime,
  HarnessConfig,
  MemoryConfig,
  SafetyConfig,
  HarnessVerdict,
  AgentRegistryEntry,
  MemoryEntry as InitMemoryEntry,
  MemoryTier as InitMemoryTier,
} from './init';

// Harness 安全模块
export { SafetyChecker } from './harness/safety';
export type { SafetyPolicy, SafetyCheck, SecurityLevel, AuditLogEntry } from './harness/safety';

// Memory 存储模块
export { MemoryStore } from './memory/store';
export type {
  MemoryStoreConfig,
  MemoryEntry as StoreMemoryEntry,
  MemoryTier as StoreMemoryTier,
  MemoryQuery,
} from './memory/store';

/**
 * x-agent - Agent 基类
 * 
 * 所有 Agent 的基础类，提供统一的生命周期管理和能力接口
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  maxRetries?: number;
  timeout?: number;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2';
  assignedTo: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  params?: Record<string, any>;
}

export abstract class BaseAgent extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly capabilities: string[];
  
  protected maxRetries: number;
  protected timeout: number;
  protected status: 'idle' | 'working' | 'error' = 'idle';

  constructor(config: AgentConfig) {
    super();
    this.id = config.id || uuidv4();
    this.name = config.name;
    this.description = config.description;
    this.capabilities = config.capabilities;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 30000;
  }

  /**
   * 执行任务
   */
  abstract execute(task: Task): Promise<TaskResult>;

  /**
   * 获取 Agent 状态
   */
  getStatus(): AgentStatus {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      capabilities: this.capabilities,
    };
  }

  /**
   * 注册技能
   */
  registerSkill(name: string, handler: Function): void {
    this.on(`skill:${name}`, handler);
  }

  /**
   * 触发技能
   */
  async triggerSkill(name: string, params?: any): Promise<any> {
    return this.emitAsync(`skill:${name}`, params);
  }

  /**
   * 停止 Agent
   */
  stop(): void {
    this.status = 'idle';
    this.emit('stopped', { agentId: this.id });
  }
}

export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: string;
  capabilities: string[];
}

/**
 * x-agent - 通用 Agent 智能体框架
 * 
 * 入口文件
 */

import { Brain } from './core/brain';
import { LeaderAgent } from './agents/leader';
import { CoderAgent } from './agents/coder';

// 创建决策引擎
const brain = new Brain({
  strategy: 'priority',
  maxConcurrent: 5,
});

// 创建 Agent
const leader = new LeaderAgent();
const coder = new CoderAgent();

// 注册 Agent
brain.registerAgent(leader);
brain.registerAgent(coder);

// 提交示例任务
brain.submitTask({
  id: 'task-001',
  name: '示例任务',
  description: '这是一个示例任务',
  priority: 'P1',
  assignedTo: 'leader',
  status: 'pending',
});

// 输出状态
console.log('\n[x-agent] System Status:');
console.log(JSON.stringify(brain.getStatus(), null, 2));

export { Brain, LeaderAgent, CoderAgent };
export { BaseAgent } from './core/agent';

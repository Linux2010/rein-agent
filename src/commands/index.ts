/**
 * openhorse - Command Registry
 *
 * 注册所有 slash 命令，提供查找和列表功能。
 */

import chalk from 'chalk';
import type { SlashCommand, CommandContext, CommandResult } from './types';
import type { Task } from '../core/agent';
import { TaskManager, CreateTaskOptions } from '../services/task-manager';
import { AgentRunner } from '../services/agent-runner';
import { isConfigured } from '../services/config';
import { createSpinner, toolLine } from '../ui/box';
import { query, getSystemPrompt, type QueryEvent, type PromptContext } from '../framework';
import { TOOLS, executeTool, getToolNames } from '../tools';
import type { Message, StreamCallbacks } from '../services/llm';

// ============================================================================
// 颜色常量
// ============================================================================

const BRAND = chalk.hex('#FF6B35');
const ACCENT = chalk.hex('#00D4AA');
const DIM = chalk.dim;
const ERROR = chalk.red;
const WARN = chalk.yellow;
const SUCCESS = chalk.green;
const HEADER = chalk.cyan.bold;

// ============================================================================
// 命令实现
// ============================================================================

let taskManager: TaskManager | null = null;

function showHelp(): CommandResult {
  console.log();
  console.log(HEADER('Commands:'));
  console.log();
  for (const cmd of COMMANDS) {
    const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
    const params = cmd.params?.map(p => `<${p.name}>`).join(' ') || '';
    console.log(`  ${ACCENT(`/${cmd.name}`)}${aliases} ${DIM(params)}`);
    console.log(`    ${DIM(cmd.description)}`);
  }
  console.log();
  console.log(DIM('Type any text without / prefix to chat with the LLM.'));
  console.log();
  return { success: true };
}

function showStatus(ctx: CommandContext): CommandResult {
  console.log();
  console.log(HEADER('System Status'));
  console.log(DIM('─'.repeat(40)));

  const brainStatus = ctx.runtime.brain.getStatus();
  const memStatus = ctx.runtime.memory.getStatus();
  const storeStats = ctx.runtime.store.getStats();

  console.log(`  Mode       ${BRAND(ctx.config.mode)}`);
  console.log(`  Log level  ${DIM(ctx.config.logLevel)}`);
  console.log();
  console.log(`  Agents     ${SUCCESS(brainStatus.agents.length)} registered`);
  console.log(`  Tasks      ${brainStatus.pendingTasks} pending (${brainStatus.strategy} strategy)`);
  console.log();
  console.log(`  Memory (inline):`);
  console.log(`    Working    ${memStatus.working} entries`);
  console.log(`    Short-term ${memStatus['short-term']} entries`);
  console.log(`    Long-term  ${memStatus['long-term']} entries`);
  console.log();
  console.log(`  Memory (store):`);
  console.log(`    Working    ${storeStats.working} entries`);
  console.log(`    Short-term ${storeStats['short-term']} entries`);
  console.log(`    Long-term  ${storeStats['long-term']} entries`);
  console.log();
  return { success: true };
}

function showAgents(ctx: CommandContext): CommandResult {
  console.log();
  console.log(HEADER('Registered Agents'));
  console.log(DIM('─'.repeat(40)));

  for (const agent of ctx.runtime.agents) {
    const status = agent.getStatus();
    const statusColor = status.status === 'idle' ? SUCCESS : WARN;
    console.log();
    console.log(`  ${ACCENT(status.name)} ${DIM(`(${status.id})`)}`);
    console.log(`    Status:    ${statusColor(status.status)}`);
    console.log(`    Capabilities: ${status.capabilities.join(', ')}`);
  }
  console.log();
  return { success: true };
}

function showMemory(ctx: CommandContext): CommandResult {
  console.log();
  console.log(HEADER('Memory Status'));
  console.log(DIM('─'.repeat(40)));

  const memStatus = ctx.runtime.memory.getStatus();
  const storeStats = ctx.runtime.store.getStats();

  console.log();
  console.log(HEADER('  Inline MemorySystem:'));
  console.log(`    Working    ${memStatus.working} / ${ctx.runtime.config.memory.workingCapacity}`);
  console.log(`    Short-term ${memStatus['short-term']} / ${ctx.runtime.config.memory.shortTermCapacity}`);
  console.log(`    Long-term  ${memStatus['long-term']} entries`);

  console.log();
  console.log(HEADER('  Modular MemoryStore:'));
  console.log(`    Working    ${storeStats.working}`);
  console.log(`    Short-term ${storeStats['short-term']}`);
  console.log(`    Long-term  ${storeStats['long-term']} entries`);
  console.log();
  return { success: true };
}

function showSafety(ctx: CommandContext): CommandResult {
  console.log();
  console.log(HEADER('Safety Checker'));
  console.log(DIM('─'.repeat(40)));

  const policy = ctx.runtime.safety.getPolicy();
  const summary = ctx.runtime.safety.getAuditSummary();

  console.log();
  console.log(`  Enabled    ${policy.enabled ? SUCCESS('yes') : ERROR('no')}`);
  console.log(`  Sandbox    ${policy.sandboxMode ? WARN('on') : DIM('off')}`);
  console.log();
  console.log(`  Blocked patterns:`);
  for (const pattern of policy.blocked) {
    console.log(`    ${ERROR('✗')} ${DIM(pattern)}`);
  }
  console.log();
  console.log(`  Dangerous patterns:`);
  for (const pattern of policy.dangerousPatterns) {
    console.log(`    ${WARN('⚠')} ${DIM(pattern)}`);
  }
  console.log();
  console.log(`  Audit summary: ${summary.total} checks | ${SUCCESS(`${summary.passed} passed`)} | ${ERROR(`${summary.blocked} blocked`)}`);
  console.log();
  return { success: true };
}

function showHarness(ctx: CommandContext): CommandResult {
  console.log();
  console.log(HEADER('Harness Config'));
  console.log(DIM('─'.repeat(40)));

  const cfg = ctx.runtime.harness.getConfig();
  console.log();
  console.log(`  Max steps       ${cfg.maxSteps}`);
  console.log(`  Boundary check  ${cfg.boundaryCheck ? SUCCESS('on') : ERROR('off')}`);
  console.log(`  Goal constraint ${cfg.goalConstraint ? SUCCESS('on') : ERROR('off')}`);
  console.log(`  Result validate ${cfg.resultValidation ? SUCCESS('on') : ERROR('off')}`);
  console.log(`  Sandbox         ${cfg.sandbox ? WARN('on') : DIM('off')}`);
  console.log(`  Timeout         ${cfg.timeout}ms`);
  console.log();
  console.log(`  Blocked actions: ${cfg.blockedActions.join(', ')}`);
  console.log();
  return { success: true };
}

function showConfig(ctx: CommandContext): CommandResult {
  console.log();
  console.log(HEADER('Configuration'));
  console.log(DIM('─'.repeat(40)));

  const summary = {
    name: ctx.config.name,
    model: ctx.config.model,
    apiBaseUrl: ctx.config.apiBaseUrl || '(default OpenAI)',
    apiKey: ctx.config.apiKey ? `${ctx.config.apiKey.slice(0, 7)}***` : '(not set)',
    maxTokens: String(ctx.config.maxTokens),
    temperature: String(ctx.config.temperature),
    mode: ctx.config.mode,
    logLevel: ctx.config.logLevel,
  };

  const llmSummary = ctx.llm?.getConfigSummary() ?? {};

  for (const [key, val] of Object.entries(summary)) {
    console.log(`  ${ACCENT(key.padEnd(16))} ${DIM(val)}`);
  }
  console.log();
  console.log(HEADER('  LLM Settings:'));
  for (const [key, val] of Object.entries(llmSummary)) {
    console.log(`  ${ACCENT(key.padEnd(16))} ${DIM(val)}`);
  }
  console.log();
  return { success: true };
}

function handleModel(ctx: CommandContext, args: string): CommandResult {
  if (!args) {
    if (ctx.llm) {
      console.log(DIM(`Current model: ${BRAND(ctx.llm.getModel())}`));
    } else {
      console.log(ERROR('LLM not initialized. Set OPENHORSE_API_KEY first.'));
    }
    console.log();
    return { success: true };
  }

  if (!ctx.llm) {
    console.log(ERROR('LLM not initialized. Set OPENHORSE_API_KEY first.'));
    console.log();
    return { success: false };
  }

  ctx.llm.setModel(args);
  ctx.store.setState({ currentModel: args });
  console.log(SUCCESS(`✔ Model changed to ${BRAND(args)}`));
  console.log();
  return { success: true };
}

function handleTask(ctx: CommandContext, args: string): CommandResult {
  const [sub, ...rest] = args.trim().split(/\s+/);

  if (sub === 'list' || sub === 'ls') {
    if (!taskManager) {
      taskManager = new TaskManager();
    }

    console.log();
    console.log(HEADER('Task List'));
    console.log(DIM('─'.repeat(40)));

    const stats = taskManager.getStats();
    console.log(`  Total      ${stats.total}`);
    console.log(`  Pending    ${stats.pending}`);
    console.log(`  Running    ${stats.running}`);
    console.log(`  Completed  ${SUCCESS(stats.completed)}`);
    console.log(`  Failed     ${ERROR(stats.failed)}`);
    console.log(`  Cancelled  ${DIM(stats.cancelled)}`);

    const tasks = taskManager.list();
    if (tasks.length > 0) {
      console.log();
      for (const t of tasks) {
        const statusIcon = t.status === 'completed' ? SUCCESS('✓')
          : t.status === 'failed' ? ERROR('✗')
          : t.status === 'running' ? WARN('◌')
          : t.status === 'cancelled' ? DIM('⊘')
          : DIM('○');
        console.log(`  ${statusIcon} ${ACCENT(t.name)} ${DIM(`(${t.id.slice(0, 8)})`)}`);
        console.log(`    ${DIM(`[${t.priority}]`)} ${t.description.slice(0, 60)}`);
      }
    }
    console.log();
    return { success: true };
  }

  // 默认行为: 作为任务名提交
  const taskName = args.trim() || 'demo-task';
  const task: Task = {
    id: `cli-${Date.now()}`,
    name: taskName,
    description: `Task submitted from CLI: ${taskName}`,
    priority: 'P1',
    assignedTo: 'leader',
    status: 'pending',
  };

  console.log();
  ctx.runtime.brain.submitTask(task);
  console.log(SUCCESS(`✔ Task "${taskName}" submitted`));
  console.log();
  return { success: true };
}

async function handleRun(ctx: CommandContext, args: string): Promise<CommandResult> {
  if (!args.trim()) {
    console.log(ERROR('Usage: /run <task description>'));
    console.log(DIM('  Creates a task and executes it through the Agent + LLM pipeline.'));
    console.log();
    return { success: false };
  }

  if (!ctx.llm || !isConfigured(ctx.config)) {
    console.log(WARN('⚠ LLM not configured. Set OPENHORSE_API_KEY in .env to enable run mode.'));
    console.log();
    return { success: false };
  }

  if (!taskManager) {
    taskManager = new TaskManager();
  }

  const taskOptions: CreateTaskOptions = {
    name: args.slice(0, 80),
    description: args,
    priority: 'P1',
    assignedTo: 'leader',
    tags: ['cli', 'interactive'],
  };

  const record = taskManager.create(taskOptions);
  console.log();
  console.log(SUCCESS(`✔ Task created: ${ACCENT(record.name)}`));
  console.log(DIM(`  ID: ${record.id} | Tags: ${record.tags.join(', ')}`));

  taskManager.start(record.id);
  console.log(WARN('◌ Running task through Agent + LLM...'));

  try {
    const agent = ctx.runtime.agents[0];
    if (!agent) {
      throw new Error('No agents registered');
    }

    const runner = new AgentRunner(agent, ctx.llm);
    const task = taskManager.toTask(record);
    const result = await runner.run(task);

    if (result.success) {
      taskManager.complete(record.id, result);
      console.log(SUCCESS(`✓ Task completed in ${result.duration}ms`));
      if (result.tokenUsage) {
        console.log(DIM(`  Tokens: ${result.tokenUsage.promptTokens} in / ${result.tokenUsage.completionTokens} out`));
      }
      if (result.data?.summary) {
        console.log();
        console.log(ACCENT('  Summary:'));
        console.log(`  ${result.data.summary}`);
      }
    } else {
      taskManager.fail(record.id, result.error, result);
      console.log(ERROR(`✗ Task failed: ${result.error}`));
    }
  } catch (error: any) {
    taskManager.fail(record.id, error.message);
    console.log(ERROR(`✗ Task error: ${error.message}`));
  }

  console.log();
  return { success: true };
}

async function handleChat(ctx: CommandContext, input: string): Promise<CommandResult> {
  if (!input) {
    console.log(ERROR('Usage: /chat <message>'));
    console.log();
    return { success: false };
  }

  if (!ctx.llm || !isConfigured(ctx.config)) {
    console.log(WARN('⚠ LLM not configured. Set OPENHORSE_API_KEY in .env to enable chat.'));
    console.log();
    return { success: false };
  }

  ctx.store.addMessage({ role: 'user', content: input });
  const snapshot = ctx.store.getSnapshot();

  const promptCtx: PromptContext = {
    cwd: ctx.cwd,
    platform: process.platform,
    nodeVersion: process.version,
    tools: TOOLS,
  };
  const systemPrompt = getSystemPrompt(promptCtx);

  const spinner = createSpinner();
  spinner.start('Thinking');

  let finalContent = '';
  let finalModel = '';
  let finalUsage: { promptTokens: number; completionTokens: number } | undefined;
  let responseStarted = false;

  const toolExecutor = async (name: string, args: Record<string, unknown>) => {
    const start = Date.now();
    const result = await executeTool(name, args);
    const duration = Date.now() - start;
    const parsed = JSON.parse(result);
    spinner.stop();
    console.log(toolLine(name, args, parsed.success !== false, duration));
    return result;
  };

  const streamCallbacks: StreamCallbacks = {
    onChunk: (chunk: string) => {
      if (!responseStarted) {
        responseStarted = true;
        spinner.stop();
      }
      process.stdout.write(chunk);
    },
  };

  try {
    const messages: Message[] = [{ role: 'system', content: systemPrompt }, ...snapshot.conversationHistory];

    for await (const event of query({
      messages,
      tools: TOOLS,
      toolExecutor,
      llm: ctx.llm,
      streamCallbacks,
    })) {
      switch (event.type) {
        case 'request_start':
          spinner.update(`Turn ${event.turn}...`);
          break;

        case 'tool_result':
          spinner.start('Thinking');
          break;

        case 'complete':
          spinner.stop();
          finalContent = event.content;
          finalModel = event.model;
          finalUsage = event.usage;
          break;
      }
    }

    if (finalContent) {
      ctx.store.addMessage({ role: 'assistant', content: finalContent });
    }

    if (finalUsage) {
      ctx.store.setTokenUsage(finalUsage);
    }

    if (responseStarted) {
      console.log();
    }
    const stats = [
      finalUsage ? `tokens: ${finalUsage.promptTokens}+${finalUsage.completionTokens}` : '',
      finalModel ? finalModel : '',
    ].filter(Boolean).join('  ');
    if (stats) {
      console.log(DIM(stats));
    }
  } catch (error: any) {
    spinner.stop();
    console.log();
    console.log(ERROR(`✗ ${error.message || String(error)}`));
    const hist = ctx.store.getSnapshot().conversationHistory;
    if (hist.length > 0) {
      ctx.store.setState({ conversationHistory: hist.slice(0, -1) });
    }
  }

  return { success: true };
}

async function handleExit(ctx: CommandContext): Promise<CommandResult> {
  console.log();
  console.log(DIM('Shutting down...'));
  await ctx.runtime.shutdown();
  console.log(SUCCESS('Goodbye! 🐴'));
  process.exit(0);
}

// ============================================================================
// 命令注册表
// ============================================================================

const COMMANDS: SlashCommand[] = [
  // 系统命令
  {
    name: 'help',
    aliases: ['h'],
    description: 'Show available commands',
    type: 'builtin',
    execute: () => showHelp(),
  },
  {
    name: 'status',
    aliases: ['s'],
    description: 'Show system status overview',
    type: 'builtin',
    execute: (ctx) => showStatus(ctx),
  },
  {
    name: 'clear',
    description: 'Clear the terminal screen',
    type: 'builtin',
    execute: () => {
      process.stdout.write('\x1Bc');
      return { success: true };
    },
  },
  {
    name: 'exit',
    aliases: ['quit', 'q'],
    description: 'Shutdown and exit',
    type: 'builtin',
    execute: (ctx) => handleExit(ctx),
  },

  // 配置命令
  {
    name: 'model',
    description: 'Show or change the current model',
    params: [{ name: 'model', description: 'Model name', required: false }],
    type: 'builtin',
    execute: (ctx, args) => handleModel(ctx, args),
  },
  {
    name: 'config',
    description: 'Show current configuration',
    type: 'builtin',
    execute: (ctx) => showConfig(ctx),
  },

  // Agent/Harness 命令
  {
    name: 'agents',
    description: 'List registered agents and their status',
    type: 'builtin',
    execute: (ctx) => showAgents(ctx),
  },
  {
    name: 'memory',
    description: 'Show memory system status',
    type: 'builtin',
    execute: (ctx) => showMemory(ctx),
  },
  {
    name: 'safety',
    description: 'Show safety checker status and audit summary',
    type: 'builtin',
    execute: (ctx) => showSafety(ctx),
  },
  {
    name: 'harness',
    description: 'Show harness configuration',
    type: 'builtin',
    execute: (ctx) => showHarness(ctx),
  },

  // Task 命令
  {
    name: 'task',
    description: 'Submit or list tasks',
    params: [{ name: 'action', description: 'list | <task-name>', required: false }],
    type: 'builtin',
    execute: (ctx, args) => handleTask(ctx, args),
  },
  {
    name: 'run',
    description: 'Create and run a task through Agent + LLM',
    params: [{ name: 'description', description: 'Task description', required: true }],
    type: 'builtin',
    execute: (ctx, args) => handleRun(ctx, args),
  },

  // Chat 命令
  {
    name: 'chat',
    description: 'Send a message to the LLM',
    params: [{ name: 'message', description: 'Message to send', required: true }],
    type: 'chat',
    execute: (ctx, args) => ({ success: true, continueAsChat: true, chatInput: args }),
  },
];

// ============================================================================
// 导出
// ============================================================================

export function getCommands(): SlashCommand[] {
  return COMMANDS;
}

export function findCommand(name: string): SlashCommand | undefined {
  return COMMANDS.find(c => c.name === name || c.aliases?.includes(name));
}

export function getCommandNames(): string[] {
  return COMMANDS.map(c => c.name);
}

export { handleChat as executeChat };
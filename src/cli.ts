/**
 * rein-agent - 命令行交互入口
 *
 * 提供交互式终端体验：
 *   - 欢迎界面（ASCII Art）
 *   - 系统初始化与状态展示
 *   - 交互式命令（help, status, agents, memory, safety, task, clear, exit）
 *   - 支持 Commander 子命令模式
 */

import 'dotenv/config';
import chalk from 'chalk';
import figlet from 'figlet';
import { init, ReinRuntime } from './init';
import { Task } from './core/agent';

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
// 欢迎界面
// ============================================================================

function printBanner(): void {
  const art = figlet.textSync('REIN', {
    font: 'standard',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });

  console.log(BRAND(art));
  console.log();
  console.log(`${ACCENT('Rein the AI, Unleash the Potential.')}`);
  console.log(DIM('  通用 Agent 驾驭框架  |  Universal Agent Harness Framework'));
  console.log();
  console.log(`${DIM('├')} ${DIM('v')} ${chalk.bold('0.1.0')}  ${DIM('│')}  Node ${process.version}  ${DIM('│')}  ${process.platform} ${process.arch}`);
  console.log();
}

// ============================================================================
// 交互模式
// ============================================================================

async function interactiveMode(runtime: ReinRuntime): Promise<void> {
  const rl = await import('readline');

  const readline = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    process.stdout.write(`${ACCENT('rein')}${DIM(' > ')} `);
  };

  console.log(SUCCESS('✔ System initialized successfully'));
  console.log(DIM('  Type "help" for available commands, "exit" to quit'));
  console.log();

  printPrompt();

  // --- 命令映射 ---

  const commands: Record<string, (args: string) => void> = {
    help: () => printHelp(),
    status: () => printStatus(runtime),
    agents: () => printAgents(runtime),
    memory: () => printMemory(runtime),
    safety: () => printSafety(runtime),
    harness: () => printHarness(runtime),
    task: (args) => submitTask(runtime, args),
    clear: () => process.stdout.write('\x1Bc'),
    exit: () => handleExit(runtime),
    quit: () => handleExit(runtime),
  };

  // 别名
  commands['h'] = commands.help;
  commands['s'] = commands.status;
  commands['q'] = commands.quit;

  function printPrompt(): void {
    prompt();
  }

  readline.on('line', (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      printPrompt();
      return;
    }

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const args = rest.join(' ');
    const handler = commands[cmd.toLowerCase()];

    if (handler) {
      handler(args);
    } else {
      console.log(ERROR(`Unknown command: ${cmd}`));
      console.log(DIM(`Type "help" for available commands`));
    }

    printPrompt();
  });

  readline.on('close', () => {
    handleExit(runtime);
  });

  // 处理 Ctrl+C
  readline.on('SIGINT', () => {
    console.log();
    console.log(WARN('⚠ Type "exit" to quit'));
    printPrompt();
  });
}

// ============================================================================
// 命令实现
// ============================================================================

function printHelp(): void {
  console.log();
  console.log(HEADER('Commands:'));
  console.log();
  const cmds: [string, string][] = [
    ['help',      'Show this help message'],
    ['status',    'Show system status overview'],
    ['agents',    'List registered agents and their status'],
    ['memory',    'Show memory system status'],
    ['safety',    'Show safety checker status and audit summary'],
    ['harness',   'Show harness configuration'],
    ['task <n>',  'Submit a demo task (e.g., "task code" or "task review")'],
    ['clear',     'Clear the terminal screen'],
    ['exit',      'Shutdown and exit'],
  ];
  for (const [name, desc] of cmds) {
    console.log(`  ${ACCENT(name.padEnd(12))} ${DIM(desc)}`);
  }
  console.log();
}

function printStatus(runtime: ReinRuntime): void {
  console.log();
  console.log(HEADER('System Status'));
  console.log(DIM('─'.repeat(40)));

  const brainStatus = runtime.brain.getStatus();
  const memStatus = runtime.memory.getStatus();
  const storeStats = runtime.store.getStats();

  console.log(`  Mode       ${BRAND(runtime.config.mode)}`);
  console.log(`  Log level  ${DIM(runtime.config.logLevel)}`);
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
}

function printAgents(runtime: ReinRuntime): void {
  console.log();
  console.log(HEADER('Registered Agents'));
  console.log(DIM('─'.repeat(40)));

  for (const agent of runtime.agents) {
    const status = agent.getStatus();
    const statusColor = status.status === 'idle' ? SUCCESS : WARN;
    console.log();
    console.log(`  ${ACCENT(status.name)} ${DIM(`(${status.id})`)}`);
    console.log(`    Status:    ${statusColor(status.status)}`);
    console.log(`    Capabilities: ${status.capabilities.join(', ')}`);
  }
  console.log();
}

function printMemory(runtime: ReinRuntime): void {
  console.log();
  console.log(HEADER('Memory Status'));
  console.log(DIM('─'.repeat(40)));

  const memStatus = runtime.memory.getStatus();
  const storeStats = runtime.store.getStats();

  console.log();
  console.log(HEADER('  Inline MemorySystem:'));
  console.log(`    Working    ${memStatus.working} / ${runtime.config.memory.workingCapacity}`);
  console.log(`    Short-term ${memStatus['short-term']} / ${runtime.config.memory.shortTermCapacity}`);
  console.log(`    Long-term  ${memStatus['long-term']} entries`);

  console.log();
  console.log(HEADER('  Modular MemoryStore:'));
  console.log(`    Working    ${storeStats.working}`);
  console.log(`    Short-term ${storeStats['short-term']}`);
  console.log(`    Long-term  ${storeStats['long-term']} entries`);
  console.log();
}

function printSafety(runtime: ReinRuntime): void {
  console.log();
  console.log(HEADER('Safety Checker'));
  console.log(DIM('─'.repeat(40)));

  const policy = runtime.safety.getPolicy();
  const summary = runtime.safety.getAuditSummary();

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
}

function printHarness(runtime: ReinRuntime): void {
  console.log();
  console.log(HEADER('Harness Config'));
  console.log(DIM('─'.repeat(40)));

  const cfg = runtime.harness.getConfig();
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
}

function submitTask(runtime: ReinRuntime, name: string): void {
  const taskName = name.trim() || 'demo-task';
  const task: Task = {
    id: `cli-${Date.now()}`,
    name: taskName,
    description: `Task submitted from CLI: ${taskName}`,
    priority: 'P1',
    assignedTo: 'leader',
    status: 'pending',
  };

  console.log();
  runtime.brain.submitTask(task);
  console.log(SUCCESS(`✔ Task "${taskName}" submitted`));
  console.log();
}

async function handleExit(runtime: ReinRuntime): Promise<void> {
  console.log();
  console.log(DIM('Shutting down...'));
  await runtime.shutdown();
  console.log(SUCCESS('Goodbye! 🐴'));
  process.exit(0);
}

// ============================================================================
// Commander 子命令模式
// ============================================================================

async function commandMode(runtime: ReinRuntime): Promise<void> {
  const { Command } = await import('commander');

  const program = new Command();

  program
    .name('rein')
    .description('Rein Agent Framework - Universal Agent Harness')
    .version('0.1.0');

  program
    .command('status')
    .description('Show system status')
    .action(() => {
      printStatus(runtime);
      process.exit(0);
    });

  program
    .command('agents')
    .description('List agents')
    .action(() => {
      printAgents(runtime);
      process.exit(0);
    });

  program
    .command('safety')
    .description('Show safety status')
    .action(() => {
      printSafety(runtime);
      process.exit(0);
    });

  program
    .command('task <name>')
    .description('Submit a demo task')
    .action((name: string) => {
      submitTask(runtime, name);
      process.exit(0);
    });

  program
    .command('interactive', { isDefault: true })
    .description('Start interactive CLI (default)')
    .action(() => {
      interactiveMode(runtime);
    });

  program.parse(process.argv);
}

// ============================================================================
// 主入口
// ============================================================================

async function main(): Promise<void> {
  printBanner();

  // 加载环境变量
  const mode = (process.env.REIN_MODE || 'development') as 'development' | 'production';
  const logLevel = (process.env.REIN_LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error';

  // 初始化系统
  const runtime = await init({
    name: process.env.REIN_NAME || 'rein-agent',
    mode,
    logLevel,
  });

  // 注册优雅关闭
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${WARN(`Received ${signal}`)}`);
    await runtime.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // 启动系统
  await runtime.start();

  // 判断模式：如果有命令行参数，走命令模式；否则走交互模式
  const hasCommandArgs = process.argv.some(arg =>
    ['status', 'agents', 'safety', 'task'].includes(arg),
  );

  if (hasCommandArgs) {
    await commandMode(runtime);
  } else {
    await interactiveMode(runtime);
  }
}

// 执行主入口
main().catch(err => {
  console.error(ERROR('[Rein] Fatal error:'), err);
  process.exit(1);
});

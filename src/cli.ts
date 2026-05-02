/**
 * openhorse - 命令行交互入口
 *
 * 提供交互式终端体验：
 *   - 欢迎界面（Header Box with Provider/Model/Endpoint）
 *   - 系统初始化与状态展示
 *   - Slash 命令（/help, /status, /clear, /exit 等）
 *   - 非 `/` 前缀输入直接作为 chat 消息
 *   - Tab 补全命令名
 *   - Shift+Tab 模式切换
 */

import 'dotenv/config';
import chalk from 'chalk';
import figlet from 'figlet';
import { init, OpenHorseRuntime } from './init';
import { LLMService } from './services/llm';
import { TOOLS } from './tools';
import { loadConfig, isConfigured } from './services/config';
import { Store } from './framework';
import { findCommand, executeChat } from './commands';
import { parseInput, createCompleter, buildCommandSuggestions } from './commands/parser';
import type { CommandContext } from './commands/types';
import { getModeDisplayText } from './commands/types';

// ============================================================================
// 颜色常量
// ============================================================================

const BRAND = chalk.hex('#FF6B35');
const ACCENT = chalk.hex('#00D4AA');
const DIM = chalk.dim;
const ERROR = chalk.red;
const WARN = chalk.yellow;
const SUCCESS = chalk.green;

// ============================================================================
// 全局状态
// ============================================================================

let llm: LLMService | null = null;
let store: Store;

// ============================================================================
// 欢迎界面
// ============================================================================

function printBanner(): void {
  const art = figlet.textSync('OPENHORSE', {
    font: 'standard',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });

  console.log(BRAND(art));
  console.log();
  console.log(`${ACCENT('OpenHorse, Unleash the Potential.')}`);
  console.log(DIM('  通用 Agent 驾驭框架  |  Universal Agent Harness Framework'));
  console.log();
  console.log(`${DIM('├')} ${DIM('v')} ${chalk.bold('0.1.0')}  ${DIM('│')}  Node ${process.version}  ${DIM('│')}  ${process.platform} ${process.arch}`);
  console.log();
}

function printLLMStatus(): void {
  const config = store.getSnapshot().config;
  if (!isConfigured(config)) {
    console.log(`${DIM('├')} ${WARN('LLM not configured')} ${DIM('| Set OPENHORSE_API_KEY in .env')}`);
  } else if (llm) {
    console.log(`${DIM('├')} ${SUCCESS('LLM ready')} ${DIM('|')} ${BRAND(llm.getModel())}`);
  }
  console.log();
}

// ============================================================================
// 交互模式
// ============================================================================

async function interactiveMode(runtime: OpenHorseRuntime): Promise<void> {
  const rl = await import('readline');

  // Enable keypress events for shift+tab detection
  rl.emitKeypressEvents(process.stdin);

  const readline = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: createCompleter(),
  });

  // Prevent double-processing while async commands run
  let busy = false;

  // Mode indicator in prompt
  const getPromptWithMode = (): string => {
    const mode = store.getSnapshot().permissionMode;
    const modeText = getModeDisplayText(mode);
    const modeIndicator = modeText ? DIM(`[${modeText}] `) : '';
    return modeIndicator + ACCENT('❯ ');
  };

  const prompt = () => {
    process.stdout.write(getPromptWithMode());
  };

  // Shift+Tab detection - cycle permission mode
  const handleCycleMode = (): void => {
    if (busy) return;
    store.cyclePermissionMode();
    // Clear current prompt line and redraw with new mode
    process.stdout.write('\x1b[2K\r'); // Clear entire line
    prompt();
  };

  // Listen for keypress events (before readline processes them)
  process.stdin.on('keypress', (_str: string, key: any) => {
    // Shift+Tab: \x1b[Z sequence or key.name === 'tab' with shift
    if (key.sequence === '\x1b[Z' || (key.name === 'tab' && key.shift)) {
      handleCycleMode();
    }
  });

  // 构建命令上下文
  const ctx: CommandContext = {
    cwd: process.cwd(),
    config: store.getSnapshot().config,
    store,
    llm,
    runtime,
  };

  console.log(SUCCESS('✔ System initialized successfully'));
  console.log(DIM('  Type /help for available commands, /exit to quit'));
  console.log(DIM('  Press shift+tab to cycle permission modes (default → acceptEdits → plan → auto)'));
  if (!isConfigured(ctx.config)) {
    console.log(WARN('  ⚠ LLM not configured — chat mode unavailable'));
    console.log(DIM('  Set OPENHORSE_API_KEY in .env to enable chat'));
  }
  console.log();

  prompt();

  /** Run handler and re-enable prompt after completion */
  async function runHandler(parsed: { isCommand: boolean; name: string; args: string }): Promise<void> {
    if (busy) return;
    busy = true;

    if (parsed.isCommand) {
      const cmd = findCommand(parsed.name);
      if (cmd) {
        const result = await cmd.execute(ctx, parsed.args);
        if (result.continueAsChat && result.chatInput) {
          await executeChat(ctx, result.chatInput);
        }
      } else {
        console.log(ERROR(`Unknown command: /${parsed.name}`));
        const suggestions = buildCommandSuggestions(parsed.name);
        if (suggestions.length > 0) {
          console.log(DIM(`Did you mean: ${suggestions.map(s => `/${s}`).join(', ')}?`));
        } else {
          console.log(DIM(`Type /help for available commands.`));
        }
        console.log();
      }
    } else {
      // 非 `/` 前缀 → 直接 chat
      await executeChat(ctx, parsed.args);
    }

    busy = false;
    prompt();
  }

  readline.on('line', (line: string) => {
    const parsed = parseInput(line);
    if (!parsed.isCommand && !parsed.args) {
      // 空输入（只有空格） → 重新打印 prompt
      prompt();
      return;
    }

    if (busy) {
      // 正在处理中，忽略输入
      return;
    }

    runHandler(parsed);
  });

  readline.on('close', () => {
    console.log();
    console.log(DIM('Shutting down...'));
    runtime.shutdown().then(() => {
      console.log(SUCCESS('Goodbye! 🐴'));
      process.exit(0);
    });
  });

  // 处理 Ctrl+C
  readline.on('SIGINT', () => {
    console.log();
    console.log(DIM('Shutting down...'));
    runtime.shutdown().then(() => {
      console.log(SUCCESS('Goodbye! 🐴'));
      process.exit(0);
    });
  });
}

// ============================================================================
// Commander 子命令模式
// ============================================================================

async function commandMode(runtime: OpenHorseRuntime): Promise<void> {
  const { Command } = await import('commander');

  const program = new Command();

  program
    .name('openhorse')
    .description('OpenHorse Framework - Universal Agent Harness')
    .version('0.1.0');

  program
    .command('status')
    .description('Show system status')
    .action(() => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        config: store.getSnapshot().config,
        store,
        llm,
        runtime,
      };
      findCommand('status')?.execute(ctx, '');
      process.exit(0);
    });

  program
    .command('agents')
    .description('List agents')
    .action(() => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        config: store.getSnapshot().config,
        store,
        llm,
        runtime,
      };
      findCommand('agents')?.execute(ctx, '');
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
  // 加载环境变量
  const cliConfig = loadConfig();

  // 创建 Store
  store = new Store({
    config: cliConfig,
    tools: TOOLS,
    currentModel: cliConfig.model,
  });

  // 打印欢迎界面（需要 store 已初始化）
  printBanner();

  // 检查 LLM 配置
  if (isConfigured(cliConfig)) {
    try {
      llm = new LLMService({
        apiKey: cliConfig.apiKey,
        baseUrl: cliConfig.apiBaseUrl,
        model: cliConfig.model,
        maxTokens: cliConfig.maxTokens,
        temperature: cliConfig.temperature,
      });
    } catch (err: any) {
      console.log(WARN(`⚠ LLM initialization warning: ${err.message}`));
    }
  }

  // 打印 LLM 状态
  printLLMStatus();

  // 初始化系统
  const config = store.getSnapshot().config;
  const runtime = await init({
    name: config.name,
    mode: config.mode as any,
    logLevel: config.logLevel,
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
    ['status', 'agents'].includes(arg),
  );

  if (hasCommandArgs) {
    await commandMode(runtime);
  } else {
    await interactiveMode(runtime);
  }
}

// 执行主入口
main().catch(err => {
  console.error(ERROR('[OpenHorse] Fatal error:'), err);
  process.exit(1);
});
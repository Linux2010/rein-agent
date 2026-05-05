/**
 * openhorse - 命令行交互入口
 *
 * 简化版 REPL，使用标准 readline。
 */

import 'dotenv/config';
import chalk from 'chalk';
import figlet from 'figlet';
import { init, OpenHorseRuntime } from './init';
import { LLMService } from './services/llm';
import { TOOLS } from './tools';
import { loadConfig, isConfigured } from './services/config';
import { ensureConfigDir } from './services/config-dir';
import { recordFirstStartTime, incrementSessionCount } from './services/global-config';
import { createSession, type SessionMeta } from './services/session-storage';
import { Store } from './framework';
import { findCommand, executeChat, getCommandNames } from './commands';
import { parseInput, buildCommandSuggestions } from './commands/parser';
import type { CommandContext } from './commands/types';
import { getModeDisplayText } from './commands/types';
import { renderHeaderBox } from './ui/box';
import * as readline from 'readline';

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
let currentSession: SessionMeta | null = null;

// ============================================================================
// 欢迎界面
// ============================================================================

function printBanner(): void {
  const art = figlet.textSync('OPENHORSE', { font: 'standard' });
  console.log(BRAND(art));
  console.log();

  const config = store.getSnapshot().config;
  const baseUrl = config.apiBaseUrl || '';
  const headerBox = renderHeaderBox({
    provider: baseUrl.includes('anthropic') ? 'Anthropic'
      : baseUrl.includes('openai') ? 'OpenAI'
      : baseUrl.includes('dashscope') ? 'Alibaba Cloud'
      : 'Custom',
    model: config.model,
    endpoint: baseUrl,
    status: llm ? 'ready' : 'loading',
    statusText: llm ? undefined : 'Set OPENHORSE_API_KEY in .env',
    version: '0.1.0',
  });
  console.log(headerBox);
  console.log();
}

// ============================================================================
// 交互模式（简化版）
// ============================================================================

async function interactiveMode(runtime: OpenHorseRuntime): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: ACCENT('❯ ') + DIM(getModeIndicator()),
  });

  const ctx: CommandContext = {
    cwd: process.cwd(),
    config: store.getSnapshot().config,
    store,
    llm,
    runtime,
  };

  console.log(SUCCESS('✔ System initialized successfully'));
  console.log(DIM('  Type /help for available commands, /exit to quit'));
  console.log(DIM('  Press shift+tab to cycle permission modes'));
  if (!isConfigured(ctx.config)) {
    console.log(WARN('  ⚠ LLM not configured — chat mode unavailable'));
    console.log(DIM('  Set OPENHORSE_API_KEY in .env to enable chat'));
  }
  console.log();

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    const parsed = parseInput(input);

    try {
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
          }
        }
      } else {
        // 直接 chat
        await executeChat(ctx, parsed.args);
      }
    } catch (err: any) {
      console.log(ERROR(`Error: ${err.message || String(err)}`));
    }

    // 更新 prompt 显示当前模式
    rl.setPrompt(ACCENT('❯ ') + DIM(getModeIndicator()));
    rl.prompt();
  });

  rl.on('close', async () => {
    console.log();
    console.log(DIM('Shutting down...'));
    await runtime.shutdown();
    console.log(SUCCESS('Goodbye! 🐴'));
    process.exit(0);
  });

  rl.on('SIGINT', async () => {
    console.log();
    console.log(DIM('Shutting down...'));
    await runtime.shutdown();
    console.log(SUCCESS('Goodbye! 🐴'));
    process.exit(0);
  });
}

function getModeIndicator(): string {
  const mode = store.getSnapshot().permissionMode;
  const modeText = getModeDisplayText(mode);
  return modeText ? `[${modeText}] ` : '';
}

// ============================================================================
// 主入口
// ============================================================================

async function main(): Promise<void> {
  ensureConfigDir();
  recordFirstStartTime();

  const cliConfig = loadConfig();

  store = new Store({
    config: cliConfig,
    tools: TOOLS,
    currentModel: cliConfig.model,
  });

  currentSession = createSession(process.cwd(), cliConfig.model);
  incrementSessionCount();

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

  printBanner();

  const config = store.getSnapshot().config;
  const runtime = await init({
    name: config.name,
    mode: config.mode as any,
    logLevel: config.logLevel,
  });

  process.on('SIGINT', async () => {
    console.log(`\n${WARN('Received SIGINT')}`);
    await runtime.shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    console.log(`\n${WARN('Received SIGTERM')}`);
    await runtime.shutdown();
    process.exit(0);
  });

  await runtime.start();
  await interactiveMode(runtime);
}

main().catch(err => {
  console.error(ERROR('[OpenHorse] Fatal error:'), err);
  process.exit(1);
});
/**
 * openhorse - 命令行交互入口
 *
 * 简化版 REPL，不依赖 React hooks
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
let runtime: OpenHorseRuntime;

// REPL 状态
let inputBuffer = '';
let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; isError?: boolean }> = [];
let isLoading = false;
let spinnerFrame = 0;
let spinnerTimer: NodeJS.Timeout | null = null;

// ============================================================================
// Spinner
// ============================================================================

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function startSpinner() {
  isLoading = true;
  spinnerTimer = setInterval(() => {
    spinnerFrame = (spinnerFrame + 1) % SPINNER_FRAMES.length;
    redraw();
  }, 80);
}

function stopSpinner() {
  isLoading = false;
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
  }
}

// ============================================================================
// 渲染
// ============================================================================

function redraw() {
  // 清屏
  process.stdout.write('\x1b[2J\x1b[H');

  // Header
  const art = figlet.textSync('OPENHORSE', { font: 'standard' });
  console.log(BRAND(art));
  console.log();

  // 状态信息
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
    version: '0.1.1',
  });
  console.log(headerBox);
  console.log();

  // 消息历史
  messages.forEach(msg => {
    if (msg.role === 'system') {
      if (msg.isError) {
        console.log(ERROR(msg.content));
      } else {
        console.log(SUCCESS(msg.content));
      }
    } else {
      const color = msg.role === 'user' ? ACCENT : DIM;
      const prefix = msg.role === 'user' ? '❯ ' : '  ';
      console.log(color(prefix + msg.content));
    }
  });

  // Loading spinner
  if (isLoading) {
    console.log();
    console.log(chalk.cyan(SPINNER_FRAMES[spinnerFrame] + ' Processing...'));
  }

  // 模式指示
  const mode = store.getSnapshot().permissionMode;
  const modeText = getModeDisplayText(mode);
  const modeIndicator = modeText ? `[${modeText}] ` : '';

  // 输入行
  console.log();
  console.log(ACCENT('❯ ') + DIM(modeIndicator) + (inputBuffer || DIM('输入消息或 /help 查看命令...')));
}

// ============================================================================
// 输入处理
// ============================================================================

async function handleSubmit(text: string) {
  inputBuffer = '';
  messages.push({ role: 'user', content: text });
  startSpinner();

  const ctx: CommandContext = {
    cwd: process.cwd(),
    config: store.getSnapshot().config,
    store,
    llm,
    runtime,
    sessionId: currentSession?.id,
  };

  try {
    const parsed = parseInput(text);

    if (parsed.isCommand) {
      stopSpinner();
      const cmd = findCommand(parsed.name);
      if (cmd) {
        const result = await cmd.execute(ctx, parsed.args);
        if (result.continueAsChat && result.chatInput) {
          startSpinner();
          await executeChat(ctx, result.chatInput);
          stopSpinner();
          messages.push({ role: 'assistant', content: 'Response received' });
        } else {
          messages.push({ role: 'system', content: `/${parsed.name} executed` });
        }
      } else {
        messages.push({ role: 'system', content: `Unknown command: /${parsed.name}`, isError: true });
        const suggestions = buildCommandSuggestions(parsed.name);
        if (suggestions.length > 0) {
          messages.push({ role: 'system', content: `Did you mean: ${suggestions.map(s => `/${s}`).join(', ')}?` });
        }
      }
    } else {
      // Chat
      await executeChat(ctx, parsed.args);
      stopSpinner();
      messages.push({ role: 'assistant', content: 'Response received' });
    }
  } catch (err: any) {
    stopSpinner();
    messages.push({ role: 'system', content: `Error: ${err.message || String(err)}`, isError: true });
  }

  redraw();
}

async function shutdown() {
  stopSpinner();
  console.log();
  console.log(DIM('Shutting down...'));
  await runtime.shutdown();
  console.log(SUCCESS('Goodbye! 🐴'));
  process.exit(0);
}

// ============================================================================
// Raw Mode 输入
// ============================================================================

function setupInput() {
  if (!process.stdin.isTTY) return;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', async (data: string) => {
    const char = data.charAt(0);

    // Ctrl+C
    if (char === '\x03') {
      await shutdown();
      return;
    }

    if (isLoading) return;

    // Enter
    if (char === '\r' || char === '\n') {
      if (inputBuffer.trim()) {
        await handleSubmit(inputBuffer);
      }
      return;
    }

    // Backspace
    if (char === '\x7f') {
      inputBuffer = inputBuffer.slice(0, -1);
      redraw();
      return;
    }

    // 正常字符
    if (char.length === 1 && char.charCodeAt(0) >= 32) {
      inputBuffer += char;
      redraw();
    }
  });
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

  const config = store.getSnapshot().config;
  runtime = await init({
    name: config.name,
    mode: config.mode as any,
    logLevel: config.logLevel,
  });

  process.on('SIGINT', async () => {
    await shutdown();
  });
  process.on('SIGTERM', async () => {
    await shutdown();
  });

  await runtime.start();

  // 隐藏光标
  process.stdout.write('\x1b[?25l');

  // 初始渲染
  redraw();

  // 设置输入
  setupInput();
}

main().catch(err => {
  console.error(ERROR('[OpenHorse] Fatal error:'), err);
  process.exit(1);
});
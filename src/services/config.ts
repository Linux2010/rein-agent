/**
 * rein-agent - 配置加载
 *
 * 配置加载优先级：
 *   1. 命令行参数
 *   2. 环境变量
 *   3. .env 文件 (dotenv 已在 cli.ts 加载)
 *   4. 默认值
 */

// ============================================================================
// 类型定义
// ============================================================================

/** Rein 全局配置 */
export interface ReinCLIConfig {
  /** LLM API Key */
  apiKey: string;
  /** LLM API Base URL */
  apiBaseUrl?: string;
  /** 模型名称 */
  model: string;
  /** 最大输出 token */
  maxTokens: number;
  /** 温度 */
  temperature: number;
  /** 实例名称 */
  name: string;
  /** 运行模式 */
  mode: 'development' | 'production';
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULTS: Partial<ReinCLIConfig> = {
  model: 'gpt-4o',
  maxTokens: 4096,
  temperature: 0.7,
  name: 'rein-agent',
  mode: 'development',
  logLevel: 'info',
};

// ============================================================================
// 加载配置
// ============================================================================

/**
 * 从环境变量加载配置
 */
export function loadConfig(overrides: Partial<ReinCLIConfig> = {}): ReinCLIConfig {
  const config: ReinCLIConfig = {
    apiKey: overrides.apiKey ?? process.env.REIN_API_KEY ?? '',
    apiBaseUrl: overrides.apiBaseUrl ?? process.env.REIN_API_BASE_URL ?? undefined,
    model: overrides.model ?? process.env.REIN_MODEL ?? DEFAULTS.model!,
    maxTokens: overrides.maxTokens ?? parseNum(process.env.REIN_MAX_TOKENS) ?? DEFAULTS.maxTokens!,
    temperature:
      overrides.temperature ??
      parseNum(process.env.REIN_TEMPERATURE) ??
      DEFAULTS.temperature!,
    name: overrides.name ?? process.env.REIN_NAME ?? DEFAULTS.name!,
    mode: (overrides.mode ?? process.env.REIN_MODE ?? DEFAULTS.mode!) as 'development' | 'production',
    logLevel: (overrides.logLevel ?? process.env.REIN_LOG_LEVEL ?? DEFAULTS.logLevel!) as ReinCLIConfig['logLevel'],
  };

  return config;
}

/**
 * 检查 API Key 是否已配置
 */
export function isConfigured(config: ReinCLIConfig): boolean {
  return Boolean(config.apiKey);
}

/**
 * 获取缺失配置的提示信息
 */
export function getConfigErrors(config: ReinCLIConfig): string[] {
  const errors: string[] = [];
  if (!config.apiKey) {
    errors.push('Missing REIN_API_KEY. Set it in .env file or environment variable.');
  }
  return errors;
}

/**
 * 获取配置摘要（隐藏 Key 值）
 */
export function getConfigSummary(config: ReinCLIConfig): Record<string, string> {
  return {
    name: config.name,
    model: config.model,
    apiBaseUrl: config.apiBaseUrl || '(default OpenAI)',
    apiKey: config.apiKey ? `${config.apiKey.slice(0, 7)}***` : '(not set)',
    maxTokens: String(config.maxTokens),
    temperature: String(config.temperature),
    mode: config.mode,
    logLevel: config.logLevel,
  };
}

// ---- Internal ----

function parseNum(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const num = Number(val);
  return Number.isNaN(num) ? undefined : num;
}

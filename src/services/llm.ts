/**
 * rein-agent - LLM 服务层
 *
 * 封装 OpenAI 兼容 API，支持流式和非流式调用。
 * 兼容 OpenAI、Claude (via proxy)、本地 Ollama 等。
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// ============================================================================
// 类型定义
// ============================================================================

/** LLM 配置 */
export interface LLMConfig {
  /** API Key */
  apiKey: string;
  /** API Base URL（兼容第三方） */
  baseUrl?: string;
  /** 模型名称 */
  model: string;
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** 温度 */
  temperature?: number;
  /** 请求超时 (ms) */
  timeout?: number;
}

/** 对话消息 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** LLM 响应 */
export interface LLMResponse {
  /** 回复内容 */
  content: string;
  /** Token 用量 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  /** 使用的模型 */
  model: string;
}

/** 流式回调 */
export type StreamCallback = (chunk: string) => void;

// ============================================================================
// LLMService
// ============================================================================

export class LLMService {
  private client: OpenAI;
  private config: Required<
    Pick<LLMConfig, 'model' | 'maxTokens' | 'temperature' | 'timeout'>
  >;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 60000,
      dangerouslyAllowBrowser: true,
    });

    this.config = {
      model: config.model,
      maxTokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
      timeout: config.timeout ?? 60000,
    };
  }

  /**
   * 非流式对话
   */
  async chat(messages: Message[]): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages as ChatCompletionMessageParam[],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const content = response.choices?.[0]?.message?.content ?? '';
    const usage = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
        }
      : undefined;

    return {
      content,
      usage,
      model: response.model,
    };
  }

  /**
   * 流式对话
   *
   * @param messages 对话消息
   * @param onChunk 每收到一个 chunk 时调用
   * @returns 完整响应
   */
  async chatStream(
    messages: Message[],
    onChunk: StreamCallback,
  ): Promise<LLMResponse> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages as ChatCompletionMessageParam[],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: true,
    });

    let content = '';
    let usedModel = this.config.model;

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content ?? '';
      if (text) {
        content += text;
        onChunk(text);
      }
      if (chunk.model) {
        usedModel = chunk.model;
      }
    }

    return {
      content,
      model: usedModel,
    };
  }

  /**
   * 切换模型
   */
  setModel(model: string): void {
    this.config.model = model;
  }

  /**
   * 获取当前模型
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * 获取当前配置摘要
   */
  getConfigSummary(): Record<string, string> {
    return {
      model: this.config.model,
      maxTokens: String(this.config.maxTokens),
      temperature: String(this.config.temperature),
      timeout: String(this.config.timeout),
    };
  }
}

# OpenHorse

> **OpenHorse — Universal Agent Harness Framework**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)](https://www.typescriptlang.org)

---

## 🎯 项目定位

**OpenHorse** — 一个通用的 Agent 驾驭框架。

> Agent 需要引导和约束，否则容易失控。
> OpenHorse 提供安全边界、工具调用、记忆分层和任务调度，让 Agent 在可控范围内发挥最大能力。

### 核心理念

| 维度 | 说明 |
|------|------|
| **🐴 AI 如马** | 强大的 AI 模型需要引导和约束 |
| **🪢 OpenHorse 如缰** | 精准控制方向，防止跑偏失控 |
| **🎯 Harness 系统** | 安全边界、任务约束、结果验证 |

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────┐
│         Harness 驾驭层                    │
│  目标约束 │ 边界检查 │ 结果验证 │ 安全沙箱  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          Brain 决策层                     │
│  任务分解 │ 优先级 │ 路由 │ 状态管理       │
└─────────┬─────────┬─────────┬──────────┘
          │         │         │
┌─────────▼┐ ┌──────▼──┐ ┌────▼──────┐
│ Coder    │ │Analyst  │ │Ops Agent  │
└────┬─────┘ └────┬────┘ └────┬──────┘
     │            │            │
┌────▼────────────▼────────────▼──────┐
│          Skills + Tools              │
│  Web │ Browser │ Git │ DB │ MCP     │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│          Memory 记忆层                │
│  Working │ Short-term │ Long-term    │
└─────────────────────────────────────┘
```

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0
- npm >= 9.0

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/Linux2010/openhorse.git
cd openhorse

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 启动交互式 CLI
npm start
```

### 全局安装

```bash
# 本地链接（开发模式）
npm link

# 任意目录运行
openhorse
```

### 命令行模式

```bash
# 系统状态
openhorse status

# 查看已注册 Agent
openhorse agents

# 查看安全检查配置
openhorse safety

# 提交测试任务
openhorse task "我的任务"

# 通过 Agent + LLM 执行任务
openhorse run "列出 src/ 目录中的所有文件"
```

### 交互命令

启动后进入交互模式，支持以下命令：

| 命令 | 说明 |
|------|------|
| `help` / `h` | 显示帮助信息 |
| `status` / `s` | 系统状态总览 |
| `agents` | 列出 Agent 及其状态 |
| `memory` | 记忆系统状态 |
| `safety` | 安全检查器状态 |
| `harness` | Harness 配置详情 |
| `task <name>` | 提交测试任务 |
| `task list` | 查看任务列表 |
| `run <描述>` | 通过 Agent + LLM 执行任务 |
| `chat <消息>` | 与 LLM 对话（也支持直接输入） |
| `model [name]` | 查看或切换模型 |
| `config` | 显示当前配置 |
| `clear` | 清屏 |
| `exit` / `quit` / `q` | 退出 |

---

## 🛠️ 工具调用

OpenHorse 支持 LLM 驱动的 Agent 自动调用工具：

| 工具 | 功能 |
|------|------|
| `read_file` | 读取文件内容 |
| `write_file` | 写入文件 |
| `list_files` | 列出目录 |
| `exec_command` | 执行 shell 命令 |

对话时 LLM 会自动判断是否需要调用工具，并展示执行结果。

---

## 📚 文档

| 文档 | 说明 |
|------|------|
| [整体架构设计](docs/architecture.md) | 6 层架构、模块职责、技术选型、MVP 范围 |
| [Harness 驾驭系统](docs/harness-design.md) | 四层防御：目标约束/边界检查/结果验证/安全沙箱 |
| [记忆系统设计](docs/memory-system.md) | 三层记忆：Working/Short-term/Long-term |
| [Agent 生命周期](docs/agent-lifecycle.md) | 5 状态状态机、Brain 调度、多 Agent 协作 |

---

## 📁 项目结构

```
openhorse/
├── bin/
│   └── openhorse            # CLI 入口（支持多路径 .env 加载）
├── src/
│   ├── cli.ts               # 命令行交互入口
│   ├── index.ts             # 公共 API 导出
│   ├── init.ts              # 统一初始化入口
│   ├── core/
│   │   ├── agent.ts         # Agent 基类
│   │   └── brain.ts         # 决策引擎
│   ├── agents/
│   │   ├── leader.ts        # 协调者 Agent
│   │   └── coder.ts         # 编码专家 Agent
│   ├── harness/
│   │   ├── safety.ts        # 安全边界检查
│   │   └── harness.ts       # Harness 引擎
│   ├── memory/
│   │   └── store.ts         # 记忆系统存储
│   ├── services/
│   │   ├── llm.ts           # LLM 服务（含工具调用）
│   │   ├── config.ts        # 配置加载
│   │   ├── agent-runner.ts  # Agent 执行器
│   │   └── task-manager.ts  # 任务管理器
│   ├── tools/
│   │   └── index.ts         # 工具集
│   └── ui/
│       ├── box.ts           # UI 组件（输入框、spinner、工具块）
│       └── markdown.ts      # 终端 Markdown 渲染
├── .env                     # 环境变量配置
├── .env.example             # 环境变量模板
├── package.json
└── tsconfig.json
```

---

## 📦 核心特性

| 特性 | 说明 |
|------|------|
| **Harness 驾驭系统** | 目标约束、边界检查、结果验证 |
| **多 Agent 编排** | Leader/Worker 协作模式 |
| **工具调用 (Function Calling)** | LLM 自动读取文件、执行命令 |
| **Claude Code 风格 UI** | 输入框、thinking spinner、markdown 渲染 |
| **记忆分层** | 工作记忆 / 短期 / 长期 |
| **安全边界** | 操作白名单、危险模式检测、审计日志 |
| **任务驱动** | 优先级调度、能力匹配 |
| **CLI 全局安装** | 任意目录运行，支持 `~/.openhorse.env` |

---

## 🔧 开发

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 代码检查
npm run lint

# 格式化
npm run format
```

---

## 📝 环境变量

复制 `.env.example` 为 `.env` 进行配置，或放置 `~/.openhorse.env` 全局生效：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENHORSE_MODE` | `development` | 运行模式 |
| `OPENHORSE_LOG_LEVEL` | `info` | 日志级别 |
| `OPENHORSE_NAME` | `openhorse` | 实例名称 |
| `OPENHORSE_API_KEY` | - | LLM API Key |
| `OPENHORSE_API_BASE_URL` | - | LLM API Base URL |
| `OPENHORSE_MODEL` | `gpt-4o` | 模型名称 |
| `OPENHORSE_MAX_TOKENS` | `4096` | 最大输出 token |
| `OPENHORSE_TEMPERATURE` | `0.7` | 温度 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📝 许可

MIT License - See [LICENSE](LICENSE) for details

---

**OpenHorse — Universal Agent Harness Framework.**

# Rein

> **Rein the AI, Unleash the Potential.**  
> 通用 Agent 驾驭框架 — Universal Agent Harness Framework

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)](https://www.typescriptlang.org)

---

## 🎯 项目定位

**Rein**（缰绳）—— 让 Agent 不跑偏的通用驾驭框架。

> Agent 容易跑偏，所以需要 Harness。  
> Rein 就是那根缰绳：给 AI 自由度，同时保持控制力。

### 核心理念

| 维度 | 说明 |
|------|------|
| **🐴 AI 如马** | 强大的 AI 模型需要引导和约束 |
| **🪢 Rein 如缰** | 精准控制方向，防止跑偏失控 |
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

```bash
# 克隆项目
git clone https://github.com/Linux2010/rein-agent.git
cd rein-agent

# 安装依赖
npm install

# 运行
npm start
```

---

## 📦 核心特性

| 特性 | 说明 |
|------|------|
| **Harness 驾驭系统** | 目标约束、边界检查、结果验证 |
| **多 Agent 编排** | Leader/Worker 协作模式 |
| **技能插件化** | 可扩展 Skills 和 Tools |
| **记忆分层** | 工作记忆 / 短期 / 长期 |
| **任务驱动** | OpenTask 集成 |
| **本地优先** | 隐私保护，可选云端 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📝 许可

MIT License - See [LICENSE](LICENSE) for details

---

**Rein the AI, Unleash the Potential.** 🐴

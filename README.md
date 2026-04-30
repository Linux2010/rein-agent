# x-agent

> 通用 Agent 智能体框架 - Universal Agent Intelligence Framework

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)](https://www.typescriptlang.org)

---

## 🎯 项目定位

**x-agent** 是一个通用的 AI Agent 智能体框架，旨在：

- 🧠 **多智能体协作** - 支持多个 Agent 协同工作
- 🔌 **插件化架构** - 通过 Skills 和 Tools 扩展能力
- 🌐 **多渠道接入** - 支持 Telegram/Discord/Web 等消息渠道
- 📋 **任务驱动** - 基于 OpenTask 的任务分发和执行
- 🔄 **自适应学习** - 持续优化 Agent 行为和能力

---

## 🏗️ 架构设计

```
x-agent/
├── src/
│   ├── core/          # 核心引擎
│   │   ├── agent.ts   # Agent 基类
│   │   ├── brain.ts   # 决策引擎
│   │   └── memory.ts  # 记忆系统
│   ├── agents/        # 预置 Agent
│   │   ├── leader.ts  # 协调者 Agent
│   │   ├── coder.ts   # 编码 Agent
│   │   └── analyst.ts # 分析 Agent
│   ├── skills/        # 技能库
│   ├── tools/         # 工具集
│   └── utils/         # 工具函数
├── config/            # 配置文件
├── docs/              # 文档
└── tests/             # 测试
```

---

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/Linux2010/x-agent.git
cd x-agent

# 安装依赖
npm install

# 运行
npm start
```

---

## 📦 核心特性

| 特性 | 说明 |
|------|------|
| **多 Agent 编排** | 支持 Leader/Worker 模式 |
| **技能系统** | 可扩展的 Skills 和 Tools |
| **记忆管理** | 短期/长期记忆支持 |
| **任务分发** | 集成 OpenTask 任务系统 |
| **渠道适配** | Telegram/Discord/Web 支持 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📝 许可

MIT License - See [LICENSE](LICENSE) for details

---

**Version**: 0.1.0  
**Created**: 2026-04-30  
**Author**: [Linux2010](https://github.com/Linux2010)

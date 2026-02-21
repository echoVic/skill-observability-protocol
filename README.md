# Skill Transparency & Observability Protocol (STOP)

> Stop. Look inside. Understand what your skills actually do.
>
> 停下来，看清楚——你的 Skill 到底做了什么。

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## What is this?

STOP is an open specification for Agent Skill observability. It defines how skills declare their capabilities, emit execution traces, and verify outcomes — so developers and users can understand what a skill did, why it did it, and whether it succeeded.

## Why?

Agent Skills today are black boxes. You invoke one, something happens (or doesn't), and you have no structured way to understand the execution. As the skill ecosystem scales (40,000+ skills on platforms like SundialHub), this opacity becomes a real problem:

- **Debugging is guesswork** — when a skill fails, you read logs and pray
- **Trust is binary** — you either trust a skill completely or not at all
- **Composition is fragile** — chaining skills without observability is like piping commands with no stderr
- **Security review is manual** — no standard way to audit what a skill actually does

STOP fixes this by bringing SRE-grade observability (Logs, Metrics, Traces) to the skill layer.

## Spec Documents

| Document | Description |
|----------|-------------|
| [spec/manifest.md](spec/manifest.md) | Skill Manifest (`skill.yaml`) — declarative capability description |
| [spec/trace.md](spec/trace.md) | Execution Trace format — structured runtime telemetry |
| [spec/assertions.md](spec/assertions.md) | Post-condition assertions — verifiable success criteria |
| [spec/levels.md](spec/levels.md) | Observability levels — progressive adoption from L0 to L3 |

## Quick Example

```yaml
# skill.yaml (Manifest)
sop: "0.1"
name: github-issue-creator
version: 1.0.0
description: Create GitHub issues from bug reports or feature requests

inputs:
  - name: repo
    type: string
    required: true
    description: GitHub repository (owner/repo)
  - name: title
    type: string
    required: true
    description: Issue title
  - name: body
    type: string
    required: false
    description: Issue body (markdown)

outputs:
  - name: issue_url
    type: url
    description: Created issue URL
  - name: issue_number
    type: number
    description: Issue number

tools_used:
  - exec

side_effects:
  - type: network
    description: POST to GitHub API
    destinations: ["api.github.com"]

requirements:
  env_vars: [GITHUB_TOKEN]

assertions:
  pre:
    - check: env_var
      name: GITHUB_TOKEN
      message: "GitHub token required"
  post:
    - check: output.issue_url
      matches: "^https://github\\.com/.+/issues/\\d+$"
    - check: output.issue_number
      greater_than: 0
```

## Observability Levels

STOP is designed for progressive adoption:

| Level | Name | What You Get |
|-------|------|-------------|
| L0 | Manifest | `skill.yaml` with inputs/outputs/side_effects declaration |
| L1 | Trace | Structured execution spans emitted at runtime |
| L2 | Assertions | Pre/post-condition checks with pass/fail signals |
| L3 | Full | Metrics, cost tracking, anomaly baselines |

Start at L0 (just a manifest file), adopt more as needed.

## Packages

STOP ships three npm packages for immediate use:

| Package | Description | Install |
|---------|-------------|---------|
| [`stop-cli`](https://www.npmjs.com/package/stop-cli) | CLI tool — `stop init` / `stop validate` | `npm i -g stop-cli` |
| [`stop-runtime`](https://www.npmjs.com/package/stop-runtime) | Runtime SDK — manifest loader, assertion runner, trace emitter | `npm i stop-runtime` |
| [`stop-mcp`](https://www.npmjs.com/package/stop-mcp) | MCP Server — works with Claude Code, opencode, Cursor, etc. | `npm i -g stop-mcp` |

### CLI Quick Start

```bash
# Generate a skill.yaml interactively
npx stop-cli init

# Validate a skill.yaml
npx stop-cli validate
```

### Runtime SDK

```typescript
import { loadManifest, runAssertions, createTracer } from 'stop-runtime';

const manifest = loadManifest('./skill.yaml');

// Pre-checks
const pre = runAssertions(manifest.assertions.pre, { env: process.env }, 'pre');

// Trace execution
const tracer = createTracer(manifest);
const span = tracer.startSpan('tool.call', 'exec: my-command');
tracer.endSpan(span, 'ok');
tracer.finish('ok');
tracer.writeTo(); // → .sop/traces/
```

### MCP Integration

Add to your MCP config (`claude_desktop_config.json`, `.mcp.json`, etc.):

```json
{
  "mcpServers": {
    "stop": {
      "command": "npx",
      "args": ["stop-mcp"]
    }
  }
}
```

Provides 5 tools: `stop_validate`, `stop_check`, `stop_manifest`, `stop_trace_list`, `stop_trace_view`.

## Status

🚧 **Draft** — This is an early-stage specification. Everything is subject to change.

## Contributing

Open an issue or PR. This spec should be shaped by the community, not dictated by one project.

## License

CC-BY-4.0

---

<a id="中文"></a>

## 这是什么？

STOP 是一个面向 Agent Skill 可观测性的开放规范。它定义了 Skill 如何声明自身能力、输出执行追踪、验证执行结果——让开发者和用户能够理解一个 Skill 做了什么、为什么这么做、以及是否成功。

## 为什么需要它？

当前的 Agent Skill 是黑盒。你调用一个 Skill，某些事情发生了（或者没有），但你没有任何结构化的方式来理解执行过程。随着 Skill 生态的扩张（SundialHub 等平台已有 40,000+ skills），这种不透明性成为了真实的问题：

- **调试靠猜** — Skill 失败时，你只能翻日志然后祈祷
- **信任是二元的** — 要么完全信任一个 Skill，要么完全不信
- **组合很脆弱** — 在没有可观测性的情况下串联 Skill，就像管道命令没有 stderr
- **安全审计靠人工** — 没有标准方式审计一个 Skill 实际做了什么

STOP 将 SRE 级别的可观测性三支柱（日志、指标、追踪）引入 Skill 层来解决这些问题。

## 规范文档

| 文档 | 说明 |
|------|------|
| [spec/manifest.md](spec/manifest.md) | Skill 清单（`skill.yaml`）— 声明式能力描述 |
| [spec/trace.md](spec/trace.md) | 执行追踪格式 — 结构化运行时遥测 |
| [spec/assertions.md](spec/assertions.md) | 断言系统 — 可验证的成功标准 |
| [spec/levels.md](spec/levels.md) | 可观测性等级 — 从 L0 到 L3 渐进式采纳 |

## 快速示例

```yaml
# skill.yaml（清单）
sop: "0.1"
name: github-issue-creator
version: 1.0.0
description: 从 Bug 报告或功能请求创建 GitHub Issue

inputs:
  - name: repo
    type: string
    required: true
    description: GitHub 仓库（owner/repo 格式）
  - name: title
    type: string
    required: true
    description: Issue 标题
  - name: body
    type: string
    required: false
    description: Issue 正文（markdown）

outputs:
  - name: issue_url
    type: url
    description: 创建的 Issue 链接
  - name: issue_number
    type: number
    description: Issue 编号

tools_used:
  - exec

side_effects:
  - type: network
    description: POST 请求到 GitHub API
    destinations: ["api.github.com"]

requirements:
  env_vars: [GITHUB_TOKEN]

assertions:
  pre:
    - check: env_var
      name: GITHUB_TOKEN
      message: "需要 GitHub Token"
  post:
    - check: output.issue_url
      matches: "^https://github\\.com/.+/issues/\\d+$"
    - check: output.issue_number
      greater_than: 0
```

## 可观测性等级

STOP 支持渐进式采纳：

| 等级 | 名称 | 你能获得什么 |
|------|------|-------------|
| L0 | 清单 | `skill.yaml` 声明输入/输出/副作用 |
| L1 | 追踪 | 运行时输出结构化执行 span |
| L2 | 断言 | 前置/后置条件检查，带通过/失败信号 |
| L3 | 完整 | 指标、成本追踪、异常基线 |

从 L0 开始（只需一个清单文件），按需逐步采纳。

## 工具包

STOP 提供三个 npm 包，开箱即用：

| 包名 | 说明 | 安装 |
|------|------|------|
| [`stop-cli`](https://www.npmjs.com/package/stop-cli) | CLI 工具 — `stop init` / `stop validate` | `npm i -g stop-cli` |
| [`stop-runtime`](https://www.npmjs.com/package/stop-runtime) | Runtime SDK — manifest 解析、断言验证、执行追踪 | `npm i stop-runtime` |
| [`stop-mcp`](https://www.npmjs.com/package/stop-mcp) | MCP Server — 适配 Claude Code、opencode、Cursor 等 | `npm i -g stop-mcp` |

### CLI 快速开始

```bash
# 交互式生成 skill.yaml
npx stop-cli init

# 校验 skill.yaml
npx stop-cli validate
```

### Runtime SDK

```typescript
import { loadManifest, runAssertions, createTracer } from 'stop-runtime';

const manifest = loadManifest('./skill.yaml');

// 前置检查
const pre = runAssertions(manifest.assertions.pre, { env: process.env }, 'pre');

// 执行追踪
const tracer = createTracer(manifest);
const span = tracer.startSpan('tool.call', 'exec: my-command');
tracer.endSpan(span, 'ok');
tracer.finish('ok');
tracer.writeTo(); // → .sop/traces/
```

### MCP 集成

在 MCP 配置中添加（`claude_desktop_config.json`、`.mcp.json` 等）：

```json
{
  "mcpServers": {
    "stop": {
      "command": "npx",
      "args": ["stop-mcp"]
    }
  }
}
```

提供 5 个工具：`stop_validate`、`stop_check`、`stop_manifest`、`stop_trace_list`、`stop_trace_view`。

## 状态

🚧 **草案** — 这是一个早期规范，所有内容都可能变更。

## 参与贡献

欢迎提 Issue 或 PR。这个规范应该由社区共同塑造，而不是由某个项目单方面决定。

## 许可证

CC-BY-4.0

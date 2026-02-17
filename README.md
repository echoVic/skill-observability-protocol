# Skill Observability Protocol (SOP)

> Making Agent Skills transparent, debuggable, and trustworthy.

## What is this?

SOP is an open specification for Agent Skill observability. It defines how skills declare their capabilities, emit execution traces, and verify outcomes — so developers and users can understand what a skill did, why it did it, and whether it succeeded.

## Why?

Agent Skills today are black boxes. You invoke one, something happens (or doesn't), and you have no structured way to understand the execution. As the skill ecosystem scales (40,000+ skills on platforms like SundialHub), this opacity becomes a real problem:

- **Debugging is guesswork** — when a skill fails, you read logs and pray
- **Trust is binary** — you either trust a skill completely or not at all
- **Composition is fragile** — chaining skills without observability is like piping commands with no stderr
- **Security review is manual** — no standard way to audit what a skill actually does

SOP fixes this by bringing SRE-grade observability (Logs, Metrics, Traces) to the skill layer.

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
name: juejin-publish
version: 1.0.0
description: Publish articles to Juejin tech community

inputs:
  - name: article_path
    type: file_path
    required: true
    description: Path to the markdown article file

outputs:
  - name: article_url
    type: url
    description: Published article URL

tools_used:
  - web_fetch
  - exec

side_effects:
  - type: network
    description: POST to juejin.cn API
  - type: filesystem
    access: read
    paths: ["${inputs.article_path}"]

assertions:
  post:
    - check: output.article_url
      matches: "^https://juejin\\.cn/post/\\d+$"
    - check: http_status
      equals: 200
```

## Observability Levels

SOP is designed for progressive adoption:

| Level | Name | What You Get |
|-------|------|-------------|
| L0 | Manifest | `skill.yaml` with inputs/outputs/side_effects declaration |
| L1 | Trace | Structured execution spans emitted at runtime |
| L2 | Assertions | Pre/post-condition checks with pass/fail signals |
| L3 | Full | Metrics, cost tracking, anomaly baselines |

Start at L0 (just a manifest file), adopt more as needed.

## Status

🚧 **Draft** — This is an early-stage specification. Everything is subject to change.

## Contributing

Open an issue or PR. This spec should be shaped by the community, not dictated by one project.

## License

CC-BY-4.0

# STOP Spec: Skill Manifest (`skill.yaml`)

> Version: 0.1.0-draft

## Overview

The Skill Manifest is a machine-readable file (`skill.yaml`) that declares what a skill is, what it needs, what it does, and what it produces. It serves as the "contract" between a skill and its runtime environment.

Think of it as `package.json` for skills — but focused on observability and trust, not dependency management.

## File Location

```
my-skill/
├── SKILL.md          # Human-readable instructions (existing convention)
├── skill.yaml        # Machine-readable manifest (STOP)
└── ...
```

`skill.yaml` lives alongside `SKILL.md`. They complement each other: SKILL.md tells the agent *how* to use the skill; skill.yaml tells the runtime *what* the skill does.

## Schema

```yaml
# Required
sop: "0.1"                    # STOP spec version
name: string                  # Unique skill identifier (kebab-case)
version: string               # Semver version
description: string           # One-line description

# Optional metadata
author: string                # Author name or org
license: string               # SPDX license identifier
repository: string            # Source code URL
tags: [string]                # Discovery tags

# Capability declaration
inputs:
  - name: string              # Parameter name
    type: enum                # See "Types" below
    required: boolean         # Default: false
    description: string
    default: any              # Default value if not provided
    constraints:              # Optional validation
      pattern: string         # Regex pattern
      enum: [any]             # Allowed values
      min: number
      max: number

outputs:
  - name: string
    type: enum
    description: string
    guaranteed: boolean       # Always present vs best-effort (default: false)

# Tool & resource declaration
tools_used:
  - string                    # Tool names this skill may invoke

side_effects:
  - type: enum                # filesystem | network | message | exec | state
    access: enum              # read | write | delete (for filesystem)
    description: string
    paths: [string]           # Affected paths (supports ${inputs.x} interpolation)
    destinations: [string]    # Network targets or message channels

# Runtime requirements
requirements:
  env_vars: [string]          # Required environment variables
  files: [string]             # Required files to exist
  tools: [string]             # Required tools (fail if unavailable)
  capabilities: [string]      # Required runtime capabilities

# Assertions (see assertions.md for full spec)
assertions:
  pre: [AssertionRule]        # Must pass before execution
  post: [AssertionRule]       # Must pass after execution

# Observability config
observability:
  level: enum                 # L0 | L1 | L2 | L3 (default: L0)
  trace_sampling: number      # 0.0-1.0, fraction of runs to trace (default: 1.0)
  metrics:
    - name: string
      type: enum              # counter | gauge | histogram
      description: string
```

## Types

Supported types for inputs and outputs:

| Type | Description | Example |
|------|-------------|---------|
| `string` | Free-form text | `"hello world"` |
| `number` | Integer or float | `42`, `3.14` |
| `boolean` | True/false | `true` |
| `file_path` | Path to a file | `./article.md` |
| `dir_path` | Path to a directory | `./output/` |
| `url` | HTTP(S) URL | `https://example.com` |
| `json` | Arbitrary JSON object | `{"key": "value"}` |
| `array` | List of values | `["a", "b"]` |
| `enum` | One of predefined values | (use constraints.enum) |

## Side Effect Types

| Type | Description |
|------|-------------|
| `filesystem` | Reads, writes, or deletes files |
| `network` | Makes HTTP/API calls |
| `message` | Sends messages to channels (Telegram, Slack, etc.) |
| `exec` | Runs shell commands |
| `state` | Modifies agent state (memory, config) |

## Examples

### Minimal (L0)

```yaml
sop: "0.1"
name: file-organizer
version: 1.0.0
description: Organize files by extension into subfolders

inputs:
  - name: directory
    type: dir_path
    required: true

outputs:
  - name: files_moved
    type: number
    guaranteed: true

side_effects:
  - type: filesystem
    access: write
    description: Moves files into categorized subdirectories
```

### Full (L2)

```yaml
sop: "0.1"
name: juejin-publish
version: 1.2.0
description: Publish markdown articles to Juejin tech community
author: echoVic
license: MIT
repository: https://github.com/echoVic/blade-code
tags: [publishing, juejin, chinese-tech]

inputs:
  - name: article_path
    type: file_path
    required: true
    description: Path to the markdown article
    constraints:
      pattern: "\\.md$"
  - name: category
    type: string
    required: false
    default: "frontend"
    constraints:
      enum: [frontend, backend, ai, devops, mobile]

outputs:
  - name: article_url
    type: url
    description: Published article URL
    guaranteed: true
  - name: article_id
    type: string
    description: Juejin article ID
    guaranteed: true

tools_used:
  - exec
  - web_fetch
  - read

side_effects:
  - type: filesystem
    access: read
    paths: ["${inputs.article_path}"]
  - type: network
    description: POST to juejin.cn/api
    destinations: ["juejin.cn"]

requirements:
  env_vars: [JUEJIN_SESSION_ID]
  files: [skills/juejin-publish/publish.py]

assertions:
  pre:
    - check: file_exists
      path: "${inputs.article_path}"
      message: "Article file must exist"
    - check: env_var
      name: JUEJIN_SESSION_ID
      message: "Juejin session ID required"
  post:
    - check: output.article_url
      matches: "^https://juejin\\.cn/post/\\d+$"
    - check: output.article_id
      not_empty: true

observability:
  level: L2
  metrics:
    - name: publish_duration_ms
      type: histogram
      description: Time to publish article
    - name: publish_success_total
      type: counter
      description: Successful publishes
```

## Validation

A manifest is valid if:

1. `sop`, `name`, `version`, `description` are present
2. All `inputs[].type` and `outputs[].type` are recognized types
3. All `side_effects[].type` are recognized effect types
4. `${inputs.x}` interpolations reference declared input names
5. `assertions` reference valid check types (see assertions.md)

Runtimes SHOULD validate manifests at skill load time and emit warnings for invalid manifests.

## Relationship to SKILL.md

| Aspect | SKILL.md | skill.yaml |
|--------|----------|------------|
| Audience | Agent (LLM) | Runtime (machine) |
| Format | Free-form markdown | Structured YAML |
| Purpose | How to use the skill | What the skill does |
| Required by STOP | No | Yes (L0+) |

Both files SHOULD be kept in sync. A linter can verify consistency between them.

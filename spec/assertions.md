# STOP Spec: Assertions

> Version: 0.1.0-draft

## Overview

Assertions are verifiable conditions that a skill declares about its execution. They answer the question: **"How do I know this skill actually worked?"**

Pre-conditions validate the environment before execution. Post-conditions validate the results after execution. Together, they turn skill success from "it didn't crash" into "it provably did what it claimed."

## Why Assertions?

Without assertions, skill success is determined by:
1. No error was thrown (weak signal)
2. The LLM said it worked (unreliable)
3. A human checked manually (doesn't scale)

With assertions:
1. Machine-verifiable success criteria
2. Automatic regression detection
3. Trust scores based on assertion pass rates

## Assertion Schema

```yaml
assertions:
  pre:
    - check: <check_type>
      <check_params>
      message: string        # Human-readable failure message
      severity: error | warn # error = block execution, warn = log and continue
  post:
    - check: <check_type>
      <check_params>
      message: string
      severity: error | warn
```

## Check Types

### `file_exists`
Verify a file exists.

```yaml
- check: file_exists
  path: "${inputs.article_path}"
  message: "Article file must exist"
```

### `file_not_empty`
Verify a file exists and has content.

```yaml
- check: file_not_empty
  path: "./output/result.json"
  message: "Output file should not be empty"
```

### `file_matches`
Verify file content matches a pattern.

```yaml
- check: file_matches
  path: "./output/result.json"
  pattern: "\"status\":\\s*\"success\""
  message: "Result should contain success status"
```

### `env_var`
Verify an environment variable is set.

```yaml
- check: env_var
  name: API_KEY
  message: "API key must be configured"
```

### `tool_available`
Verify a tool is available in the runtime.

```yaml
- check: tool_available
  tool: exec
  message: "Shell execution required"
```

### `output.*`
Verify output field values (post-conditions only).

```yaml
# Check output exists and is not empty
- check: output.article_url
  not_empty: true

# Check output matches pattern
- check: output.article_url
  matches: "^https://juejin\\.cn/post/\\d+$"

# Check output equals value
- check: output.status
  equals: "published"

# Check numeric output
- check: output.files_moved
  greater_than: 0
```

### `http_status`
Verify HTTP response status (requires L1+ tracing).

```yaml
- check: http_status
  url_pattern: "juejin.cn"  # Match against traced HTTP requests
  equals: 200
```

### `duration`
Verify execution completed within time limit.

```yaml
- check: duration
  max_ms: 30000
  message: "Skill should complete within 30 seconds"
```

### `custom`
Run a custom validation script.

```yaml
- check: custom
  command: "python3 validate.py ${outputs.result_path}"
  exit_code: 0
  message: "Custom validation failed"
```

## Assertion Results

Assertion results are emitted as part of the execution trace:

```json
{
  "span_id": "s_assert_001",
  "kind": "assertion.check",
  "name": "post-conditions",
  "status": "ok",
  "attributes": {
    "assertions.total": 3,
    "assertions.passed": 3,
    "assertions.failed": 0,
    "assertions.results": [
      {"check": "output.article_url", "status": "pass", "value": "https://juejin.cn/post/123"},
      {"check": "output.article_id", "status": "pass", "value": "123"},
      {"check": "http_status", "status": "pass", "value": 200}
    ]
  }
}
```

## Trust Score

Runtimes MAY compute a trust score based on historical assertion results:

```
trust_score = passed_assertions / total_assertions (over last N runs)
```

| Score | Label | Meaning |
|-------|-------|---------|
| 0.95+ | ✅ Trusted | Consistently passes all assertions |
| 0.80-0.94 | ⚠️ Unstable | Occasional failures |
| < 0.80 | 🔴 Unreliable | Frequent assertion failures |

Platforms (like SundialHub) can surface trust scores to help users choose reliable skills.

## Severity Levels

- **`error`** — Assertion failure blocks execution (pre) or marks the run as failed (post)
- **`warn`** — Assertion failure is logged but execution continues

Default severity is `error` for pre-conditions and `warn` for post-conditions.

## Best Practices

1. **Start with post-conditions** — they provide the most value with least effort
2. **Use `output.*` checks liberally** — they're cheap and catch regressions
3. **Add `file_exists` pre-conditions** for file-dependent skills
4. **Set `duration` limits** to catch hanging executions
5. **Use `custom` sparingly** — prefer built-in checks for portability

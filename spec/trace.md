# STOP Spec: Execution Trace

> Version: 0.1.0-draft

## Overview

Execution Traces capture the runtime behavior of a skill — what happened, in what order, how long it took, and whether it succeeded. They are the "flight recorder" for skill execution.

Traces follow the OpenTelemetry span model, adapted for prompt-driven execution flows where "steps" may be LLM reasoning, tool calls, file reads, or conditional branches.

## Trace Structure

A trace is a tree of **spans**. Each span represents one logical step in the skill's execution.

```
Trace
└── Root Span (skill execution)
    ├── Span: read SKILL.md
    ├── Span: parse inputs
    ├── Span: tool_call(exec, "python3 publish.py ...")
    │   ├── Span: file_read(article.md)
    │   └── Span: http_post(juejin.cn/api)
    ├── Span: parse outputs
    └── Span: assertions_check
```

## Span Schema

```typescript
interface Span {
  // Identity
  span_id: string;          // Unique span ID
  trace_id: string;         // Parent trace ID
  parent_span_id?: string;  // Parent span (null for root)

  // Timing
  start_time: string;       // ISO-8601 timestamp
  end_time: string;         // ISO-8601 timestamp
  duration_ms: number;      // Computed duration

  // Classification
  kind: SpanKind;
  name: string;             // Human-readable step name
  status: "ok" | "error" | "skipped";

  // Content
  attributes: Record<string, any>;  // Key-value metadata
  events: SpanEvent[];              // Timestamped events within the span

  // Error info (if status == "error")
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
}

type SpanKind =
  | "skill.execute"      // Root span for entire skill run
  | "skill.input"        // Input parsing/validation
  | "skill.output"       // Output extraction
  | "tool.call"          // Tool invocation (exec, read, web_fetch, etc.)
  | "tool.result"        // Tool result processing
  | "file.read"          // File read operation
  | "file.write"         // File write operation
  | "http.request"       // HTTP request
  | "llm.reason"         // LLM reasoning step
  | "assertion.check"    // Pre/post-condition check
  | "branch"             // Conditional branch taken
  | "custom";            // User-defined span type

interface SpanEvent {
  timestamp: string;
  name: string;
  attributes?: Record<string, any>;
}
```

## Trace Output Format

Traces are emitted as newline-delimited JSON (NDJSON), one span per line:

```jsonl
{"trace_id":"t_abc123","span_id":"s_001","kind":"skill.execute","name":"juejin-publish","start_time":"2026-02-17T15:00:00Z","status":"ok","duration_ms":3420,"attributes":{"skill.name":"juejin-publish","skill.version":"1.2.0","sop.level":"L1"}}
{"trace_id":"t_abc123","span_id":"s_002","parent_span_id":"s_001","kind":"file.read","name":"read article","start_time":"2026-02-17T15:00:00.100Z","status":"ok","duration_ms":12,"attributes":{"file.path":"./article.md","file.size_bytes":4520}}
{"trace_id":"t_abc123","span_id":"s_003","parent_span_id":"s_001","kind":"tool.call","name":"exec: python3 publish.py","start_time":"2026-02-17T15:00:00.200Z","status":"ok","duration_ms":3100,"attributes":{"tool.name":"exec","tool.command":"python3 publish.py ./article.md"}}
{"trace_id":"t_abc123","span_id":"s_004","parent_span_id":"s_003","kind":"http.request","name":"POST juejin.cn/api","start_time":"2026-02-17T15:00:01.000Z","status":"ok","duration_ms":2200,"attributes":{"http.method":"POST","http.url":"https://juejin.cn/api/article/publish","http.status_code":200}}
{"trace_id":"t_abc123","span_id":"s_005","parent_span_id":"s_001","kind":"assertion.check","name":"post-conditions","start_time":"2026-02-17T15:00:03.400Z","status":"ok","duration_ms":5,"attributes":{"assertions.total":2,"assertions.passed":2,"assertions.failed":0}}
```

## Trace Storage

Traces SHOULD be written to a predictable location:

```
.sop/
└── traces/
    ├── 2026-02-17T150000Z_juejin-publish_t_abc123.jsonl
    └── 2026-02-17T143000Z_file-organizer_t_def456.jsonl
```

Filename pattern: `{timestamp}_{skill-name}_{trace-id}.jsonl`

Runtimes MAY also forward traces to external collectors (OpenTelemetry, Jaeger, etc.) via OTLP.

## Trace Context Propagation

When skills invoke other skills (composition), the parent trace ID MUST be propagated:

```yaml
# Parent skill trace
trace_id: t_parent
span_id: s_010
kind: tool.call
name: "invoke skill: validate-markdown"
attributes:
  child_trace_id: t_child    # Link to child skill's trace
```

This enables end-to-end tracing across skill chains.

## Sensitive Data

Traces MUST NOT contain:
- Credentials, tokens, API keys
- Full file contents (use size/hash instead)
- PII unless explicitly opted in

Traces SHOULD redact:
- Environment variable values (log names only)
- HTTP request/response bodies (log status + size)
- Command arguments containing paths to sensitive files

## Sampling

At L1+, all executions are traced by default. For high-frequency skills, configure sampling:

```yaml
# In skill.yaml
observability:
  trace_sampling: 0.1  # Trace 10% of executions
```

Error executions SHOULD always be traced regardless of sampling rate.

## Relationship to Observability Levels

| Level | Trace Behavior |
|-------|---------------|
| L0 | No traces emitted |
| L1 | Root span + direct child spans |
| L2 | Full span tree + assertion spans |
| L3 | Full spans + metrics + cost tracking |

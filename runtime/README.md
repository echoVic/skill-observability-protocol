# @stop-protocol/runtime

Runtime SDK for [STOP — Skill Transparency & Observability Protocol](https://github.com/echoVic/stop-protocol).

## Install

```bash
npm install @stop-protocol/runtime
```

## Usage

```typescript
import { loadManifest, runAssertions, createTracer } from '@stop-protocol/runtime';

// Load manifest
const manifest = loadManifest('./skill.yaml');

// Run pre-checks
const preResults = runAssertions(manifest.assertions.pre, {
  env: process.env,
  tools: ['exec', 'read'],
}, 'pre');

// Create tracer (L1+)
const tracer = createTracer(manifest);
const spanId = tracer.startSpan('tool.call', 'exec: python3 publish.py');

// ... do work ...

tracer.endSpan(spanId, 'ok');

// Run post-checks
const postResults = runAssertions(manifest.assertions.post, {
  outputs: { article_url: 'https://juejin.cn/post/123' },
}, 'post');

// Finish and write trace
tracer.finish('ok');
tracer.writeTo(); // writes to .sop/traces/
```

## API

- `loadManifest(path)` — Parse a skill.yaml file
- `parseManifest(yamlStr)` — Parse YAML string
- `runAssertions(rules, context, phase)` — Run pre/post assertions
- `createTracer(manifest)` — Create a trace emitter

## License

MIT

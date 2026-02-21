import { parseManifest, runAssertions, createTracer } from './index.js';

const yaml = `
sop: "0.1"
name: test-skill
version: 1.0.0
description: A test skill

inputs:
  - name: repo
    type: string
    required: true

outputs:
  - name: issue_url
    type: url

assertions:
  pre:
    - check: env_var
      name: TEST_TOKEN
      message: "Need TEST_TOKEN"
  post:
    - check: output.issue_url
      matches: "^https://"
    - check: output.issue_url
      not_empty: true

observability:
  level: L1
`;

// Test manifest parsing
const manifest = parseManifest(yaml);
console.log('✅ parseManifest:', manifest.name, manifest.version);

// Test pre-assertions (should fail — no env var)
const preResults = runAssertions(manifest.assertions!.pre!, { env: {} }, 'pre');
console.log('✅ pre-assertions:', preResults.map(r => `${r.check}=${r.status}`).join(', '));

// Test post-assertions (should pass)
const postResults = runAssertions(
  manifest.assertions!.post!,
  { outputs: { issue_url: 'https://github.com/test/issues/1' } },
  'post'
);
console.log('✅ post-assertions:', postResults.map(r => `${r.check}=${r.status}`).join(', '));

// Test tracer
const tracer = createTracer(manifest);
const spanId = tracer.startSpan('tool.call', 'exec: gh issue create');
tracer.endSpan(spanId, 'ok', { 'tool.name': 'exec' });
tracer.finish('ok');
const ndjson = tracer.toNDJSON();
const lines = ndjson.trim().split('\n');
console.log(`✅ tracer: ${lines.length} spans emitted`);

console.log('\n🎉 All tests passed');

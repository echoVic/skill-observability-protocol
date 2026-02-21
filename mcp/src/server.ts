import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';

// ── Validation logic ───────────────────────────────────

const VALID_TYPES = new Set([
  'string', 'number', 'boolean', 'file_path', 'dir_path', 'url', 'json', 'array', 'enum',
]);
const VALID_SIDE_EFFECT_TYPES = new Set(['filesystem', 'network', 'message', 'exec', 'state']);
const VALID_LEVELS = new Set(['L0', 'L1', 'L2', 'L3']);

interface Diagnostic { level: 'error' | 'warn'; message: string; }

function validateManifest(doc: any, yamlStr: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  for (const field of ['sop', 'name', 'version', 'description']) {
    if (!doc[field]) diags.push({ level: 'error', message: `Missing required field: ${field}` });
  }
  if (doc.name && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(doc.name)) {
    diags.push({ level: 'warn', message: `name should be kebab-case: "${doc.name}"` });
  }
  const inputNames = new Set<string>();
  if (Array.isArray(doc.inputs)) {
    for (const inp of doc.inputs) {
      if (!inp.name) diags.push({ level: 'error', message: 'Input missing "name"' });
      if (inp.name) inputNames.add(inp.name);
      if (inp.type && !VALID_TYPES.has(inp.type)) diags.push({ level: 'error', message: `Input "${inp.name}": unknown type "${inp.type}"` });
    }
  }
  if (Array.isArray(doc.outputs)) {
    for (const out of doc.outputs) {
      if (!out.name) diags.push({ level: 'error', message: 'Output missing "name"' });
      if (out.type && !VALID_TYPES.has(out.type)) diags.push({ level: 'error', message: `Output "${out.name}": unknown type "${out.type}"` });
    }
  }
  if (Array.isArray(doc.side_effects)) {
    for (const se of doc.side_effects) {
      if (se.type && !VALID_SIDE_EFFECT_TYPES.has(se.type)) diags.push({ level: 'error', message: `Side effect: unknown type "${se.type}"` });
    }
  }
  if (doc.observability?.level && !VALID_LEVELS.has(doc.observability.level)) {
    diags.push({ level: 'error', message: `Unknown observability level: "${doc.observability.level}"` });
  }
  const re = /\$\{inputs\.(\w+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(yamlStr)) !== null) {
    if (!inputNames.has(m[1])) diags.push({ level: 'error', message: `\${inputs.${m[1]}} references undeclared input` });
  }
  return diags;
}

// ── Assertion runner ───────────────────────────────────

function interpolate(tpl: string, inputs: Record<string, any>): string {
  return tpl.replace(/\$\{inputs\.(\w+)\}/g, (_, k) => String(inputs?.[k] ?? ''));
}

interface AssertCtx {
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  env?: Record<string, string | undefined>;
  tools?: string[];
  duration_ms?: number;
}

function runAssertions(rules: any[], ctx: AssertCtx, phase: 'pre' | 'post') {
  return rules.map((rule: any) => {
    const sev = rule.severity ?? (phase === 'pre' ? 'error' : 'warn');
    const base = { check: rule.check, severity: sev, message: rule.message };
    try {
      if (rule.check === 'env_var') {
        const v = (ctx.env ?? process.env)[rule.name];
        return v ? { ...base, status: 'pass', value: '***' } : { ...base, status: 'fail', message: rule.message ?? `env var ${rule.name} not set` };
      }
      if (rule.check === 'file_exists') {
        const p = interpolate(rule.path, ctx.inputs ?? {});
        return fs.existsSync(p) ? { ...base, status: 'pass', value: p } : { ...base, status: 'fail', message: rule.message ?? `file not found: ${p}` };
      }
      if (rule.check === 'file_not_empty') {
        const p = interpolate(rule.path, ctx.inputs ?? {});
        if (!fs.existsSync(p)) return { ...base, status: 'fail', message: rule.message ?? `file not found: ${p}` };
        return fs.statSync(p).size > 0 ? { ...base, status: 'pass' } : { ...base, status: 'fail', message: rule.message ?? `file is empty: ${p}` };
      }
      if (rule.check === 'tool_available') {
        return ctx.tools?.includes(rule.tool) ? { ...base, status: 'pass' } : { ...base, status: 'fail', message: rule.message ?? `tool not available: ${rule.tool}` };
      }
      if (rule.check === 'duration') {
        if (ctx.duration_ms != null && ctx.duration_ms > rule.max_ms) return { ...base, status: 'fail', message: rule.message ?? `duration ${ctx.duration_ms}ms > ${rule.max_ms}ms` };
        return { ...base, status: 'pass', value: ctx.duration_ms };
      }
      if (rule.check.startsWith('output.')) {
        const field = rule.check.slice(7);
        const val = ctx.outputs?.[field];
        if (rule.not_empty && (!val || (typeof val === 'string' && !val.length))) return { ...base, status: 'fail', message: rule.message ?? `output.${field} is empty` };
        if (rule.matches && !new RegExp(rule.matches).test(String(val ?? ''))) return { ...base, status: 'fail', message: rule.message ?? `output.${field} does not match` };
        if (rule.equals !== undefined && val !== rule.equals) return { ...base, status: 'fail', message: rule.message ?? `output.${field} expected ${rule.equals}, got ${val}` };
        if (rule.greater_than !== undefined && (typeof val !== 'number' || val <= rule.greater_than)) return { ...base, status: 'fail', message: rule.message ?? `output.${field} must be > ${rule.greater_than}` };
        return { ...base, status: 'pass', value: val };
      }
      return { ...base, status: 'fail', message: `Unknown check: ${rule.check}` };
    } catch (err: any) {
      return { ...base, status: 'fail', message: err.message };
    }
  });
}

// ── Helper ─────────────────────────────────────────────

function loadYaml(filePath: string): { doc: any; raw: string } | { error: string } {
  const resolved = path.resolve(filePath || 'skill.yaml');
  if (!fs.existsSync(resolved)) return { error: `File not found: ${resolved}` };
  const raw = fs.readFileSync(resolved, 'utf-8');
  try {
    const doc = yaml.load(raw);
    if (!doc || typeof doc !== 'object') return { error: 'skill.yaml is empty or not an object' };
    return { doc, raw };
  } catch (e: any) {
    return { error: `YAML parse error: ${e.message}` };
  }
}

function textResult(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], isError };
}

// ── MCP Server ─────────────────────────────────────────

export function main() {
  const server = new McpServer({ name: 'stop-mcp', version: '0.1.0' });

  // stop_validate
  server.tool('stop_validate', 'Validate a skill.yaml manifest against the STOP spec', {
    path: z.string().optional().describe('Path to skill.yaml (default: ./skill.yaml)'),
  }, async ({ path: fp }) => {
    const result = loadYaml(fp ?? 'skill.yaml');
    if ('error' in result) return textResult(`❌ ${result.error}`, true);
    const diags = validateManifest(result.doc, result.raw);
    const errors = diags.filter(d => d.level === 'error');
    const warns = diags.filter(d => d.level === 'warn');
    if (!errors.length && !warns.length) return textResult(`✅ ${fp || 'skill.yaml'} is valid`);
    const lines = [...errors.map(d => `❌ ${d.message}`), ...warns.map(d => `⚠️ ${d.message}`), '', `${errors.length} error(s), ${warns.length} warning(s)`];
    return textResult(lines.join('\n'), errors.length > 0);
  });

  // stop_check
  server.tool('stop_check', 'Run pre/post assertions from a skill.yaml manifest', {
    path: z.string().optional().describe('Path to skill.yaml'),
    phase: z.enum(['pre', 'post']).optional().describe('Phase: pre or post (default: pre)'),
    inputs: z.string().optional().describe('JSON string of input values'),
    outputs: z.string().optional().describe('JSON string of output values'),
  }, async ({ path: fp, phase, inputs, outputs }) => {
    const result = loadYaml(fp ?? 'skill.yaml');
    if ('error' in result) return textResult(`❌ ${result.error}`, true);
    const p = phase ?? 'pre';
    const rules = result.doc?.assertions?.[p];
    if (!rules?.length) return textResult(`No ${p} assertions defined`);
    const ctx: AssertCtx = { env: process.env };
    if (inputs) try { ctx.inputs = JSON.parse(inputs); } catch {}
    if (outputs) try { ctx.outputs = JSON.parse(outputs); } catch {}
    const results = runAssertions(rules, ctx, p);
    const passed = results.filter((r: any) => r.status === 'pass').length;
    const failed = results.filter((r: any) => r.status === 'fail').length;
    const lines = results.map((r: any) => {
      const icon = r.status === 'pass' ? '✅' : r.severity === 'error' ? '❌' : '⚠️';
      return `${icon} ${r.check}: ${r.status}${r.message ? ` — ${r.message}` : ''}`;
    });
    lines.push('', `${passed} passed, ${failed} failed`);
    return textResult(lines.join('\n'), failed > 0);
  });

  // stop_manifest
  server.tool('stop_manifest', 'Read and display a skill.yaml manifest summary', {
    path: z.string().optional().describe('Path to skill.yaml'),
  }, async ({ path: fp }) => {
    const result = loadYaml(fp ?? 'skill.yaml');
    if ('error' in result) return textResult(`❌ ${result.error}`, true);
    const doc = result.doc;
    const lines = [`📋 ${doc.name}@${doc.version}`, doc.description, '', `Level: ${doc.observability?.level ?? 'L0'}`];
    if (doc.inputs?.length) {
      lines.push('', 'Inputs:');
      for (const inp of doc.inputs) lines.push(`  ${inp.required ? '●' : '○'} ${inp.name}: ${inp.type}${inp.description ? ` — ${inp.description}` : ''}`);
    }
    if (doc.outputs?.length) {
      lines.push('', 'Outputs:');
      for (const out of doc.outputs) lines.push(`  ${out.guaranteed ? '●' : '○'} ${out.name}: ${out.type}${out.description ? ` — ${out.description}` : ''}`);
    }
    if (doc.tools_used?.length) lines.push('', `Tools: ${doc.tools_used.join(', ')}`);
    if (doc.side_effects?.length) {
      lines.push('', 'Side Effects:');
      for (const se of doc.side_effects) lines.push(`  ⚡ ${se.type}${se.description ? `: ${se.description}` : ''}`);
    }
    return textResult(lines.join('\n'));
  });

  // stop_trace_list
  server.tool('stop_trace_list', 'List recent execution traces from .sop/traces/', {
    dir: z.string().optional().describe('Traces directory (default: .sop/traces/)'),
    limit: z.number().optional().describe('Max traces to show (default: 10)'),
  }, async ({ dir, limit }) => {
    const traceDir = dir || path.join(process.cwd(), '.sop', 'traces');
    if (!fs.existsSync(traceDir)) return textResult(`No traces found (${traceDir} does not exist)`);
    const files = fs.readdirSync(traceDir).filter(f => f.endsWith('.jsonl')).sort().reverse().slice(0, limit || 10);
    if (!files.length) return textResult('No trace files found');
    const lines = files.map(f => {
      const stat = fs.statSync(path.join(traceDir, f));
      return `📄 ${f} (${(stat.size / 1024).toFixed(1)}KB)`;
    });
    return textResult(lines.join('\n'));
  });

  // stop_trace_view
  server.tool('stop_trace_view', 'View a specific execution trace', {
    file: z.string().describe('Trace file path or filename in .sop/traces/'),
  }, async ({ file }) => {
    let fp = file;
    if (!path.isAbsolute(fp) && !fs.existsSync(fp)) fp = path.join(process.cwd(), '.sop', 'traces', fp);
    if (!fs.existsSync(fp)) return textResult(`❌ Trace not found: ${fp}`, true);
    const spans = fs.readFileSync(fp, 'utf-8').trim().split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const lines = [`Trace: ${path.basename(fp)} (${spans.length} spans)`, ''];
    for (const s of spans) {
      const indent = s.parent_span_id ? '  ' : '';
      const icon = s.status === 'ok' ? '✅' : s.status === 'error' ? '❌' : '⏭️';
      const dur = s.duration_ms != null ? ` (${s.duration_ms}ms)` : '';
      lines.push(`${indent}${icon} [${s.kind}] ${s.name}${dur}`);
    }
    return textResult(lines.join('\n'));
  });

  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error('Failed to start STOP MCP server:', err);
    process.exit(1);
  });
}

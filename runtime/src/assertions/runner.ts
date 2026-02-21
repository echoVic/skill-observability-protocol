import * as fs from 'node:fs';
import type { AssertionRule, AssertionResult, CheckContext } from '../types.js';

/**
 * Run a list of assertion rules against a context.
 * Returns results for each rule.
 */
export function runAssertions(
  rules: AssertionRule[],
  ctx: CheckContext,
  phase: 'pre' | 'post'
): AssertionResult[] {
  return rules.map((rule) => runOne(rule, ctx, phase));
}

function runOne(rule: AssertionRule, ctx: CheckContext, phase: 'pre' | 'post'): AssertionResult {
  const severity = rule.severity ?? (phase === 'pre' ? 'error' : 'warn');
  const base = { check: rule.check, severity, message: rule.message };

  try {
    // env_var check
    if (rule.check === 'env_var') {
      const val = (ctx.env ?? process.env)[rule.name!];
      if (!val) {
        return { ...base, status: 'fail', message: rule.message ?? `env var ${rule.name} not set` };
      }
      return { ...base, status: 'pass', value: '***' };
    }

    // file_exists check
    if (rule.check === 'file_exists') {
      const p = interpolate(rule.path!, ctx);
      if (!fs.existsSync(p)) {
        return { ...base, status: 'fail', message: rule.message ?? `file not found: ${p}` };
      }
      return { ...base, status: 'pass', value: p };
    }

    // file_not_empty check
    if (rule.check === 'file_not_empty') {
      const p = interpolate(rule.path!, ctx);
      if (!fs.existsSync(p)) {
        return { ...base, status: 'fail', message: rule.message ?? `file not found: ${p}` };
      }
      const stat = fs.statSync(p);
      if (stat.size === 0) {
        return { ...base, status: 'fail', message: rule.message ?? `file is empty: ${p}` };
      }
      return { ...base, status: 'pass', value: stat.size };
    }

    // file_matches check
    if (rule.check === 'file_matches') {
      const p = interpolate(rule.path!, ctx);
      if (!fs.existsSync(p)) {
        return { ...base, status: 'fail', message: rule.message ?? `file not found: ${p}` };
      }
      const content = fs.readFileSync(p, 'utf-8');
      const re = new RegExp(rule.pattern!);
      if (!re.test(content)) {
        return { ...base, status: 'fail', message: rule.message ?? `file content does not match pattern` };
      }
      return { ...base, status: 'pass' };
    }

    // tool_available check
    if (rule.check === 'tool_available') {
      if (!ctx.tools || !ctx.tools.includes(rule.tool!)) {
        return { ...base, status: 'fail', message: rule.message ?? `tool not available: ${rule.tool}` };
      }
      return { ...base, status: 'pass', value: rule.tool };
    }

    // duration check
    if (rule.check === 'duration') {
      if (ctx.duration_ms != null && ctx.duration_ms > rule.max_ms!) {
        return { ...base, status: 'fail', message: rule.message ?? `duration ${ctx.duration_ms}ms exceeds ${rule.max_ms}ms` };
      }
      return { ...base, status: 'pass', value: ctx.duration_ms };
    }

    // output.* checks
    if (rule.check.startsWith('output.')) {
      const field = rule.check.slice('output.'.length);
      const val = ctx.outputs?.[field];

      if (rule.not_empty && (!val || (typeof val === 'string' && val.length === 0))) {
        return { ...base, status: 'fail', message: rule.message ?? `output.${field} is empty` };
      }
      if (rule.matches) {
        const re = new RegExp(rule.matches);
        if (!re.test(String(val ?? ''))) {
          return { ...base, status: 'fail', message: rule.message ?? `output.${field} does not match pattern` };
        }
      }
      if (rule.equals !== undefined && val !== rule.equals) {
        return { ...base, status: 'fail', message: rule.message ?? `output.${field} expected ${rule.equals}, got ${val}` };
      }
      if (rule.greater_than !== undefined && (typeof val !== 'number' || val <= rule.greater_than)) {
        return { ...base, status: 'fail', message: rule.message ?? `output.${field} must be > ${rule.greater_than}` };
      }

      return { ...base, status: 'pass', value: val };
    }

    return { ...base, status: 'fail', message: `Unknown check type: ${rule.check}` };
  } catch (err: any) {
    return { ...base, status: 'fail', message: err.message };
  }
}

/** Replace ${inputs.x} with actual values */
function interpolate(template: string, ctx: CheckContext): string {
  return template.replace(/\$\{inputs\.(\w+)\}/g, (_, key) => {
    return String(ctx.inputs?.[key] ?? '');
  });
}

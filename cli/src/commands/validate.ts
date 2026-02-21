import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';

interface Diagnostic {
  level: 'error' | 'warn';
  message: string;
}

const VALID_TYPES = new Set([
  'string', 'number', 'boolean', 'file_path', 'dir_path', 'url', 'json', 'array', 'enum',
]);

const VALID_SIDE_EFFECT_TYPES = new Set([
  'filesystem', 'network', 'message', 'exec', 'state',
]);

const VALID_LEVELS = new Set(['L0', 'L1', 'L2', 'L3']);

export function validate(filePath?: string) {
  const target = filePath || 'skill.yaml';
  const resolved = path.resolve(target);

  if (!fs.existsSync(resolved)) {
    console.error(`❌ File not found: ${resolved}`);
    process.exit(1);
  }

  let doc: any;
  try {
    doc = yaml.load(fs.readFileSync(resolved, 'utf-8'));
  } catch (e: any) {
    console.error(`❌ YAML parse error: ${e.message}`);
    process.exit(1);
  }

  if (!doc || typeof doc !== 'object') {
    console.error('❌ skill.yaml is empty or not an object');
    process.exit(1);
  }

  const diags: Diagnostic[] = [];

  // Required fields
  for (const field of ['sop', 'name', 'version', 'description']) {
    if (!doc[field]) {
      diags.push({ level: 'error', message: `Missing required field: ${field}` });
    }
  }

  // Name format
  if (doc.name && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(doc.name)) {
    diags.push({ level: 'warn', message: `name should be kebab-case: "${doc.name}"` });
  }

  // Collect declared input names for interpolation check
  const inputNames = new Set<string>();

  // Inputs
  if (doc.inputs && Array.isArray(doc.inputs)) {
    for (const inp of doc.inputs) {
      if (!inp.name) diags.push({ level: 'error', message: 'Input missing "name"' });
      if (inp.name) inputNames.add(inp.name);
      if (inp.type && !VALID_TYPES.has(inp.type)) {
        diags.push({ level: 'error', message: `Input "${inp.name}": unknown type "${inp.type}"` });
      }
    }
  }

  // Outputs
  if (doc.outputs && Array.isArray(doc.outputs)) {
    for (const out of doc.outputs) {
      if (!out.name) diags.push({ level: 'error', message: 'Output missing "name"' });
      if (out.type && !VALID_TYPES.has(out.type)) {
        diags.push({ level: 'error', message: `Output "${out.name}": unknown type "${out.type}"` });
      }
    }
  }

  // Side effects
  if (doc.side_effects && Array.isArray(doc.side_effects)) {
    for (const se of doc.side_effects) {
      if (se.type && !VALID_SIDE_EFFECT_TYPES.has(se.type)) {
        diags.push({ level: 'error', message: `Side effect: unknown type "${se.type}"` });
      }
    }
  }

  // Observability level
  if (doc.observability?.level && !VALID_LEVELS.has(doc.observability.level)) {
    diags.push({ level: 'error', message: `Unknown observability level: "${doc.observability.level}"` });
  }

  // Interpolation check — ${inputs.x} must reference declared inputs
  const interpolationRegex = /\$\{inputs\.(\w+)\}/g;
  const yamlStr = fs.readFileSync(resolved, 'utf-8');
  let match: RegExpExecArray | null;
  while ((match = interpolationRegex.exec(yamlStr)) !== null) {
    if (!inputNames.has(match[1])) {
      diags.push({ level: 'error', message: `Interpolation \${inputs.${match[1]}} references undeclared input` });
    }
  }

  // Print results
  const errors = diags.filter(d => d.level === 'error');
  const warns = diags.filter(d => d.level === 'warn');

  if (errors.length === 0 && warns.length === 0) {
    console.log(`✅ ${target} is valid`);
    return;
  }

  for (const d of errors) console.error(`❌ ${d.message}`);
  for (const d of warns) console.warn(`⚠️  ${d.message}`);

  console.log(`\n${errors.length} error(s), ${warns.length} warning(s)`);
  if (errors.length > 0) process.exit(1);
}

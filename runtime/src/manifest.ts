import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import type { SkillManifest } from './types.js';

/**
 * Load and parse a skill.yaml manifest file.
 * Throws on missing file or invalid YAML.
 */
export function loadManifest(filePath: string): SkillManifest {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Manifest not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf-8');
  const doc = yaml.load(raw);

  if (!doc || typeof doc !== 'object') {
    throw new Error(`Invalid manifest: ${resolved} is empty or not an object`);
  }

  const manifest = doc as SkillManifest;

  // Minimal required field check
  for (const field of ['sop', 'name', 'version', 'description'] as const) {
    if (!manifest[field]) {
      throw new Error(`Manifest missing required field: ${field}`);
    }
  }

  return manifest;
}

/**
 * Load manifest from a YAML string (useful for testing or inline manifests).
 */
export function parseManifest(yamlStr: string): SkillManifest {
  const doc = yaml.load(yamlStr);

  if (!doc || typeof doc !== 'object') {
    throw new Error('Invalid manifest: empty or not an object');
  }

  return doc as SkillManifest;
}

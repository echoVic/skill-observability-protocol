import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

function ask(rl: readline.Interface, question: string, fallback?: string): Promise<string> {
  const suffix = fallback ? ` (${fallback})` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || fallback || '');
    });
  });
}

export async function init() {
  const dest = path.resolve('skill.yaml');
  if (fs.existsSync(dest)) {
    console.error('skill.yaml already exists. Remove it first or run in another directory.');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n🛑 stop init — Generate skill.yaml\n');

  const name = await ask(rl, 'Skill name (kebab-case)', path.basename(process.cwd()));
  const version = await ask(rl, 'Version', '1.0.0');
  const description = await ask(rl, 'Description');
  const author = await ask(rl, 'Author');
  const level = await ask(rl, 'Observability level (L0/L1/L2/L3)', 'L0');

  const toolsRaw = await ask(rl, 'Tools used (comma-separated, e.g. exec,read,web_fetch)');
  const tools = toolsRaw ? toolsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  rl.close();

  let yaml = `sop: "0.1"\nname: ${name}\nversion: ${version}\ndescription: ${description}\n`;

  if (author) yaml += `author: ${author}\n`;

  yaml += `\ninputs: []\n  # - name: example\n  #   type: string\n  #   required: true\n  #   description: Example input\n`;

  yaml += `\noutputs: []\n  # - name: result\n  #   type: string\n  #   description: Example output\n`;

  if (tools.length > 0) {
    yaml += `\ntools_used:\n`;
    for (const t of tools) yaml += `  - ${t}\n`;
  }

  yaml += `\nside_effects: []\n  # - type: network\n  #   description: POST to API\n  #   destinations: ["api.example.com"]\n`;

  yaml += `\nobservability:\n  level: ${level}\n`;

  fs.writeFileSync(dest, yaml, 'utf-8');
  console.log(`\n✅ Created ${dest}\n`);
}

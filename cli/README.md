# stop-cli

CLI for [STOP — Skill Transparency & Observability Protocol](https://github.com/echoVic/stop-protocol).

## Install

```bash
npm install -g stop-cli
```

Or use directly with npx:

```bash
npx stop-cli init
```

## Commands

### `stop init`

Interactively generate a `skill.yaml` manifest for your skill.

```bash
cd my-skill/
stop init
```

### `stop validate [path]`

Validate a `skill.yaml` file against the STOP spec.

```bash
stop validate              # validates ./skill.yaml
stop validate path/to/skill.yaml
```

Checks:
- Required fields (`sop`, `name`, `version`, `description`)
- Name format (kebab-case)
- Input/output types
- Side effect types
- Observability levels
- `${inputs.x}` interpolation references

## License

MIT

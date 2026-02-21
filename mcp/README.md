# stop-mcp

MCP Server for [STOP — Skill Transparency & Observability Protocol](https://github.com/echoVic/stop-protocol).

Bring STOP observability to any MCP-compatible Agent (Claude Code, opencode, Cursor, blade-code, etc.)

## Install

```bash
npm install -g stop-mcp
```

## Usage

Add to your MCP config (e.g. `claude_desktop_config.json`, `.mcp.json`, etc.):

```json
{
  "mcpServers": {
    "stop": {
      "command": "stop-mcp"
    }
  }
}
```

Or with npx (no install):

```json
{
  "mcpServers": {
    "stop": {
      "command": "npx",
      "args": ["stop-mcp"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `stop_validate` | Validate a skill.yaml manifest against the STOP spec |
| `stop_check` | Run pre/post assertions from a skill.yaml |
| `stop_manifest` | Read and display a skill.yaml summary |
| `stop_trace_list` | List recent execution traces |
| `stop_trace_view` | View a specific execution trace |

## Examples

Agent can use these tools naturally:

- "Validate the skill.yaml in this directory"
- "Run the pre-checks for this skill"
- "Show me the recent traces"
- "What does this skill do?" (reads manifest)

## License

MIT

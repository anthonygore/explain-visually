# Install Explain Visually

Explain Visually is distributed as two compatible pieces:

- a local web app that owns rendering, theming, preview, and video export
- an MCP server that exposes scene operations to an AI harness

The skill contains the scene-authoring rules. The MCP server is the integration boundary, so the same app can be used from Codex, Claude Desktop, Claude Code, or another MCP client.

## Local setup

Requirements: Node.js 18 or newer, a Chromium installation usable by Playwright, and `ffmpeg` for video rendering. Voicebox is required only for narrated video export.

```sh
cd app
npm install
npm start
```

The preview is at `http://127.0.0.1:5173/` and the API is at `http://127.0.0.1:8787`.

## Codex

The `plugin/` directory is the Codex plugin. Install that directory as a local plugin or add it to a local marketplace. Its manifest and `.mcp.json` start the MCP adapter and point it at the local API.

After the plugin is installed, use prompts such as `Explain this topic visually` or `Preview the current explanation`.

## Claude Desktop

Add the MCP server to Claude Desktop's MCP configuration. Use an absolute path to this repository:

```json
{
  "mcpServers": {
    "explain-visually": {
      "command": "node",
      "args": ["/absolute/path/to/Explain Visually/plugin/mcp/explain-visually.mjs"],
      "env": {
        "EXPLAIN_VISUALLY_API_URL": "http://127.0.0.1:8787",
        "EXPLAIN_VISUALLY_FRONTEND_URL": "http://127.0.0.1:5173/"
      }
    }
  }
}
```

Restart Claude Desktop after changing its configuration. Give Claude the scene-authoring instructions from `plugin/skills/explainvisually/SKILL.md` as a project instruction or custom skill.

## Claude Code and other MCP clients

Register the same command using the client's MCP configuration mechanism. The only required values are:

```text
command: node
args: /absolute/path/to/Explain Visually/plugin/mcp/explain-visually.mjs
```

Set `EXPLAIN_VISUALLY_API_URL` when the app API is running somewhere other than the default localhost port. The frontend remains a separate browser URL because it owns the user-selected theme and visual presentation.

## Publishing

For a team, publish this repository and document `cd app && npm install && npm start`. For Codex distribution, publish or add only the `plugin/` directory as a plugin source. For Claude and other clients, distribute the repository plus the MCP configuration snippet above. Keep the app and MCP server versioned together because the MCP adapter targets the app's HTTP API.

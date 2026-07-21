# MCP setup

VS Code reads `.vscode/mcp.json`. Start the Figma server, authenticate in its browser flow, then verify the connection with an identity call; pass an exact Figma frame URL, not only a screenshot. Start shadcn through the configured `npx shadcn@latest mcp` command and verify it can search a registry.

If Codex does not load workspace MCP configuration:

```bash
codex mcp add figma --url https://mcp.figma.com/mcp
```

```toml
[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]
```

Never commit tokens. Re-authenticate Figma for authorization failures; check proxy certificates for shadcn registry failures; confirm the supplied URL identifies a frame/node.

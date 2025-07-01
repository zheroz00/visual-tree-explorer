# Integrating Visual Tree Explorer with Claude

## Quick Setup

1. **Build the server** (if not already done):
   ```bash
   cd mcp-servers/visual-tree-explorer
   npm install
   npm run build
   ```

2. **Add to Claude's MCP configuration**:
   
   Edit your Claude Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

3. **Add this configuration**:
   ```json
   {
     "mcpServers": {
       "visual-tree-explorer": {
         "command": "node",
         "args": ["/absolute/path/to/yourProject/mcp-servers/visual-tree-explorer/dist/index.js"]
       }
     }
   }
   ```

   Replace `/absolute/path/to/yourProject` with your actual project path.

4. **Restart Claude Desktop** to load the new MCP server.

## Verification

Once integrated, you can test by asking Claude:
- "Use explore_tree to show me the src/components directory"
- "Show me the pipeline components with symbols"
- "Explore the entire src directory with 3 levels deep"

## Example Usage in Conversations

```
You: Show me what's in the components/pipeline folder with code previews

Claude: I'll use the visual tree explorer to show you the pipeline components:

explore_tree({
  path: "src/components/pipeline",
  depth: 2,
  preview_lines: 5,
  show_symbols: true
})

[Visual tree output with previews and symbols]
```

## Troubleshooting

1. **Server not found**: Ensure the path in config is absolute
2. **Permission denied**: Make sure the built files are executable
3. **Tool not available**: Restart Claude after config changes

## Development Mode

For development, you can run the TypeScript directly:
```json
{
  "mcpServers": {
    "visual-tree-explorer": {
      "command": "npx",
      "args": ["tsx", "/path/to/yourProject/mcp-servers/visual-tree-explorer/src/index.ts"]
    }
  }
}
```
# Visual Tree Explorer HTTP Server

The Visual Tree Explorer now supports both MCP mode (for Claude Code) and HTTP server mode (for automation and hooks).

## 🚀 Quick Start

### Start the HTTP Server
```bash
cd mcp-servers/visual-tree-explorer
./start-server.sh
```

Or manually:
```bash
npm run server
# or
node dist/cli-server.js --server --port 8080
```

### Test the Server
```bash
# Check health
curl http://localhost:8080/health

# Explore a directory (tree format)
curl "http://localhost:8080/explore?path=src&depth=2&show_symbols=true"

# Get JSON output
curl "http://localhost:8080/explore?path=src&format=json"
```

## 📡 API Reference

### GET /explore

Explore a directory tree with all Visual Tree Explorer features.

**Query Parameters:**
- `path` (required) - Directory path to explore
- `depth` - Traverse depth (default: 2)
- `preview_lines` - Lines to preview per file (default: 5)
- `show_symbols` - Extract code symbols (default: true)
- `show_imports` - Show import statements (default: false)
- `show_git_status` - Show git status indicators (default: false)
- `show_dependency_graph` - Show dependency analysis (default: false)
- `show_performance` - Show performance metrics (default: false)
- `icon_theme` - Icon theme: emoji|minimal|nerd-fonts|ascii|corporate (default: emoji)
- `filter` - Glob pattern to filter files
- `search` - Search term (supports prefixes: function:, content:, import:, regex:)
- `format` - Output format: tree|json (default: tree)
- `max_files` - Max files per directory (default: 100)
- `skip_patterns` - Comma-separated patterns to skip

**Example Requests:**
```bash
# Basic exploration
curl "http://localhost:8080/explore?path=src"

# Full analysis with JSON output
curl "http://localhost:8080/explore?path=src&depth=3&show_symbols=true&show_dependency_graph=true&format=json"

# Search for functions
curl "http://localhost:8080/explore?path=src&search=function:handleSubmit"

# Minimal theme with performance metrics
curl "http://localhost:8080/explore?path=src&icon_theme=minimal&show_performance=true"
```

## 🔧 Integration with Auto-Documentation

The auto-doc.py script automatically uses the HTTP server when available:

1. **With server running**: Uses fast HTTP API
2. **Without server**: Falls back to CLI mode
3. **Custom server**: Set `VTE_HOST` and `VTE_PORT` environment variables

```bash
# Use custom server location
VTE_HOST=192.168.1.100 VTE_PORT=9090 python auto-doc.py
```

## 🐳 Running as a Service

### Using systemd (Linux)
Create `/etc/systemd/system/vte-server.service`:
```ini
[Unit]
Description=Visual Tree Explorer HTTP Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/r3belMind/mcp-servers/visual-tree-explorer
ExecStart=/usr/bin/node dist/cli-server.js --server --port 8080
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable vte-server
sudo systemctl start vte-server
```

### Using PM2
```bash
npm install -g pm2
pm2 start dist/cli-server.js --name vte-server -- --server --port 8080
pm2 save
pm2 startup
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 8080
CMD ["node", "dist/cli-server.js", "--server", "--port", "8080"]
```

## 🛡️ Security Considerations

The HTTP server is designed for **local development only**:
- Binds to localhost by default
- No authentication
- Full filesystem access

For production use, consider:
- Adding authentication middleware
- Restricting path access
- Using HTTPS
- Rate limiting

## 🎯 Use Cases

1. **Auto-documentation hooks** - Generate docs on file changes
2. **CI/CD pipelines** - Analyze code structure in builds
3. **IDE integrations** - Custom extensions can use the HTTP API
4. **Monitoring dashboards** - Track codebase metrics over time
5. **Team tools** - Shared code exploration service

## 🔍 Troubleshooting

### Port already in use
```bash
# Check what's using the port
lsof -i :8080

# Use a different port
VTE_PORT=8081 ./start-server.sh
```

### Server not responding
1. Check if server is running: `curl http://localhost:8080/health`
2. Check logs for errors
3. Ensure Visual Tree Explorer is built: `npm run build`

### Performance issues
- Reduce `depth` parameter for large codebases
- Use `filter` to limit file types
- Set `show_symbols=false` for faster scans
- Increase timeout for very large directories

## 🚀 CLI Mode

The same script also supports direct CLI usage:

```bash
# One-shot CLI execution
node dist/cli-server.js --path src --depth 2 --show-symbols

# With all options
node dist/cli-server.js \
  --path src \
  --depth 3 \
  --preview-lines 10 \
  --show-symbols \
  --show-dependency-graph \
  --icon-theme minimal \
  --format json
```

This dual-mode design gives you maximum flexibility!
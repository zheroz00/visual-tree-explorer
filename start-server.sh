#!/bin/bash

# Visual Tree Explorer HTTP Server Startup Script

echo "🚀 Starting Visual Tree Explorer HTTP Server..."
echo ""

# Default port
PORT=${VTE_PORT:-8080}

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port $PORT is already in use!"
    echo "Please stop the existing service or set VTE_PORT to a different port:"
    echo "  VTE_PORT=8081 ./start-server.sh"
    exit 1
fi

# Navigate to the correct directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if built
if [ ! -f "dist/cli-server.js" ]; then
    echo "📦 Building Visual Tree Explorer first..."
    npm run build
fi

echo "🌐 Starting server on port $PORT..."
echo ""
echo "📡 Available endpoints:"
echo "  - GET http://localhost:$PORT/health"
echo "  - GET http://localhost:$PORT/explore?path=<path>"
echo ""
echo "📝 Example usage:"
echo "  curl \"http://localhost:$PORT/explore?path=src&depth=2&show_symbols=true\""
echo "  curl \"http://localhost:$PORT/explore?path=src&format=json\""
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
node dist/cli-server.js --server --port $PORT
#!/bin/sh
# stdio MCP server for character cards; run from anywhere.
set -e
cd "$(dirname "$0")/.."
exec ./node_modules/.bin/tsx src/mcp/card-server.ts

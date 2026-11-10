#!/bin/bash
# JARVIS startup script

set -e

# Configuration
PORT="${JARVIS_PORT:-7915}"
ROOT="${JARVIS_ROOT:-$HOME/Documents}"
LLM_PROVIDER="${JARVIS_LLM_PROVIDER:-claude}"
NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.1:8b}"

echo "Starting JARVIS..."
echo "  Port: $PORT"
echo "  Root: $ROOT"
echo "  LLM Provider: $LLM_PROVIDER"
if [ "$LLM_PROVIDER" = "nvidia" ]; then
    if [ -n "$NVIDIA_API_KEY" ]; then
        echo "  NVIDIA API Key: ${NVIDIA_API_KEY:0:10}... (set)"
    else
        echo "  NVIDIA API Key: NOT SET (will fail)"
    fi
elif [ "$LLM_PROVIDER" = "ollama" ]; then
    echo "  Ollama Host: $OLLAMA_HOST"
    echo "  Ollama Model: $OLLAMA_MODEL"
fi
echo ""

# Check if port is already in use
if lsof -ti:$PORT >/dev/null 2>&1; then
  echo "ERROR: Port $PORT is already in use."
  echo "  Set JARVIS_PORT to use a different port, or stop the existing process."
  exit 1
fi

# Check for Claude CLI
if ! command -v claude >/dev/null 2>&1; then
  echo "WARNING: 'claude' command not found in PATH."
  echo "  Install Claude Code CLI: https://github.com/anthropics/claude-code"
  echo ""
fi

# Check if logged in
if command -v claude >/dev/null 2>&1; then
  if ! claude --version >/dev/null 2>&1; then
    echo "WARNING: Claude CLI not logged in."
    echo "  Run 'claude auth login' to authenticate."
    echo ""
  fi
fi

# Export for the Python server
export JARVIS_PORT="$PORT"
export JARVIS_ROOT="$ROOT"
export JARVIS_LLM_PROVIDER="$LLM_PROVIDER"
export NVIDIA_API_KEY="$NVIDIA_API_KEY"
export OLLAMA_HOST="$OLLAMA_HOST"
export OLLAMA_MODEL="$OLLAMA_MODEL"

# Start the server
exec python3 server.py
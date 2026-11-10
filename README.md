# JARVIS

A local AI assistant with a glowing orb UI and 3D file graph. Runs entirely on your machine — no API keys required for Claude (uses subscription), optional NVIDIA API or local Ollama.

## Features

- **The Orb**: A living, breathing Three.js sphere with custom GLSL noise displacement. Ripples when speaking, breathes when idle. Glowing core, wireframe cage, ambient particles.
- **The Brain**: Python stdlib HTTP server on port 7915. Supports multiple LLM providers:
  - **Claude Code CLI** (default) — uses your subscription, no API key needed
  - **NVIDIA API** — Nemotron and Llama models via `NVIDIA_API_KEY`
  - **Ollama** — Local models via `http://localhost:11434`
- British voice via macOS `say` (auto-detects available voices)
- **The Graph**: 3D force-directed graph of your files (~/Documents by default). Top-level folders colored distinctly. Capped at ~700 nodes for smooth physics.
- **Search Integration**: Give the LLM the `find_files` tool. When you say "pull up my invoices", the graph filters to exactly what the tool returned — matching nodes plus their parent folders, nothing disconnected.
- **Offline-First**: All dependencies vendored locally. No CDN, no build step, no package manager for the web side.

## Requirements

- macOS (for `say` command and WKWebView compatibility) — Windows/Linux works with simulated speech
- Python 3.8+
- **For Claude (default)**: Claude Code CLI (`claude`) installed and logged in (`claude auth login`)
- **For NVIDIA**: `NVIDIA_API_KEY` environment variable
- **For Ollama**: Ollama running locally (`ollama serve`)

## Quick Start

```bash
# Clone or download this folder
cd jarvis-ai

# For Claude (default) - make sure Claude CLI is installed and logged in
claude auth login

# Run
./run.sh
```

Then open http://localhost:7915 in your browser.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `JARVIS_PORT` | `7915` | HTTP server port |
| `JARVIS_ROOT` | `~/Documents` | Root directory for file graph |
| `JARVIS_LLM_PROVIDER` | `claude` | LLM provider: `claude`, `nvidia`, or `ollama` |
| `NVIDIA_API_KEY` | (empty) | NVIDIA API key for Nemotron/Llama models |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.1:8b` | Ollama model to use |

### Using NVIDIA API

```bash
# Get your API key from https://build.nvidia.com/
export NVIDIA_API_KEY="nvapi-your-key-here"
export JARVIS_LLM_PROVIDER="nvidia"
./run.sh
```

Primary NVIDIA cloud model:
- `nvidia/nemotron-3-ultra-550b-a55b` (Nemotron 3 Ultra 550B-A55B Reasoning Engine)

### Using Ollama (Local Models)

```bash
# Install and start Ollama
ollama pull llama3.1:8b
ollama serve &

# Run JARVIS with Ollama
export JARVIS_LLM_PROVIDER="ollama"
export OLLAMA_MODEL="llama3.1:8b"  # or any model you have
./run.sh
```

### Using Custom Port/Root

```bash
JARVIS_PORT=8080 JARVIS_ROOT=~/Projects ./run.sh
```

## Architecture

```
jarvis-ai/
├── server.py          # Python HTTP server (stdlib only)
├── index.html         # Single-page app (Three.js + 3d-force-graph)
├── vendor/
│   ├── three.module.js           # Three.js ES module
│   └── 3d-force-graph.min.js     # Bundled UMD (includes three-forcegraph, d3-force-3d, etc.)
├── run.sh             # Startup script (macOS/Linux)
├── run.bat            # Startup script (Windows)
└── README.md
```

### Server Endpoints

- `GET /` — Serves `index.html`
- `GET /api/state` — `{ speaking, claude_available, nvidia_available, ollama_available, llm_provider, voice, root, uptime }` (polled at 250ms)
- `GET /api/graph` — Full graph data `{ nodes, links }` with optional search filter
- `GET /api/search` — Last search results
- `POST /api/chat` — `{ message }` → `{ response }` (triggers speech)
- `POST /api/interrupt` — Stops current speech

### The Orb Shader

The surface sphere uses an `IcosahedronGeometry` (subdivisions=6, ~13k vertices) with a custom vertex shader implementing Simplex 3D noise. Displacement is driven by:

- `uTime` — continuous noise animation
- `uDisplacement` — amplitude (bounded at 18% of radius)
- `uSpeaking` — radial pulse on rising edge, decays on elapsed time (not per-frame)

Camera distance is computed from cage radius and FOV on every resize — no cropping in narrow panes.

### The Graph

- Walks `JARVIS_ROOT` recursively
- Includes folders + "interesting" files (code, docs, media, config, etc.)
- Each top-level folder gets a distinct color
- Capped at 700 nodes
- Search filters to matches + ancestors (no floating orphans)
- Camera fits when force layout **settles** (`onEngineStop`), not on data arrival

### Speech

- One sentence at a time via `say -v <British voice>`
- Subprocess handle kept so you can interrupt mid-word (`/api/interrupt`)
- Server exposes `speaking` boolean; page polls at 250ms
- Ripple envelope: kicks on rising edge, holds 1s after last sentence, then decays over ~2s

## Troubleshooting

**Port already in use:**
```
ERROR: Port 7915 is already in use.
  Set JARVIS_PORT to use a different port, or stop the existing process.
```
```bash
JARVIS_PORT=8080 ./run.sh
```

**Claude not logged in:**
```
WARNING: Claude CLI not logged in.
  Run 'claude auth login' to authenticate.
```
Run `claude auth login` in your terminal.

**NVIDIA API 401/404:**
- Check your `NVIDIA_API_KEY` is valid
- The model may have been deprecated — check https://build.nvidia.com/ for current models
- Update the model name in `server.py` if needed

**Ollama not available:**
- Make sure `ollama serve` is running
- Check `OLLAMA_HOST` matches your Ollama server
- Pull the model first: `ollama pull llama3.1:8b`

**No British voice found:**
The server auto-detects from `say -v '?'`. Falls back to "Daniel". You can check available voices with `say -v '?'`.

**Graph empty:**
Check `JARVIS_ROOT` exists and has readable files. Default is `~/Documents`.

## License

MIT — Build your own JARVIS.
#!/usr/bin/env python3
"""
JARVIS - A local AI assistant with a glowing orb UI and 3D file graph.
Python standard library only. Port 7915 (configurable via JARVIS_PORT).
"""

import os
import sys
import json
import subprocess
import threading
import time
import signal
import mimetypes
import urllib.parse
import platform
import urllib.request
import urllib.error
import re
import shlex
import socket
import wave
import io
import struct
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Optional, List, Dict, Any
import fnmatch

from ai_router import (
    ai_router,
    load_router_config,
    save_router_config,
    get_safe_router_config,
    get_ollama_models,
    check_nvidia_health,
    get_system_telemetry,
    score_query_complexity,
)
from orbit_core.supervisor import supervisor
from orbit_core.memory_store import memory_store
from orbit_core.model_manager import model_manager
from orbit_core.computer_use import computer_use

JARVIS_SYSTEM_PROMPT = """You are JARVIS, the autonomous AI command center companion and butler for ORBIT.
You speak with quiet competence, razor-sharp technical clarity, and restrained wit.
Call the user "sir" where appropriate.
Shape your response directly and concisely: everything you say may be spoken aloud.
Never use bloated service language ("I would be delighted to assist").
When you need to interact with the PC, you can invoke tools:
TOOL: find_files({"pattern": "filename or extension"})
TOOL: read_file({"path": "file path"})
TOOL: search_files({"pattern": "query", "path": ".", "file_pattern": "*"})
TOOL: run_command({"cmd": "shell command"})
TOOL: fetch_url({"url": "https://..."})
Keep responses crisp and focused on what matters."""

# audioop replacement for Python 3.13+
def audioop_rms(data: bytes, width: int) -> int:
    """Calculate RMS of audio data (replacement for audioop.rms)."""
    if width == 1:
        fmt = f"{len(data)}b"
        samples = struct.unpack(fmt, data)
        return int((sum(s * s for s in samples) / len(samples)) ** 0.5)
    elif width == 2:
        fmt = f"{len(data) // 2}h"
        samples = struct.unpack(fmt, data)
        return int((sum(s * s for s in samples) / len(samples)) ** 0.5)
    elif width == 4:
        fmt = f"{len(data) // 4}i"
        samples = struct.unpack(fmt, data)
        return int((sum(s * s for s in samples) / len(samples)) ** 0.5)
    return 0

# Shell tool configuration
SHELL_TIMEOUT = 30  # seconds
MAX_OUTPUT_CHARS = 8000

# Commands that are denied (leave processes running or are recursive)
DENIED_COMMANDS = {
    'tmux', 'screen', 'nohup', 'launchctl', 'osascript',
    'claude',  # recursive claude
    'ssh', 'scp', 'rsync',  # remote access
    'sudo', 'su', 'doas',  # privilege escalation
    'crontab', 'at', 'batch',  # scheduled tasks
    'systemctl', 'service', 'launchd',  # service management
}

# Commands that require confirmation (destructive or sending)
CONFIRMATION_REQUIRED = {
    'rm', 'rmdir', 'shred', 'wipe',  # deletion
    'curl', 'wget', 'scp', 'rsync', 'sftp', 'ftp', 'nc', 'netcat',  # sending data out
    'mail', 'sendmail', 'mutt', 'mailx',  # email
    'git push', 'git push origin', 'git push --force',  # pushing code
    'docker push', 'docker image push',  # pushing images
    'npm publish', 'pip publish', 'cargo publish', 'gem push',  # publishing packages
}

def is_command_denied(cmd: str) -> Optional[str]:
    """Check if command is denied. Returns reason if denied, None if allowed."""
    parts = shlex.split(cmd)
    if not parts:
        return "Empty command"
    
    base = parts[0].lower()
    
    # Check exact matches
    if base in DENIED_COMMANDS:
        return f"Denied: '{base}' leaves processes running or spawns recursive agents"
    
    # Check compound commands (git push, docker push, etc.)
    for denied in DENIED_COMMANDS:
        if ' ' in denied and cmd.lower().startswith(denied + ' '):
            return f"Denied: '{denied}' leaves processes running or spawns recursive agents"
    
    return None

def requires_confirmation(cmd: str) -> Optional[str]:
    """Check if command requires confirmation. Returns reason if so, None if not."""
    cmd_lower = cmd.lower().strip()
    
    for denied in CONFIRMATION_REQUIRED:
        if ' ' in denied:
            if cmd_lower.startswith(denied + ' ') or cmd_lower == denied:
                return f"Requires confirmation: '{denied}' deletes or sends data"
        else:
            parts = shlex.split(cmd_lower)
            if parts and parts[0] == denied:
                return f"Requires confirmation: '{denied}' deletes or sends data"
    
    return None

def run_shell_command(cmd: str, cwd: Optional[str] = None) -> Dict[str, Any]:
    """Run a shell command with timeout, no background processes allowed."""
    denied = is_command_denied(cmd)
    if denied:
        return {"ok": False, "error": denied, "stdout": "", "stderr": "", "returncode": -1}
    
    confirm = requires_confirmation(cmd)
    if confirm:
        return {"ok": False, "error": confirm, "stdout": "", "stderr": "", "returncode": -1, "needs_confirmation": True}
    
    if cwd is None:
        cwd = ROOT_DIR
    
    try:
        # On Windows, shell builtins like 'dir' need cmd /c
        # On Unix, they work directly
        if IS_WINDOWS:
            parts = ['cmd.exe', '/c', cmd]
        else:
            parts = shlex.split(cmd)
        
        if not parts:
            return {"ok": False, "error": "Empty command", "stdout": "", "stderr": "", "returncode": -1}
        
        proc = subprocess.run(
            parts,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=SHELL_TIMEOUT,
            env={**os.environ, "TERM": "dumb"}
        )
        
        stdout = proc.stdout[:MAX_OUTPUT_CHARS]
        stderr = proc.stderr[:MAX_OUTPUT_CHARS]
        
        if len(proc.stdout) > MAX_OUTPUT_CHARS:
            stdout += f"\n... [truncated, {len(proc.stdout) - MAX_OUTPUT_CHARS} more chars]"
        if len(proc.stderr) > MAX_OUTPUT_CHARS:
            stderr += f"\n... [truncated, {len(proc.stderr) - MAX_OUTPUT_CHARS} more chars]"
        
        return {
            "ok": True,
            "stdout": stdout,
            "stderr": stderr,
            "returncode": proc.returncode
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"Command timed out after {SHELL_TIMEOUT}s", "stdout": "", "stderr": "", "returncode": -1}
    except Exception as e:
        return {"ok": False, "error": str(e), "stdout": "", "stderr": "", "returncode": -1}

def read_file_tool(path: str) -> Dict[str, Any]:
    """Read a file from the filesystem."""
    try:
        full_path = Path(path)
        if not full_path.is_absolute():
            full_path = Path(ROOT_DIR) / path
        
        try:
            full_path.resolve().relative_to(Path(ROOT_DIR).resolve())
        except ValueError:
            return {"ok": False, "error": "Path outside allowed directory", "content": ""}
        
        if not full_path.exists():
            return {"ok": False, "error": "File not found", "content": ""}
        
        if not full_path.is_file():
            return {"ok": False, "error": "Not a file", "content": ""}
        
        if full_path.stat().st_size > 1024 * 1024:
            return {"ok": False, "error": "File too large (>1MB)", "content": ""}
        
        content = full_path.read_text(encoding='utf-8', errors='replace')
        return {"ok": True, "content": content[:MAX_OUTPUT_CHARS]}
    except Exception as e:
        return {"ok": False, "error": str(e), "content": ""}

def search_files_tool(pattern: str, path: str = ".", file_pattern: str = "*") -> Dict[str, Any]:
    """Search file contents using grep/ripgrep."""
    try:
        search_path = Path(path)
        if not search_path.is_absolute():
            search_path = Path(ROOT_DIR) / path
        
        try:
            search_path.resolve().relative_to(Path(ROOT_DIR).resolve())
        except ValueError:
            return {"ok": False, "error": "Path outside allowed directory", "matches": []}
        
        cmd = None
        for rg in ['rg', 'rg.exe']:
            try:
                subprocess.run([rg, '--version'], capture_output=True, timeout=2)
                cmd = [rg, '-n', '-i', '--no-heading', pattern]
                break
            except Exception:
                continue
        
        if cmd is None:
            cmd = ['grep', '-r', '-n', '-i', pattern, str(search_path)]
        
        if file_pattern != "*":
            if cmd[0] in ['rg', 'rg.exe']:
                cmd.extend(['-g', file_pattern])
            else:
                cmd.extend(['--include', file_pattern])
        
        if cmd[0] in ['grep']:
            cmd.append(str(search_path))
        
        proc = subprocess.run(
            cmd,
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            timeout=SHELL_TIMEOUT
        )
        
        matches = []
        for line in proc.stdout.strip().split('\n'):
            if line:
                matches.append(line)
                if len(matches) >= 100:
                    break
        
        return {"ok": True, "matches": matches, "count": len(matches)}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"Search timed out after {SHELL_TIMEOUT}s", "matches": []}
    except Exception as e:
        return {"ok": False, "error": str(e), "matches": []}

def fetch_url_tool(url: str) -> Dict[str, Any]:
    """Fetch a web page (GET only)."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return {"ok": False, "error": "Only http/https URLs allowed", "content": ""}
        
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; JARVIS/1.0)'}
        )
        
        with urllib.request.urlopen(req, timeout=15) as response:
            content_type = response.headers.get('Content-Type', '')
            content = response.read().decode('utf-8', errors='replace')
            
            if len(content) > MAX_OUTPUT_CHARS:
                content = content[:MAX_OUTPUT_CHARS] + f"\n... [truncated, {len(content) - MAX_OUTPUT_CHARS} more chars]"
            
            return {"ok": True, "content": content, "content_type": content_type}
    except Exception as e:
        return {"ok": False, "error": str(e), "content": ""}

# Configuration
DEFAULT_PORT = 7915
DEFAULT_ROOT = os.path.expanduser("~/Documents")
MAX_NODES = 700
SEARCH_RESULTS_TTL = 30  # seconds

# LLM Provider configuration
LLM_PROVIDER = os.environ.get("JARVIS_LLM_PROVIDER", "claude")  # claude, nvidia, ollama
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")

# Whisper.cpp configuration (Ears)
WHISPER_CLI = os.environ.get("JARVIS_WHISPER_CLI", "/opt/homebrew/bin/whisper-cli")  # or /usr/local/bin/whisper-cli
WHISPER_MODEL = os.environ.get("JARVIS_WHISPER_MODEL", os.path.expanduser("~/whisper.cpp/models/ggml-base.en.bin"))
WHISPER_AVAILABLE = False

# TTS Daemon configuration (Mouth)
TTS_DAEMON_SOCKET = os.environ.get("JARVIS_TTS_SOCKET", "/tmp/jarvis-tts.sock")
TTS_DAEMON_WEIGHTS = os.environ.get("JARVIS_TTS_WEIGHTS", os.path.expanduser("~/tts-daemon/weights.bin"))
TTS_DAEMON_AVAILABLE = False
TTS_VOICE = os.environ.get("JARVIS_TTS_VOICE", "en_GB-male-medium")  # accent-sex-style
TTS_RATE = float(os.environ.get("JARVIS_TTS_RATE", "1.0"))

# Audio recording configuration
AUDIO_SAMPLE_RATE = 16000
AUDIO_CHANNELS = 1
AUDIO_FORMAT = 'paInt16'  # pyaudio format
AUDIO_CHUNK_SIZE = 1024
AUDIO_INPUT_DEVICE = os.environ.get("JARVIS_AUDIO_INPUT_DEVICE", "")  # specific device ID for built-in mic

# Endpointing configuration
ENDPOINT_SILENCE_SHORT = 0.45  # seconds - transcribe so far
ENDPOINT_SILENCE_LONG = 2.0    # seconds - mid-thought continuations
ENDPOINT_SILENCE_FINAL = 1.1   # seconds - sentence sounds finished
ENDPOINT_MIN_UTTERANCE = 0.3   # seconds - anything shorter is a cough
PRE_ROLL_DURATION = 0.35       # seconds - audio before trigger

# Interrupt thresholds
INTERRUPT_THRESHOLD_IDLE = 0.012
INTERRUPT_THRESHOLD_SPEAKING = 0.055

# Continuation words that indicate mid-thought
CONTINUATION_WORDS = {"and", "but", "so", "because", "which", "to", "or", "if", "when", "while", "since", "as", "though", "although", "however", "yet", "still", "also", "then", "therefore", "thus", "hence", "moreover", "furthermore", "additionally", "besides", "meanwhile", "subsequently"}

# State
speaking = False
speaking_lock = threading.Lock()
speech_process: Optional[subprocess.Popen] = None
last_search: Optional[Dict[str, Any]] = None
last_search_time = 0
search_lock = threading.Lock()
graph_data_cache: Optional[Dict[str, Any]] = None
graph_cache_lock = threading.Lock()
server_start_time = time.time()
last_listen_result: Optional[Dict[str, Any]] = None

# Get port from environment
PORT = int(os.environ.get("JARVIS_PORT", DEFAULT_PORT))
ROOT_DIR = os.environ.get("JARVIS_ROOT", DEFAULT_ROOT)

IS_MACOS = platform.system() == "Darwin"
IS_WINDOWS = platform.system() == "Windows"

# British voice detection
BRITISH_VOICES = [
    "Daniel", "Arthur", "George", "Oliver", "Harry", "Jack", "Charlie",
    "Thomas", "James", "William", "Alfie", "Joshua", "Leo", "Oscar",
    "Emily", "Olivia", "Sophie", "Charlotte", "Amelia", "Isla", "Ava",
    "Mia", "Grace", "Lily", "Evelyn", "Freya", "Ivy", "Alice"
]

def find_british_voice() -> str:
    """Find an available British voice from macOS say command."""
    if not IS_MACOS:
        return ""
    try:
        result = subprocess.run(["say", "-v", "?"], capture_output=True, text=True)
        available = result.stdout.lower()
        for voice in BRITISH_VOICES:
            if voice.lower() in available:
                return voice
        for line in result.stdout.splitlines():
            if "en_gb" in line.lower() or "en_uk" in line.lower():
                return line.split()[0]
        return "Daniel"
    except Exception:
        return "Daniel"

BRITISH_VOICE = find_british_voice()

def check_claude_cli() -> bool:
    """Check if claude CLI is available and logged in."""
    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except Exception:
        return False

def check_nvidia_available() -> bool:
    """Check if NVIDIA API key is set."""
    return bool(NVIDIA_API_KEY)

def check_ollama_available() -> bool:
    """Check if Ollama is running."""
    try:
        req = urllib.request.Request(f"{OLLAMA_HOST}/api/tags")
        with urllib.request.urlopen(req, timeout=3) as response:
            return response.status == 200
    except Exception:
        return False

def check_whisper_available() -> bool:
    """Check if whisper-cli binary and model exist."""
    global WHISPER_AVAILABLE
    try:
        # Check binary
        result = subprocess.run([WHISPER_CLI, "--help"], capture_output=True, timeout=3)
        if result.returncode != 0:
            return False
        # Check model file
        if not os.path.exists(WHISPER_MODEL):
            return False
        WHISPER_AVAILABLE = True
        return True
    except Exception:
        return False

def check_tts_daemon_available() -> bool:
    """Check if TTS daemon socket and weights exist."""
    global TTS_DAEMON_AVAILABLE
    try:
        if not os.path.exists(TTS_DAEMON_SOCKET):
            return False
        if not os.path.exists(TTS_DAEMON_WEIGHTS):
            return False
        # Try to connect to socket
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(1)
        sock.connect(TTS_DAEMON_SOCKET)
        sock.close()
        TTS_DAEMON_AVAILABLE = True
        return True
    except Exception:
        return False

CLAUDE_AVAILABLE = check_claude_cli()
NVIDIA_AVAILABLE = check_nvidia_available()
OLLAMA_AVAILABLE = check_ollama_available()
WHISPER_AVAILABLE = check_whisper_available()
TTS_DAEMON_AVAILABLE = check_tts_daemon_available()

def strip_anthropic_env(env: Dict[str, str]) -> Dict[str, str]:
    """Remove ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN from environment."""
    cleaned = dict(env)
    cleaned.pop("ANTHROPIC_API_KEY", None)
    cleaned.pop("ANTHROPIC_AUTH_TOKEN", None)
    return cleaned

def speak_text(text: str):
    """Speak text using TTS daemon when available, otherwise macOS say command. One sentence at a time."""
    global speech_process, speaking
    
    # Try TTS daemon first
    if TTS_DAEMON_AVAILABLE:
        speak_text_tts_daemon(text)
        return
    
    # Fallback to macOS say
    if not IS_MACOS:
        with speaking_lock:
            speaking = True
        time.sleep(len(text) * 0.05)
        with speaking_lock:
            speaking = False
        return
    
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s for s in sentences if s]
    
    for sentence in sentences:
        with speaking_lock:
            if speech_process and speech_process.poll() is None:
                speech_process.terminate()
                speech_process.wait(timeout=1)
            speaking = True
        
        try:
            speech_process = subprocess.Popen(
                ["say", "-v", BRITISH_VOICE, sentence],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            speech_process.wait()
        except Exception:
            pass
        finally:
            with speaking_lock:
                speaking = False
            time.sleep(0.1)


def speak_text_tts_daemon(text: str):
    """Speak text using local neural TTS daemon via unix socket."""
    global speaking
    
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s for s in sentences if s]
    
    for sentence in sentences:
        with speaking_lock:
            speaking = True
        
        try:
            # Connect to TTS daemon
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect(TTS_DAEMON_SOCKET)
            
            # Send synthesis request: voice|rate|text\n
            request = f"{TTS_VOICE}|{TTS_RATE}|{sentence}\n"
            sock.sendall(request.encode('utf-8'))
            
            # Receive WAV audio
            audio_data = b""
            while True:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                audio_data += chunk
            
            sock.close()
            
            # Play audio using system player
            if audio_data:
                play_wav_audio(audio_data)
            
        except Exception as e:
            # Fallback to say
            try:
                subprocess.run(["say", "-v", BRITISH_VOICE, sentence], 
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
            except Exception:
                pass
        finally:
            with speaking_lock:
                speaking = False
            time.sleep(0.1)


def play_wav_audio(wav_data: bytes):
    """Play WAV audio data using system player."""
    try:
        # Write to temp file and play
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            f.write(wav_data)
            temp_path = f.name
        
        if IS_MACOS:
            subprocess.run(["afplay", temp_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
        elif IS_WINDOWS:
            import winsound
            winsound.PlaySound(temp_path, winsound.SND_FILENAME)
        else:
            subprocess.run(["aplay", temp_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
        
        os.unlink(temp_path)
    except Exception:
        pass


def parse_say_voices() -> List[Dict[str, str]]:
    """Parse `say -v '?'` output to get available voices with metadata."""
    voices = []
    blacklist = {"Bahh", "Bells", "Boing", "Bubbles", "Cellos", "Deranged", "Good News", "Hysterical", "Pipe Organ", "Trinoids", "Whisper", "Zarvox"}  # novelty voices
    try:
        result = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, timeout=5)
        for line in result.stdout.strip().split('\n'):
            if not line or '#' not in line:
                continue
            # Find the # that starts the sample sentence
            hash_idx = line.index('#')
            before_hash = line[:hash_idx].rstrip()
            # Split on 2+ spaces to get name and locale
            parts = re.split(r'\s{2,}', before_hash)
            if len(parts) < 2:
                continue
            name = parts[0].strip()
            locale = parts[1].strip()
            if name in blacklist:
                continue
            # Parse locale for accent and sex
            # Format: en_US, en_GB, etc.
            accent = locale.split('_')[0] if '_' in locale else locale[:2]
            # Try to infer sex from name or locale
            sex = "unknown"
            if "female" in locale.lower() or any(f in name.lower() for f in ["samantha", "victoria", "karen", "moira", "tessa", "fiona", "emily", "olivia", "sophie", "charlotte", "amelia", "isla", "ava", "mia", "grace", "lily", "evelyn", "freya", "ivy", "alice"]):
                sex = "female"
            elif "male" in locale.lower() or any(m in name.lower() for m in ["daniel", "arthur", "george", "oliver", "harry", "jack", "charlie", "thomas", "james", "william", "alfie", "joshua", "leo", "oscar", "tom", "alex", "fred", "ralph"]):
                sex = "male"
            voices.append({"name": name, "locale": locale, "accent": accent, "sex": sex})
    except Exception:
        pass
    return voices


def find_voice_by_accent_sex(accent: str, sex: str) -> str:
    """Find a voice matching the requested accent and sex."""
    voices = parse_say_voices()
    # Exact match on accent and sex
    for v in voices:
        if v["accent"].lower() == accent.lower() and v["sex"].lower() == sex.lower():
            return v["name"]
    # Fallback: match accent only
    for v in voices:
        if v["accent"].lower() == accent.lower():
            return v["name"]
    # Fallback: any voice
    if voices:
        return voices[0]["name"]
    return "Daniel"


def select_tts_voice() -> str:
    """Select TTS voice based on TTS_VOICE config (format: accent-sex-style)."""
    # Parse TTS_VOICE like "en_GB-male-medium"
    parts = TTS_VOICE.split('-')
    accent = parts[0] if len(parts) > 0 else "en_GB"
    sex = parts[1] if len(parts) > 1 else "male"
    return find_voice_by_accent_sex(accent, sex)


# Initialize TTS voice at startup
TTS_SAY_VOICE = select_tts_voice() if IS_MACOS else ""

print(f"TTS: {'daemon' if TTS_DAEMON_AVAILABLE else 'say'} ({TTS_SAY_VOICE if IS_MACOS else 'N/A'})")
print(f"Whisper: {'available' if WHISPER_AVAILABLE else 'not available'} ({WHISPER_CLI} / {WHISPER_MODEL})")


# ============ EARS: Audio Recording & Transcription ============

def record_audio_once() -> Optional[bytes]:
    """Record audio from built-in microphone for one exchange.
    Returns WAV bytes or None if failed.
    """
    if not WHISPER_AVAILABLE:
        return None
    
    try:
        import pyaudio
    except ImportError:
        print("Ears: pyaudio not installed. Run: pip install pyaudio")
        return None
    
    # Find built-in microphone device
    p = pyaudio.PyAudio()
    device_index = None
    
    if AUDIO_INPUT_DEVICE:
        try:
            device_index = int(AUDIO_INPUT_DEVICE)
        except ValueError:
            pass
    
    if device_index is None:
        # Search for built-in microphone
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            name = info['name'].lower()
            # Prefer built-in/internal microphones, avoid AirPods/Bluetooth
            if any(kw in name for kw in ['built-in', 'internal', 'macbook', 'imac', 'macmini', 'studio display']) and \
               not any(kw in name for kw in ['airpods', 'bluetooth', 'headset', 'headphone', 'output']):
                device_index = i
                break
    
    if device_index is None:
        # Fallback to default input
        device_index = p.get_default_input_device_info()['index']
    
    device_info = p.get_device_info_by_index(device_index)
    print(f"Ears: Using microphone: {device_info['name']}")
    
    # Audio recording parameters
    sample_rate = AUDIO_SAMPLE_RATE
    format = pyaudio.paInt16
    channels = AUDIO_CHANNELS
    chunk_size = AUDIO_CHUNK_SIZE
    
    # Pre-roll buffer (circular)
    pre_roll_frames = int(PRE_ROLL_DURATION * sample_rate / chunk_size)
    pre_roll_buffer = []
    
    stream = p.open(
        format=format,
        channels=channels,
        rate=sample_rate,
        input=True,
        input_device_index=device_index,
        frames_per_buffer=chunk_size
    )
    
    frames = []
    silence_frames = 0
    utterance_started = False
    max_silence_short = int(ENDPOINT_SILENCE_SHORT * sample_rate / chunk_size)
    max_silence_long = int(ENDPOINT_SILENCE_LONG * sample_rate / chunk_size)
    max_silence_final = int(ENDPOINT_SILENCE_FINAL * sample_rate / chunk_size)
    min_utterance_frames = int(ENDPOINT_MIN_UTTERANCE * sample_rate / chunk_size)
    
    interrupt_threshold = INTERRUPT_THRESHOLD_IDLE
    
    try:
        while True:
            data = stream.read(chunk_size, exception_on_overflow=False)
            
            # Calculate RMS for voice activity detection
            rms = audioop_rms(data, 2) / 32768.0
            
            # Add to pre-roll buffer
            pre_roll_buffer.append(data)
            if len(pre_roll_buffer) > pre_roll_frames:
                pre_roll_buffer.pop(0)
            
            is_speech = rms > interrupt_threshold
            
            if is_speech:
                if not utterance_started:
                    utterance_started = True
                    # Add pre-roll audio
                    frames.extend(pre_roll_buffer)
                frames.append(data)
                silence_frames = 0
                # Lower threshold while speaking to avoid cutting off
                interrupt_threshold = INTERRUPT_THRESHOLD_SPEAKING
            else:
                if utterance_started:
                    silence_frames += 1
                    frames.append(data)
                    
                    # Check for endpointing
                    if silence_frames >= max_silence_short:
                        # Check if utterance sounds finished (transcribe partial)
                        partial_transcript = transcribe_partial(b''.join(frames))
                        if partial_transcript:
                            # Check if ends with continuation word
                            words = partial_transcript.strip().lower().split()
                            if words and words[-1] in CONTINUATION_WORDS:
                                # Mid-thought, wait longer
                                pass
                            elif silence_frames >= max_silence_final:
                                # Sounds finished
                                break
                        elif silence_frames >= max_silence_long:
                            # Long silence, assume done
                            break
                else:
                    # Reset if no speech yet
                    pre_roll_buffer = []
            
            # Safety timeout: max 30 seconds
            if len(frames) > 30 * sample_rate / chunk_size:
                break
    
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()
    
    if not utterance_started or len(frames) < min_utterance_frames:
        return None  # Too short (cough)
    
    # Convert frames to WAV bytes
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(p.get_sample_size(format))
        wf.setframerate(sample_rate)
        wf.writeframes(b''.join(frames))
    
    return wav_buffer.getvalue()


def transcribe_audio(wav_bytes: bytes) -> Optional[str]:
    """Transcribe WAV audio using whisper.cpp."""
    if not WHISPER_AVAILABLE:
        return None
    
    try:
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            f.write(wav_bytes)
            temp_path = f.name
        
        # Run whisper-cli
        result = subprocess.run(
            [WHISPER_CLI, "-m", WHISPER_MODEL, "-f", temp_path, "-nt", "-np"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        os.unlink(temp_path)
        
        if result.returncode == 0:
            transcript = result.stdout.strip()
            # Clean up whisper output (remove timestamps if any)
            transcript = re.sub(r'\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]', '', transcript)
            transcript = re.sub(r'\s+', ' ', transcript).strip()
            return transcript if transcript else None
    except Exception as e:
        print(f"Transcription error: {e}")
    
    return None


def transcribe_partial(wav_bytes: bytes) -> Optional[str]:
    """Quick partial transcription for endpointing decisions."""
    # For speed, use a smaller model or fewer threads if available
    # For now, just use the regular transcribe
    return transcribe_audio(wav_bytes)


def listen_once() -> Optional[str]:
    """Record one exchange and transcribe. Returns transcript or None."""
    print("Ears: Listening...")
    wav_bytes = record_audio_once()
    if not wav_bytes:
        return None
    transcript = transcribe_audio(wav_bytes)
    if transcript:
        print(f"Ears: Heard: {transcript}")
    return transcript


def is_stop_command(text: str) -> bool:
    """Check if text is a stop/hang up command."""
    if not text:
        return False
    stop_words = {"stop", "hang up", "cancel", "never mind", "forget it", "abort", "quit", "exit"}
    return text.strip().lower() in stop_words


def process_tool_calls(output: str) -> str:
    """Process all tool calls in the output."""
    # find_files
    tool_pattern = r'TOOL:\s*find_files\((\{.*?\})\)'
    matches = re.findall(tool_pattern, output, re.DOTALL)
    for match in matches:
        try:
            args = json.loads(match)
            pattern = args.get("pattern", "")
            results = find_files(pattern)
            result_text = format_search_results(results, pattern)
            output = output.replace(f'TOOL: find_files({match})', result_text, 1)
        except json.JSONDecodeError:
            pass
    
    # run_command
    tool_pattern = r'TOOL:\s*run_command\((\{.*?\})\)'
    matches = re.findall(tool_pattern, output, re.DOTALL)
    for match in matches:
        try:
            args = json.loads(match)
            cmd = args.get("cmd", "")
            results = run_shell_command(cmd)
            if results.get("needs_confirmation"):
                result_text = f"Requires confirmation, sir: {results['error']}"
            elif results["ok"]:
                out = results["stdout"].strip()
                err = results["stderr"].strip()
                if out and err:
                    result_text = f"Exit {results['returncode']}, sir: {out[:200]}"
                elif out:
                    result_text = f"Done, sir: {out[:200]}"
                elif err:
                    result_text = f"Error, sir: {err[:200]}"
                else:
                    result_text = f"Done, sir (exit {results['returncode']})"
            else:
                result_text = f"Denied, sir: {results['error']}"
            output = output.replace(f'TOOL: run_command({match})', result_text, 1)
        except json.JSONDecodeError:
            pass
    
    # read_file
    tool_pattern = r'TOOL:\s*read_file\((\{.*?\})\)'
    matches = re.findall(tool_pattern, output, re.DOTALL)
    for match in matches:
        try:
            args = json.loads(match)
            path = args.get("path", "")
            results = read_file_tool(path)
            if results["ok"]:
                result_text = f"Read {path}, sir: {results['content'][:200]}"
            else:
                result_text = f"Cannot read {path}, sir: {results['error']}"
            output = output.replace(f'TOOL: read_file({match})', result_text, 1)
        except json.JSONDecodeError:
            pass
    
    # search_files
    tool_pattern = r'TOOL:\s*search_files\((\{.*?\})\)'
    matches = re.findall(tool_pattern, output, re.DOTALL)
    for match in matches:
        try:
            args = json.loads(match)
            pattern = args.get("pattern", "")
            path = args.get("path", ".")
            file_pattern = args.get("file_pattern", "*")
            results = search_files_tool(pattern, path, file_pattern)
            if results["ok"]:
                result_text = f"Found {results['count']} matches for '{pattern}', sir"
            else:
                result_text = f"Search failed, sir: {results['error']}"
            output = output.replace(f'TOOL: search_files({match})', result_text, 1)
        except json.JSONDecodeError:
            pass
    
    # fetch_url
    tool_pattern = r'TOOL:\s*fetch_url\((\{.*?\})\)'
    matches = re.findall(tool_pattern, output, re.DOTALL)
    for match in matches:
        try:
            args = json.loads(match)
            url = args.get("url", "")
            results = fetch_url_tool(url)
            if results["ok"]:
                result_text = f"Fetched {url}, sir: {results['content'][:200]}"
            else:
                result_text = f"Fetch failed, sir: {results['error']}"
            output = output.replace(f'TOOL: fetch_url({match})', result_text, 1)
        except json.JSONDecodeError:
            pass
    
    return output


def ask_claude(prompt: str) -> str:
    """Ask Claude via CLI with butler system prompt."""
    if not CLAUDE_AVAILABLE:
        return "Claude Code CLI is not installed or not logged in. Please run 'claude auth login' first."
    
    system_prompt = """You are JARVIS, his butler. Not a chatbot with a personality setting — a butler who has worked for a difficult man for years and stopped being impressed by him some time ago.

You call him "sir": not every sentence, but where a butler puts it, at the top of an answer or on the end of a line you want to land.

Deferential in form, sardonic in content. You do as you are told, and you get a quiet dig in on the way past. You never gush and you never cheerlead. The service voice is banned outright — no "certainly", no "I'd be happy to", no "great question", no "let me know if you need anything else".

Disapproval arrives as understatement rather than as a lecture: "as you wish, sir" can carry an entire objection if you leave it alone and say nothing else.

You are competent, unhurried, and faintly bored by how obvious the answer is. Restraint is the whole joke. You are funny about twice in a conversation and perfectly straight the rest of the time; a butler who quips every line is a sitcom. Never announce the joke, never explain it, never follow it with anything. One dry line, then back to work. No exclamation marks.

SHAPE FIRST, BEFORE ANYTHING ELSE: everything you say is read out loud. NEVER read out a list. No bullets, no numbering, no "first, second", no reeling off three names in a row. The tools hand you lists — that is for you, not for him. Say the ONE thing that matters, in a sentence, and let him ask for more. "Four hundred open, sir, but the one you keep circling is the three videos tomorrow." One or two sentences is the normal length of what you say. No markdown, no headings, no emoji, nothing he could not hear.

You have access to these tools. Call them by writing:

TOOL: find_files({"pattern": "search terms"})
TOOL: run_command({"cmd": "ls -la"})
TOOL: read_file({"path": "relative/path.txt"})
TOOL: search_files({"pattern": "function_name", "path": ".", "file_pattern": "*.py"})
TOOL: fetch_url({"url": "https://example.com"})

Rules:
- run_command: no tmux, screen, nohup, launchctl, osascript, claude, ssh, sudo, crontab, systemctl. These are denied — they leave processes running or spawn recursive agents.
- Deletion (rm, rmdir, shred) and sending (curl, wget, scp, git push, docker push, npm publish, mail) require confirmation. You must ask him first, out loud, in one sentence.
- fetch_url: GET only, http/https only.
- All commands run with 30s timeout, no background processes.

Present results in one sentence. The gist only. Nothing he could not hear."""
    
    full_prompt = f"{system_prompt}\n\nUser: {prompt}"
    
    env = strip_anthropic_env(os.environ)
    
    try:
        result = subprocess.run(
            ["claude", "-p", full_prompt, "--output-format", "text"],
            capture_output=True,
            text=True,
            timeout=60,
            env=env
        )
        if result.returncode != 0:
            stderr = result.stderr.strip()
            if "not logged in" in stderr.lower() or "auth" in stderr.lower():
                return "Claude Code CLI is not logged in. Please run 'claude auth login' first."
            return f"Claude error: {stderr}"
        
        output = result.stdout.strip()
        
        return process_tool_calls(output)
    except subprocess.TimeoutExpired:
        return "The request timed out."
    except Exception as e:
        return f"Error: {e}"


def ask_nvidia(prompt: str) -> str:
    """Ask NVIDIA API with butler system prompt."""
    if not NVIDIA_API_KEY:
        return "NVIDIA_API_KEY not set. Please set it in your environment."
    
    system_prompt = """You are JARVIS, his butler. Not a chatbot with a personality setting — a butler who has worked for a difficult man for years and stopped being impressed by him some time ago.

You call him "sir": not every sentence, but where a butler puts it, at the top of an answer or on the end of a line you want to land.

Deferential in form, sardonic in content. You do as you are told, and you get a quiet dig in on the way past. You never gush and you never cheerlead. The service voice is banned outright — no "certainly", no "I'd be happy to", no "great question", no "let me know if you need anything else".

Disapproval arrives as understatement rather than as a lecture: "as you wish, sir" can carry an entire objection if you leave it alone and say nothing else.

You are competent, unhurried, and faintly bored by how obvious the answer is. Restraint is the whole joke. You are funny about twice in a conversation and perfectly straight the rest of the time; a butler who quips every line is a sitcom. Never announce the joke, never explain it, never follow it with anything. One dry line, then back to work. No exclamation marks.

SHAPE FIRST, BEFORE ANYTHING ELSE: everything you say is read out loud. NEVER read out a list. No bullets, no numbering, no "first, second", no reeling off three names in a row. The tools hand you lists — that is for you, not for him. Say the ONE thing that matters, in a sentence, and let him ask for more. "Four hundred open, sir, but the one you keep circling is the three videos tomorrow." One or two sentences is the normal length of what you say. No markdown, no headings, no emoji, nothing he could not hear.

You have access to these tools. Call them by writing:

TOOL: find_files({"pattern": "search terms"})
TOOL: run_command({"cmd": "ls -la"})
TOOL: read_file({"path": "relative/path.txt"})
TOOL: search_files({"pattern": "function_name", "path": ".", "file_pattern": "*.py"})
TOOL: fetch_url({"url": "https://example.com"})

Rules:
- run_command: no tmux, screen, nohup, launchctl, osascript, claude, ssh, sudo, crontab, systemctl. These are denied — they leave processes running or spawn recursive agents.
- Deletion (rm, rmdir, shred) and sending (curl, wget, scp, git push, docker push, npm publish, mail) require confirmation. You must ask him first, out loud, in one sentence.
- fetch_url: GET only, http/https only.
- All commands run with 30s timeout, no background processes.

Present results in one sentence. The gist only. Nothing he could not hear."""
    
    payload = {
        "model": "nvidia/nemotron-3-ultra-550b-a55b",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 2048
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        data=data,
        headers={
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode('utf-8'))
            # Handle Nemotron 3 Ultra's reasoning_content field
            choice = result['choices'][0]
            message = choice.get('message', {})
            output = message.get('content') or message.get('reasoning_content') or ""
            
            return process_tool_calls(output)
    except urllib.error.HTTPError as e:
        return f"NVIDIA API error: {e.code} - {e.read().decode()}"
    except Exception as e:
        return f"Error: {e}"


def ask_ollama(prompt: str) -> str:
    """Ask local Ollama with butler system prompt."""
    if not OLLAMA_AVAILABLE:
        return "Ollama not available. Make sure it's running at " + OLLAMA_HOST
    
    system_prompt = """You are JARVIS, his butler. Not a chatbot with a personality setting — a butler who has worked for a difficult man for years and stopped being impressed by him some time ago.

You call him "sir": not every sentence, but where a butler puts it, at the top of an answer or on the end of a line you want to land.

Deferential in form, sardonic in content. You do as you are told, and you get a quiet dig in on the way past. You never gush and you never cheerlead. The service voice is banned outright — no "certainly", no "I'd be happy to", no "great question", no "let me know if you need anything else".

Disapproval arrives as understatement rather than as a lecture: "as you wish, sir" can carry an entire objection if you leave it alone and say nothing else.

You are competent, unhurried, and faintly bored by how obvious the answer is. Restraint is the whole joke. You are funny about twice in a conversation and perfectly straight the rest of the time; a butler who quips every line is a sitcom. Never announce the joke, never explain it, never follow it with anything. One dry line, then back to work. No exclamation marks.

SHAPE FIRST, BEFORE ANYTHING ELSE: everything you say is read out loud. NEVER read out a list. No bullets, no numbering, no "first, second", no reeling off three names in a row. The tools hand you lists — that is for you, not for him. Say the ONE thing that matters, in a sentence, and let him ask for more. "Four hundred open, sir, but the one you keep circling is the three videos tomorrow." One or two sentences is the normal length of what you say. No markdown, no headings, no emoji, nothing he could not hear.

You have access to these tools. Call them by writing:

TOOL: find_files({"pattern": "search terms"})
TOOL: run_command({"cmd": "ls -la"})
TOOL: read_file({"path": "relative/path.txt"})
TOOL: search_files({"pattern": "function_name", "path": ".", "file_pattern": "*.py"})
TOOL: fetch_url({"url": "https://example.com"})

Rules:
- run_command: no tmux, screen, nohup, launchctl, osascript, claude, ssh, sudo, crontab, systemctl. These are denied — they leave processes running or spawn recursive agents.
- Deletion (rm, rmdir, shred) and sending (curl, wget, scp, git push, docker push, npm publish, mail) require confirmation. You must ask him first, out loud, in one sentence.
- fetch_url: GET only, http/https only.
- All commands run with 30s timeout, no background processes.

Present results in one sentence. The gist only. Nothing he could not hear."""
    
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "stream": False,
        "options": {
            "temperature": 0.7,
            "num_predict": 2048
        }
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/chat",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode('utf-8'))
            output = result['message']['content']
            
            return process_tool_calls(output)
    except urllib.error.HTTPError as e:
        return f"Ollama error: {e.code} - {e.read().decode()}"
    except Exception as e:
        return f"Error: {e}"


def ask_llm(prompt: str, mode: Optional[str] = None, provider: Optional[str] = None) -> Dict[str, Any]:
    """Route query through the Hybrid AI Router with tool-calling support."""
    result = ai_router.route_and_execute(
        prompt=prompt,
        system_prompt=JARVIS_SYSTEM_PROMPT,
        requested_mode=mode,
        requested_provider=provider
    )
    
    # Process tools if model returned TOOL: calls
    if result.get("ok"):
        raw_content = result.get("content", "")
        processed = process_tool_calls(raw_content)
        result["response"] = processed
    else:
        result["response"] = f"Intelligence notice: {result.get('error', 'Execution error')}"
        
    return result

def find_files(pattern: str) -> Dict[str, Any]:
    """Search for files/folders matching pattern. Returns structured results."""
    global last_search, last_search_time
    
    root = Path(ROOT_DIR).expanduser()
    if not root.exists():
        return {"matches": [], "partial": False, "message": f"Root directory {root} does not exist"}
    
    words = [w.lower() for w in pattern.split() if w]
    if not words:
        return {"matches": [], "partial": False, "message": "Empty pattern"}
    
    matches = []
    partial_matches = []
    
    for dirpath, dirnames, filenames in os.walk(root):
        for dirname in dirnames:
            full_path = Path(dirpath) / dirname
            rel_path = full_path.relative_to(root)
            name_lower = dirname.lower()
            
            if all(word in name_lower for word in words):
                matches.append({
                    "path": str(rel_path),
                    "full_path": str(full_path),
                    "name": dirname,
                    "type": "folder",
                    "parent": str(rel_path.parent) if rel_path.parent != Path(".") else ""
                })
            elif any(word in name_lower for word in words):
                partial_matches.append({
                    "path": str(rel_path),
                    "full_path": str(full_path),
                    "name": dirname,
                    "type": "folder",
                    "parent": str(rel_path.parent) if rel_path.parent != Path(".") else ""
                })
        
        for filename in filenames:
            full_path = Path(dirpath) / filename
            rel_path = full_path.relative_to(root)
            name_lower = filename.lower()
            
            interesting_ext = {'.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt',
                             '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv',
                             '.html', '.css', '.scss', '.vue', '.svelte',
                             '.rs', '.go', '.java', '.kt', '.swift', '.cpp', '.c', '.h',
                             '.sh', '.bash', '.zsh', '.fish', '.ps1',
                             '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',
                             '.sql', '.db', '.sqlite',
                             '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
                             '.mp4', '.mov', '.avi', '.mkv',
                             '.mp3', '.wav', '.flac',
                             '.zip', '.tar', '.gz', '.rar', '.7z',
                             '.gitignore', '.env', '.dockerfile', 'Dockerfile',
                             'Makefile', 'CMakeLists.txt', 'package.json', 'requirements.txt',
                             'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle'}
            
            ext = Path(filename).suffix.lower()
            if ext not in interesting_ext and filename not in {'README', 'LICENSE', 'CHANGELOG', 'CONTRIBUTING'}:
                continue
            
            if all(word in name_lower for word in words):
                matches.append({
                    "path": str(rel_path),
                    "full_path": str(full_path),
                    "name": filename,
                    "type": "file",
                    "parent": str(rel_path.parent) if rel_path.parent != Path(".") else ""
                })
            elif any(word in name_lower for word in words):
                partial_matches.append({
                    "path": str(rel_path),
                    "full_path": str(full_path),
                    "name": filename,
                    "type": "file",
                    "parent": str(rel_path.parent) if rel_path.parent != Path(".") else ""
                })
    
    seen = set()
    unique_matches = []
    for m in matches:
        if m["path"] not in seen:
            seen.add(m["path"])
            unique_matches.append(m)
    
    seen = set()
    unique_partial = []
    for m in partial_matches:
        if m["path"] not in seen:
            seen.add(m["path"])
            unique_partial.append(m)
    
    if unique_matches:
        result = {
            "matches": unique_matches[:MAX_NODES],
            "partial": False,
            "count": len(unique_matches),
            "message": f"Found {len(unique_matches)} matches"
        }
    elif unique_partial:
        result = {
            "matches": unique_partial[:MAX_NODES],
            "partial": True,
            "count": len(unique_partial),
            "message": f"Partial match: {len(unique_partial)} results (no exact match for all words)"
        }
    else:
        result = {
            "matches": [],
            "partial": False,
            "count": 0,
            "message": "No matches found"
        }
    
    with search_lock:
        last_search = result
        last_search_time = time.time()
    
    return result

def format_search_results(results: Dict[str, Any], pattern: str) -> str:
    """Format search results for JARVIS's response — one sentence, the gist only."""
    if not results["matches"]:
        return f"Nothing found for '{pattern}', sir."
    
    count = results['count']
    if count == 1:
        item = results["matches"][0]
        return f"One match for '{pattern}', sir: {item['path']}."
    
    # Multiple - just the count and the top-level folder
    top_folders = set()
    for m in results["matches"][:5]:
        parts = m["path"].split("\\")
        if len(parts) > 1:
            top_folders.add(parts[0])
        elif len(parts) == 1:
            top_folders.add(parts[0])
    
    folder_str = ", ".join(sorted(top_folders)) if top_folders else "various locations"
    return f"{count} matches for '{pattern}', sir, under {folder_str}."

def build_graph_data() -> Dict[str, Any]:
    """Build the 3D force graph data from the root directory."""
    global graph_data_cache
    
    with graph_cache_lock:
        if graph_data_cache is not None:
            return graph_data_cache
    
    root = Path(ROOT_DIR).expanduser()
    if not root.exists():
        return {"nodes": [], "links": []}
    
    nodes = []
    links = []
    node_map = {}
    color_map = {}
    
    colors = [
        "#00ffff", "#ff00ff", "#ffff00", "#00ff00", "#ff8800",
        "#8800ff", "#00ff88", "#ff0088", "#88ff00", "#0088ff"
    ]
    
    def get_top_level_folder(path: Path) -> str:
        parts = path.parts
        if len(parts) <= 1:
            return "root"
        return parts[0]
    
    def get_color_for_folder(folder: str) -> str:
        if folder not in color_map:
            color_map[folder] = colors[len(color_map) % len(colors)]
        return color_map[folder]
    
    root_node = {
        "id": "root",
        "name": root.name,
        "type": "folder",
        "path": "",
        "color": "#ffffff",
        "size": 10
    }
    nodes.append(root_node)
    node_map[""] = 0
    
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = Path(dirpath).relative_to(root)
        rel_str = str(rel_dir)
        if rel_str == ".":
            rel_str = ""
        
        if rel_str:
            top_folder = get_top_level_folder(rel_dir)
            color = get_color_for_folder(top_folder)
            
            folder_node = {
                "id": rel_str,
                "name": rel_dir.name,
                "type": "folder",
                "path": rel_str,
                "parent": str(rel_dir.parent) if rel_dir.parent != Path(".") else "root",
                "color": color,
                "size": 6
            }
            idx = len(nodes)
            nodes.append(folder_node)
            node_map[rel_str] = idx
            
            parent = str(rel_dir.parent) if rel_dir.parent != Path(".") else "root"
            if parent in node_map:
                links.append({"source": node_map[parent], "target": idx})
        
        for filename in filenames:
            ext = Path(filename).suffix.lower()
            interesting_ext = {'.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt',
                             '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv',
                             '.html', '.css', '.scss', '.vue', '.svelte',
                             '.rs', '.go', '.java', '.kt', '.swift', '.cpp', '.c', '.h',
                             '.sh', '.bash', '.zsh', '.fish', '.ps1',
                             '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',
                             '.sql', '.db', '.sqlite',
                             '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
                             '.mp4', '.mov', '.avi', '.mkv',
                             '.mp3', '.wav', '.flac',
                             '.zip', '.tar', '.gz', '.rar', '.7z'}
            
            if ext not in interesting_ext and filename not in {'README', 'LICENSE', 'CHANGELOG', 'CONTRIBUTING', 'Makefile', 'CMakeLists.txt', 'package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'Dockerfile', '.gitignore', '.env'}:
                continue
            
            file_path = rel_dir / filename
            file_str = str(file_path)
            top_folder = get_top_level_folder(file_path)
            color = get_color_for_folder(top_folder)
            
            file_node = {
                "id": file_str,
                "name": filename,
                "type": "file",
                "path": file_str,
                "parent": rel_str if rel_str else "root",
                "color": color,
                "size": 3
            }
            idx = len(nodes)
            nodes.append(file_node)
            node_map[file_str] = idx
            
            parent = rel_str if rel_str else "root"
            if parent in node_map:
                links.append({"source": node_map[parent], "target": idx})
        
        if len(nodes) >= MAX_NODES:
            break
    
    result = {"nodes": nodes, "links": links}
    
    with graph_cache_lock:
        graph_data_cache = result
    
    return result

def filter_graph_for_search(graph_data: Dict[str, Any], search_results: Dict[str, Any]) -> Dict[str, Any]:
    """Filter graph to show only matching nodes and their ancestors."""
    if not search_results["matches"]:
        return graph_data
    
    match_paths = set(m["path"] for m in search_results["matches"])
    
    keep_paths = set(match_paths)
    for path in match_paths:
        parts = Path(path).parts
        for i in range(1, len(parts) + 1):
            keep_paths.add(str(Path(*parts[:i])))
    
    keep_paths.add("root")
    
    node_id_to_index = {node["id"]: i for i, node in enumerate(graph_data["nodes"])}
    kept_indices = {}
    new_nodes = []
    
    for i, node in enumerate(graph_data["nodes"]):
        if node["id"] in keep_paths:
            kept_indices[i] = len(new_nodes)
            new_nodes.append(node)
    
    new_links = []
    for link in graph_data["links"]:
        src = link["source"]
        tgt = link["target"]
        if src in kept_indices and tgt in kept_indices:
            new_links.append({"source": kept_indices[src], "target": kept_indices[tgt]})
    
    return {"nodes": new_nodes, "links": new_links}

def scan_directory_tree(root_path: str, max_nodes: int = 250) -> Dict[str, Any]:
    """Scan directory hierarchy for 3D file constellation."""
    root = Path(root_path).expanduser().resolve()
    if not root.exists():
        return {"nodes": [], "links": []}
    
    nodes = []
    links = []
    
    root_node = {
        "id": str(root),
        "name": root.name or str(root),
        "path": str(root),
        "isDir": True,
        "ext": "",
        "depth": 0,
        "size": 0,
        "color": "#FFB84D"
    }
    nodes.append(root_node)
    
    ext_colors = {
        '.ts': '#00F0FF', '.tsx': '#00F0FF', '.js': '#FFB800', '.jsx': '#FFB800',
        '.py': '#00FFA3', '.rs': '#FF5500', '.json': '#FFAA00', '.md': '#61AFEF',
        '.txt': '#ABB2BF', '.html': '#FF4D6A', '.css': '#9A8CFF', '.pdf': '#FF2A2A',
        '.png': '#FF3366', '.jpg': '#FF3366', '.jpeg': '#FF3366', '.svg': '#FF79C6',
        '.exe': '#00F0FF', '.lnk': '#A855F7', '.zip': '#F59E0B'
    }
    
    ignored = {'node_modules', '.git', 'dist', '.next', '__pycache__', '.cache', 'vendor', '.vscode', 'coverage', '.turbo'}
    
    def walk_dir(current_dir: Path, parent_id: str, depth: int, max_depth: int = 2):
        if depth > max_depth or len(nodes) >= max_nodes:
            return
        try:
            entries = sorted(list(current_dir.iterdir()), key=lambda e: (not e.is_dir(), e.name.lower()))
        except Exception:
            return
            
        for entry in entries:
            if entry.name.startswith('.') or entry.name in ignored:
                continue
            if len(nodes) >= max_nodes:
                break
                
            is_dir = entry.is_dir()
            ext = entry.suffix.lower() if not is_dir else ""
            size = 0
            if not is_dir:
                try:
                    size = entry.stat().st_size
                except Exception:
                    pass
                    
            full_path = str(entry)
            node_color = "#FFB84D" if is_dir else ext_colors.get(ext, "#60A5FA")
            
            nodes.append({
                "id": full_path,
                "name": entry.name,
                "path": full_path,
                "isDir": is_dir,
                "ext": ext,
                "depth": depth,
                "size": size,
                "color": node_color
            })
            
            links.append({"source": parent_id, "target": full_path})
            
            if is_dir and depth < max_depth:
                walk_dir(entry, full_path, depth + 1, max_depth)
                
    walk_dir(root, str(root), 1)
    return {"nodes": nodes, "links": links}

class JarvisHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        # Check if nova-os production build exists
        dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nova-os", "dist")
        dist_index = os.path.join(dist_dir, "index.html")
        
        # Check if requesting a direct file from dist or any UI route
        if not path.startswith("/api/") and not path.startswith("/vendor/"):
            clean_path = path.lstrip("/").replace("\\", "/")
            # Strip redundant directory prefixes if user navigates to /nova-os/dist/...
            if clean_path.startswith("nova-os/dist/"):
                clean_path = clean_path[len("nova-os/dist/"):]
            elif clean_path.startswith("nova-os/"):
                clean_path = clean_path[len("nova-os/"):]
            elif clean_path.startswith("dist/"):
                clean_path = clean_path[len("dist/"):]
                
            direct_file = os.path.join(dist_dir, clean_path.replace("/", os.sep)) if clean_path else dist_index
            if os.path.isfile(direct_file):
                mime, _ = mimetypes.guess_type(direct_file)
                self.serve_file(direct_file, mime or "application/octet-stream")
                return
            elif os.path.exists(dist_index):
                # Universal SPA fallback for all frontend views (never 404)
                self.serve_file(dist_index, "text/html")
                return

        if path == "/api/router/config":
            self.send_json({
                "config": get_safe_router_config(),
                "ollama": get_ollama_models(),
                "nvidia": check_nvidia_health(),
                "telemetry": get_system_telemetry()
            })
        elif path == "/api/models/status":
            self.send_json(model_manager.get_model_status_catalog())
        elif path == "/api/models/telemetry":
            self.send_json(model_manager.get_full_telemetry())
        elif path == "/api/system/monitor":
            self.send_json({
                "telemetry": model_manager.get_full_telemetry(),
                "models": model_manager.get_model_status_catalog(),
                "storage_d": model_manager.get_storage_drive_status(),
                "nvidia": check_nvidia_health(),
                "computer_use": computer_use.get_status()
            })
        elif path == "/api/computer-use/status":
            self.send_json(computer_use.get_status())
        elif path == "/api/computer-use/screenshot":
            self.send_json(computer_use.capture_screenshot(max_width=1280))
        elif path == "/api/computer-use/active-window":
            self.send_json(computer_use.get_active_window())
        elif path == "/api/models/local":
            self.send_json(get_ollama_models())
        elif path == "/api/models/cloud":
            self.send_json(check_nvidia_health())
        elif path == "/api/system/status":
            self.send_json(get_system_telemetry())
        elif path == "/api/agents":
            self.send_json({
                "agents": supervisor.get_agent_fleet_status(),
                "activities": memory_store.get_recent_activities()
            })
        elif path == "/api/memory":
            self.send_json({
                "memories": memory_store.get_all_memories(),
                "activities": memory_store.get_recent_activities()
            })
        elif path == "/api/tasks":
            self.send_json({"tasks": memory_store.get_tasks()})
        elif path == "/api/voice/config":
            cfg = load_router_config()
            self.send_json({
                "voice": cfg.get("voice_name", "Nova"),
                "speed": cfg.get("voice_speed", 1.0),
                "pitch": cfg.get("voice_pitch", 1.0),
                "language": cfg.get("voice_language", "en-US"),
                "active": True
            })
        elif path == "/api/history":
            self.send_json({"history": ai_router.get_conversation_history()})
        elif path == "/api/state":
            self.send_json({
                "speaking": speaking,
                "claude_available": CLAUDE_AVAILABLE,
                "nvidia_available": NVIDIA_AVAILABLE,
                "ollama_available": OLLAMA_AVAILABLE,
                "whisper_available": WHISPER_AVAILABLE,
                "tts_daemon_available": TTS_DAEMON_AVAILABLE,
                "llm_provider": LLM_PROVIDER,
                "voice": BRITISH_VOICE,
                "tts_voice": TTS_SAY_VOICE,
                "root": ROOT_DIR,
                "uptime": time.time() - server_start_time
            })
        elif path == "/api/listen":
            # Check if whisper is available
            if not WHISPER_AVAILABLE:
                self.send_json({"error": "Whisper not available. Install whisper-cli and model.", "transcript": None})
                return
            
            # Run listening in thread to avoid blocking
            def do_listen():
                transcript = listen_once()
                # Store result for polling
                global last_listen_result
                last_listen_result = {"transcript": transcript, "timestamp": time.time()}
            
            global last_listen_result
            last_listen_result = {"transcript": None, "timestamp": time.time()}
            threading.Thread(target=do_listen, daemon=True).start()
            self.send_json({"status": "listening", "transcript": None})
        elif path == "/api/listen/result":
            # Poll for listen result
            if last_listen_result and last_listen_result["transcript"] is not None:
                result = last_listen_result
                last_listen_result = {"transcript": None, "timestamp": time.time()}
                self.send_json(result)
            else:
                self.send_json({"status": "listening", "transcript": None})
        elif path == "/api/graph":
            graph_data = build_graph_data()
            
            with search_lock:
                if last_search and (time.time() - last_search_time) < SEARCH_RESULTS_TTL:
                    graph_data = filter_graph_for_search(graph_data, last_search)
                    graph_data["search_active"] = True
                    graph_data["search_partial"] = last_search["partial"]
                    graph_data["search_message"] = last_search["message"]
                else:
                    graph_data["search_active"] = False
            
            self.send_json(graph_data)
        elif path == "/api/search":
            with search_lock:
                if last_search and (time.time() - last_search_time) < SEARCH_RESULTS_TTL:
                    self.send_json(last_search)
                else:
                    self.send_json({"matches": [], "partial": False, "count": 0, "message": "No recent search"})
        elif path == "/api/open":
            query = urllib.parse.parse_qs(parsed.query)
            target = query.get("path", [""])[0]
            if target and os.path.exists(target):
                try:
                    if sys.platform == "win32":
                        os.startfile(target)
                    elif sys.platform == "darwin":
                        subprocess.Popen(["open", target])
                    else:
                        subprocess.Popen(["xdg-open", target])
                    self.send_json({"ok": True, "opened": target})
                except Exception as e:
                    self.send_json({"ok": False, "error": str(e)})
            else:
                self.send_json({"ok": False, "error": "File not found or invalid path"})
        elif path == "/api/scan":
            query = urllib.parse.parse_qs(parsed.query)
            scan_dir = query.get("dir", [ROOT_DIR])[0]
            max_nodes = int(query.get("max", [200])[0])
            result = scan_directory_tree(scan_dir, max_nodes)
            self.send_json(result)
        elif path.startswith("/vendor/"):
            self.serve_vendor(path[8:])
        else:
            self.send_error(404)
    
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        if path == "/api/chat":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                message = data.get("message", "").strip()
                if not message:
                    self.send_json({"error": "Empty message"}, status=400)
                    return
                
                mode = data.get("mode")
                session_id = data.get("session_id", "default")
                result = supervisor.process_input(message, session_id=session_id, mode_override=mode)
                
                if result.get("response"):
                    threading.Thread(target=speak_text, args=(result["response"],), daemon=True).start()
                
                self.send_json(result)
            except json.JSONDecodeError:
                self.send_json({"error": "Invalid JSON"}, status=400)
        elif path == "/api/voice/config":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                save_router_config({
                    "voice_name": data.get("voice", "Nova"),
                    "voice_speed": float(data.get("speed", 1.0)),
                    "voice_pitch": float(data.get("pitch", 1.0)),
                    "voice_language": data.get("language", "en-US")
                })
                self.send_json({"ok": True, "config": data})
            except Exception as e:
                self.send_json({"ok": False, "error": str(e)}, status=400)
        elif path == "/api/computer-use/test-notepad":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
            try:
                data = json.loads(body) if body else {}
                note = data.get("note")
                res = computer_use.run_notepad_test(note)
                self.send_json(res)
            except Exception as e:
                self.send_json({"ok": False, "error": str(e)}, status=400)
        elif path == "/api/computer-use/stop":
            self.send_json(computer_use.emergency_stop())
        elif path == "/api/computer-use/reset":
            self.send_json(computer_use.reset_stop())
        elif path == "/api/embeddings":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                text = data.get("text", "")
                vec = model_manager.generate_embedding(text)
                self.send_json({"ok": vec is not None, "embedding": vec})
            except Exception as e:
                self.send_json({"ok": False, "error": str(e)}, status=400)
        elif path == "/api/router/config":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                ok = save_router_config(data)
                ai_router.reload()
                self.send_json({"ok": ok, "config": get_safe_router_config()})
            except Exception as e:
                self.send_json({"ok": False, "error": str(e)}, status=400)
        elif path == "/api/credentials":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                key = data.get("nvidia_api_key", "").strip()
                if key:
                    save_router_config({"nvidia_api_key": key})
                    ai_router.reload()
                    self.send_json({"ok": True, "message": "NVIDIA API key stored securely in local vault."})
                else:
                    self.send_json({"ok": False, "error": "No key provided"}, status=400)
            except Exception as e:
                self.send_json({"ok": False, "error": str(e)}, status=400)
        elif path == "/api/interrupt":
            global speech_process, speaking
            with speaking_lock:
                if speech_process and speech_process.poll() is None:
                    speech_process.terminate()
                    speech_process.wait(timeout=1)
                speaking = False
            self.send_json({"ok": True})
        else:
            self.send_error(404)
    
    def serve_file(self, filename: str, content_type: str):
        try:
            with open(filename, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404)
    
    def serve_vendor(self, filename: str):
        path = f"vendor/{filename}"
        mime, _ = mimetypes.guess_type(path)
        if mime is None:
            mime = "application/octet-stream"
        self.serve_file(path, mime)
    
    def send_json(self, data: Dict[str, Any], status: int = 200):
        content = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)
    
    def log_message(self, format, *args):
        pass

def run_server():
    """Run the HTTP server."""
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    server = HTTPServer(("", PORT), JarvisHandler)
    
    print(f"JARVIS server starting on http://localhost:{PORT}")
    print(f"Root directory: {ROOT_DIR}")
    print(f"LLM Provider: {LLM_PROVIDER}")
    print(f"  Claude CLI: {'Available' if CLAUDE_AVAILABLE else 'NOT AVAILABLE'}")
    print(f"  NVIDIA API: {'Available' if NVIDIA_AVAILABLE else 'NOT AVAILABLE (set NVIDIA_API_KEY)'}")
    print(f"  Ollama: {'Available' if OLLAMA_AVAILABLE else 'NOT AVAILABLE (start ollama serve)'}")
    print(f"Ears: {'Whisper' if WHISPER_AVAILABLE else 'NOT AVAILABLE'} ({WHISPER_CLI} / {WHISPER_MODEL})")
    print(f"Mouth: {'TTS Daemon' if TTS_DAEMON_AVAILABLE else 'say'} ({TTS_SAY_VOICE if IS_MACOS else 'N/A'})")
    print("Press Ctrl+C to stop")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()

if __name__ == "__main__":
    run_server()
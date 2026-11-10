#!/usr/bin/env python3
"""
ORBIT Hybrid AI Intelligence Router
====================================
Central router that dynamically classifies incoming tasks and dispatches between:
1. LOCAL AI (Ollama + Custom Local LLM) for low-latency, private, everyday tasks.
2. NVIDIA CLOUD AI (Nemotron 3 Ultra 550B-A55B) for high-complexity,
   multi-step reasoning, advanced software architecture, and heavy context.

Routing Modes:
- AUTO: Evaluates multi-dimensional complexity score against threshold (default 45/100).
- LOCAL_ONLY: Strictly runs on local machine. Never silently routes to cloud.
- CLOUD_ONLY: Direct inference via NVIDIA Cloud.
- MANUAL: User selects provider and model.
"""

import os
import sys
import json
import time
import re
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# Configuration storage path (kept in project directory with strict access)
CONFIG_FILE = Path(os.path.dirname(os.path.abspath(__file__))) / ".orbit_config.json"
CONVERSATION_DIR = Path(os.path.dirname(os.path.abspath(__file__))) / ".orbit" / "conversations"

# Default Router Configuration
DEFAULT_CONFIG: Dict[str, Any] = {
    "routing_mode": "auto",              # "auto", "local_only", "cloud_only", "manual"
    "complexity_threshold": 45,          # 0-100: <=45 is local, >45 is NVIDIA cloud
    "preferred_local_provider": "ollama",# "ollama" or "custom_local"
    "preferred_local_model": "llama3.1:8b",
    "preferred_nvidia_model": "nvidia/nemotron-3-ultra-550b-a55b",
    "ollama_host": "http://localhost:11434",
    "nvidia_api_url": "https://integrate.api.nvidia.com/v1/chat/completions",
    "local_timeout_sec": 60,
    "cloud_timeout_sec": 90,
    "max_retries": 2,
    "fallback_enabled": True,            # Fall back to other provider if primary fails (ignored in LOCAL_ONLY)
    "custom_model_script": "",           # Optional path to user's custom local model script
}

def load_router_config() -> Dict[str, Any]:
    """Load configuration from disk or return defaults."""
    cfg = dict(DEFAULT_CONFIG)
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                cfg.update(saved)
        except Exception as e:
            print(f"[ORBIT Router] Warning loading config: {e}")

    # Environment variables take precedence if present
    if os.environ.get("NVIDIA_API_KEY"):
        cfg["nvidia_api_key"] = os.environ.get("NVIDIA_API_KEY")
    if os.environ.get("OLLAMA_HOST"):
        cfg["ollama_host"] = os.environ.get("OLLAMA_HOST")
    if os.environ.get("OLLAMA_MODEL"):
        cfg["preferred_local_model"] = os.environ.get("OLLAMA_MODEL")

    return cfg

def save_router_config(new_config: Dict[str, Any]) -> bool:
    """Save configuration to disk securely."""
    try:
        cfg = load_router_config()
        cfg.update(new_config)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
        return True
    except Exception as e:
        print(f"[ORBIT Router] Error saving config: {e}")
        return False

def get_safe_router_config() -> Dict[str, Any]:
    """Return configuration with sensitive API keys masked."""
    cfg = load_router_config()
    safe = dict(cfg)
    if "nvidia_api_key" in safe:
        val = safe["nvidia_api_key"] or ""
        safe["nvidia_api_key"] = ("••••••••" + val[-4:]) if len(val) >= 4 else ("••••" if val else "")
        safe["has_nvidia_api_key"] = bool(val and val.strip())
    else:
        safe["has_nvidia_api_key"] = bool(os.environ.get("NVIDIA_API_KEY", "").strip())
    return safe


# ─── Task Complexity Classifier ─────────────────────────────────────────────

# Indicators for complex reasoning / advanced development
COMPLEX_PATTERNS = [
    (r"\b(architect|refactor|design pattern|system design|monolith|microservice)\b", 30),
    (r"\b(debug|stacktrace|traceback|memory leak|deadlock|race condition|segfault)\b", 25),
    (r"\b(write a (full|complete|production|robust) (script|program|application|class|module))\b", 28),
    (r"\b(multi-file|across files|dependency tree|pipeline|migration|concurrency)\b", 25),
    (r"\b(step[- ]by[- ]step (plan|architecture|execution|breakdown|guide))\b", 22),
    (r"\b(compare and contrast|deep dive|comprehensive analysis|pros and cons of)\b", 20),
    (r"\b(dockerfile|kubernetes|terraform|ci/cd|github actions|aws|gcp|azure)\b", 20),
    (r"\b(optimize (performance|algorithm|time complexity|space complexity|gpu|shader))\b", 24),
    (r"```[\s\S]{120,}```", 30),       # Large embedded code snippet
    (r"(\.tsx?|\.py|\.rs|\.cpp|\.java|\.json|\.go|\.sql)\b", 15), # Code file extensions mentioned
]

# Indicators for lightweight / basic local tasks
SIMPLE_PATTERNS = [
    (r"^(hi|hello|hey|good (morning|afternoon|evening)|howdy|greetings|jarvis|orbit)\b", -35),
    (r"\b(what('s| is) (your name|orbit|jarvis|the time|today's date))\b", -35),
    (r"\b(thank(s| you)|bye|goodbye|see you|good job)\b", -35),
    (r"^\s*(what is|calculate|evaluate)\s+\d+[\s\+\-\*\/\^\%]+\d+\s*\??$", -30), # Basic math
    (r"\b(summarize (this in one sentence|briefly|in 3 bullet points))\b", -15),
    (r"\b(rephrase|rewrite (this|sentence|paragraph)|check my grammar|fix typos)\b", -20),
    (r"\b(define|meaning of|what does .* mean)\b", -25),
]

def score_query_complexity(prompt: str) -> Tuple[int, List[str]]:
    """
    Evaluates multi-dimensional complexity of a user query.
    Returns:
        (score: int [0-100], reasons: List[str])
    """
    text = prompt.strip()
    score = 25  # Neutral baseline
    reasons: List[str] = []

    # 1. Prompt Length Factor
    char_len = len(text)
    if char_len < 60:
        score -= 15
        reasons.append("Concise input (<60 chars)")
    elif char_len > 1800:
        score += 35
        reasons.append("Very large context (>1800 chars)")
    elif char_len > 700:
        score += 20
        reasons.append("Extended prompt context (>700 chars)")

    # 2. Match Simple / Everyday Patterns
    text_lower = text.lower()
    for pattern, weight in SIMPLE_PATTERNS:
        if re.search(pattern, text_lower):
            score += weight
            reasons.append(f"Lightweight conversational intent ({weight})")
            break

    # 3. Match Complex / Technical Patterns
    for pattern, weight in COMPLEX_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            score += weight
            reasons.append(f"Technical reasoning trigger ({weight})")

    # 4. Multiline and Code Structure
    lines = text.splitlines()
    if len(lines) > 12:
        score += 15
        reasons.append("Multi-line structured payload")

    # Clamp to [0, 100]
    final_score = max(0, min(100, score))
    return final_score, reasons


# ─── Provider Health and Model Discovery ───────────────────────────────────

def get_ollama_models(host: Optional[str] = None) -> Dict[str, Any]:
    """Dynamically query Ollama for installed models and connection health."""
    cfg = load_router_config()
    ollama_url = host or cfg.get("ollama_host", "http://localhost:11434")

    req = urllib.request.Request(
        f"{ollama_url}/api/tags",
        headers={"Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = [m.get("name") for m in data.get("models", []) if m.get("name")]
            return {
                "available": True,
                "host": ollama_url,
                "models": models,
                "count": len(models),
                "error": None
            }
    except Exception as e:
        return {
            "available": False,
            "host": ollama_url,
            "models": [],
            "count": 0,
            "error": str(e)
        }

def check_nvidia_health(api_key: Optional[str] = None) -> Dict[str, Any]:
    """Verify NVIDIA API key configuration and reachability."""
    cfg = load_router_config()
    key = api_key or cfg.get("nvidia_api_key") or os.environ.get("NVIDIA_API_KEY", "")
    has_key = bool(key and key.strip())

    return {
        "available": has_key,
        "configured": has_key,
        "preferred_model": cfg.get("preferred_nvidia_model", "nvidia/nemotron-3-ultra-550b-a55b"),
        "error": None if has_key else "NVIDIA_API_KEY is not configured"
    }

def get_system_telemetry() -> Dict[str, Any]:
    """Detect local CPU, RAM, and GPU capabilities if detectable."""
    info: Dict[str, Any] = {
        "platform": sys.platform,
        "cpu_count": os.cpu_count() or 1,
        "gpu_available": False,
        "gpu_name": "Integrated / CPU fallback",
        "vram_gb": 0.0,
    }

    # Fast GPU detection via nvidia-smi (instant vs 8-second torch load)
    try:
        import subprocess
        proc = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=1.5
        )
        if proc.returncode == 0 and proc.stdout.strip():
            line = proc.stdout.strip().splitlines()[0]
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 1:
                info["gpu_available"] = True
                info["gpu_name"] = parts[0]
            if len(parts) >= 2:
                try:
                    info["vram_gb"] = round(float(parts[1]) / 1024, 1)
                except Exception:
                    pass
    except Exception:
        pass

    return info


# ─── Inference Implementations ──────────────────────────────────────────────

def call_ollama_chat(
    prompt: str,
    system_prompt: str,
    model: str,
    host: str,
    timeout: int = 60
) -> Dict[str, Any]:
    """Execute local inference against Ollama."""
    t0 = time.time()
    url = f"{host}/api/chat"
    payload = {
        "model": model,
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

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            elapsed = int((time.time() - t0) * 1000)
            content = data.get("message", {}).get("content", "")
            return {
                "ok": True,
                "content": content,
                "provider": "local",
                "model": f"{model} (Ollama)",
                "duration_ms": elapsed,
                "tokens": {
                    "prompt": data.get("prompt_eval_count", 0),
                    "completion": data.get("eval_count", 0),
                    "total": (data.get("prompt_eval_count", 0) + data.get("eval_count", 0))
                },
                "error": None
            }
    except Exception as e:
        elapsed = int((time.time() - t0) * 1000)
        return {
            "ok": False,
            "content": "",
            "provider": "local",
            "model": model,
            "duration_ms": elapsed,
            "tokens": {"prompt": 0, "completion": 0, "total": 0},
            "error": f"Ollama execution error: {e}"
        }

def call_nvidia_chat(
    prompt: str,
    system_prompt: str,
    model: str,
    api_key: str,
    api_url: str,
    timeout: int = 90,
    max_retries: int = 2
) -> Dict[str, Any]:
    """Execute cloud inference against NVIDIA API with automatic retry."""
    t0 = time.time()
    if not api_key:
        return {
            "ok": False,
            "content": "",
            "provider": "nvidia",
            "model": model,
            "duration_ms": 0,
            "tokens": {"prompt": 0, "completion": 0, "total": 0},
            "error": "NVIDIA_API_KEY is not set. Add your key in Settings or environment."
        }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 2048
    }

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    last_err = ""
    for attempt in range(max_retries + 1):
        try:
            req = urllib.request.Request(
                api_url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                elapsed = int((time.time() - t0) * 1000)

                choice = data.get("choices", [{}])[0]
                msg = choice.get("message", {})
                content = msg.get("content") or msg.get("reasoning_content") or ""
                usage = data.get("usage", {})

                returned_model = data.get("model") or model
                return {
                    "ok": True,
                    "content": content,
                    "provider": "nvidia",
                    "model": returned_model,
                    "duration_ms": elapsed,
                    "tokens": {
                        "prompt": usage.get("prompt_tokens", 0),
                        "completion": usage.get("completion_tokens", 0),
                        "total": usage.get("total_tokens", 0)
                    },
                    "error": None
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            last_err = f"HTTP {e.code}: {err_body}"
            # Retry on rate-limit 429 or server errors 500/503
            if e.code in (429, 500, 502, 503, 504) and attempt < max_retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            break
        except Exception as e:
            last_err = str(e)
            if attempt < max_retries:
                time.sleep(1.0)
                continue
            break

    elapsed = int((time.time() - t0) * 1000)
    return {
        "ok": False,
        "content": "",
        "provider": "nvidia",
        "model": model,
        "duration_ms": elapsed,
        "tokens": {"prompt": 0, "completion": 0, "total": 0},
        "error": f"NVIDIA Cloud API failed: {last_err}"
    }


# ─── Custom Local Model Hook ────────────────────────────────────────────────

def call_custom_local_model(prompt: str, system_prompt: str, script_path: str) -> Optional[Dict[str, Any]]:
    """
    Hook to invoke the user's custom local LLM implementation.
    If custom_local_model.py exists in the project or configured path, imports and calls it.
    """
    target_path = script_path or os.path.join(os.path.dirname(os.path.abspath(__file__)), "custom_local_model.py")
    if not os.path.exists(target_path):
        return None

    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("custom_local_model", target_path)
        if not spec or not spec.loader:
            return None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        if hasattr(mod, "generate_response"):
            t0 = time.time()
            res = mod.generate_response(prompt=prompt, system_prompt=system_prompt)
            elapsed = int((time.time() - t0) * 1000)
            return {
                "ok": True,
                "content": str(res),
                "provider": "local",
                "model": "Custom Local Model",
                "duration_ms": elapsed,
                "tokens": {"prompt": len(prompt) // 4, "completion": len(str(res)) // 4, "total": 0},
                "error": None
            }
    except Exception as e:
        print(f"[ORBIT Router] Custom local model error: {e}")

    return None


# ─── Master Hybrid Routing Dispatcher ───────────────────────────────────────

class HybridAIRouter:
    def __init__(self):
        self.config = load_router_config()
        CONVERSATION_DIR.mkdir(parents=True, exist_ok=True)

    def reload(self):
        self.config = load_router_config()

    def route_and_execute(
        self,
        prompt: str,
        system_prompt: str,
        requested_mode: Optional[str] = None,
        requested_provider: Optional[str] = None,
        role: str = "general"
    ) -> Dict[str, Any]:
        """
        Primary entrypoint: classifies the task, selects optimal provider,
        executes inference, handles fallbacks (if permitted), and returns unified response.
        """
        self.reload()
        mode = (requested_mode or self.config.get("routing_mode", "auto")).lower()
        threshold = int(self.config.get("complexity_threshold", 45))
        score, reasons = score_query_complexity(prompt)

        # Determine target provider based on mode & classification
        target_provider = "local"
        decision_reason = ""

        if mode == "local_only":
            target_provider = "local"
            decision_reason = "User configured LOCAL ONLY mode. Cloud inference strictly bypassed."
        elif mode == "cloud_only":
            target_provider = "nvidia"
            decision_reason = "User configured CLOUD ONLY mode. Dispatched to NVIDIA Cloud."
        elif mode == "manual":
            target_provider = requested_provider or "local"
            decision_reason = f"User manually specified {target_provider.upper()} provider."
        else: # AUTO MODE
            if score > threshold:
                target_provider = "nvidia"
                decision_reason = f"Complex request (Score {score}/100 > {threshold}). Dispatched to NVIDIA Cloud for advanced reasoning."
            else:
                target_provider = "local"
                decision_reason = f"Everyday request (Score {score}/100 <= {threshold}). Kept on local device for low-latency privacy."

        # Execute primary provider
        result = self._execute_provider(target_provider, prompt, system_prompt, role=role)

        # Handle fallback if primary failed AND allowed by policy
        if not result["ok"] and mode != "local_only" and self.config.get("fallback_enabled", True):
            alt_provider = "nvidia" if target_provider == "local" else "local"
            print(f"[ORBIT Router] {target_provider} failed ({result['error']}). Attempting graceful fallback to {alt_provider}...")
            fallback_res = self._execute_provider(alt_provider, prompt, system_prompt, role=role)
            if fallback_res["ok"]:
                fallback_res["routing_info"] = {
                    "mode": mode,
                    "complexity_score": score,
                    "reasons": reasons,
                    "decision": f"{decision_reason} (Fell back to {alt_provider.upper()} due to: {result['error']})",
                    "fallback_triggered": True
                }
                self._save_conversation_turn(prompt, fallback_res["content"], fallback_res["provider"], fallback_res["model"])
                return fallback_res

        result["routing_info"] = {
            "mode": mode,
            "complexity_score": score,
            "reasons": reasons,
            "decision": decision_reason,
            "fallback_triggered": False
        }

        # Persist conversation if successful
        if result["ok"]:
            self._save_conversation_turn(prompt, result["content"], result["provider"], result["model"])

        return result

    def _execute_provider(self, provider: str, prompt: str, system_prompt: str, role: str = "general") -> Dict[str, Any]:
        """Execute inference against a specific provider with model governor."""
        if provider == "local":
            from orbit_core.model_manager import model_manager
            target_model, _, is_installed = model_manager.resolve_model_for_role(role)

            # Check for user's custom local model script first if explicitly configured
            if self.config.get("preferred_local_provider") == "custom_local":
                custom_res = call_custom_local_model(
                    prompt,
                    system_prompt,
                    self.config.get("custom_model_script", "")
                )
                if custom_res and custom_res["ok"]:
                    return custom_res

            # Enforce single-large-model VRAM governor
            model_manager.ensure_single_active_large_model(target_model)

            host = self.config.get("ollama_host", "http://localhost:11434")
            timeout = int(self.config.get("local_timeout_sec", 60))
            res = call_ollama_chat(prompt, system_prompt, target_model, host, timeout)
            
            # If Ollama request failed (e.g. model still downloading or offline)
            if not res["ok"]:
                # Try custom local model fallback
                custom_res = call_custom_local_model(prompt, system_prompt, self.config.get("custom_model_script", ""))
                if custom_res and custom_res["ok"]:
                    return custom_res

                # Informative status rather than crash
                res["content"] = f"ORBIT Local Intelligence ({target_model}) is preparing/downloading to D:\\ORBIT\\Models. {res.get('error', '')}"

            return res

        else: # NVIDIA
            model = self.config.get("preferred_nvidia_model", "nvidia/nemotron-3-ultra-550b-a55b")
            api_key = self.config.get("nvidia_api_key") or os.environ.get("NVIDIA_API_KEY", "")
            api_url = self.config.get("nvidia_api_url", "https://integrate.api.nvidia.com/v1/chat/completions")
            timeout = int(self.config.get("cloud_timeout_sec", 90))
            max_retries = int(self.config.get("max_retries", 2))
            return call_nvidia_chat(prompt, system_prompt, model, api_key, api_url, timeout, max_retries)

    def _save_conversation_turn(self, user_msg: str, bot_msg: str, provider: str, model: str):
        """Append to persistent JSON-lines conversation log."""
        try:
            today_file = CONVERSATION_DIR / f"session_{time.strftime('%Y%m%d')}.jsonl"
            record = {
                "timestamp": time.time(),
                "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "user": user_msg,
                "orbit": bot_msg,
                "provider": provider,
                "model": model,
            }
            with open(today_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
        except Exception as e:
            print(f"[ORBIT Router] Warning saving conversation history: {e}")

    def get_conversation_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent persistent conversation turns."""
        history: List[Dict[str, Any]] = []
        try:
            files = sorted(CONVERSATION_DIR.glob("session_*.jsonl"), reverse=True)
            for fpath in files:
                with open(fpath, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                history.append(json.loads(line))
                            except Exception:
                                pass
                if len(history) >= limit:
                    break
        except Exception as e:
            print(f"[ORBIT Router] Warning reading conversation history: {e}")

        return history[-limit:]


# Global Singleton Instance
ai_router = HybridAIRouter()
router = ai_router
route_and_execute = ai_router.route_and_execute
get_conversation_history = ai_router.get_conversation_history

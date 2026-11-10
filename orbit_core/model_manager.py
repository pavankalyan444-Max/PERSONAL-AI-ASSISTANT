#!/usr/bin/env python3
"""
ORBIT — Intelligent Model Manager & Hardware Resource Governor
==============================================================
Manages local Ollama model lifecycle and NVIDIA cloud tier:
1. Target Models:
   - General Assistant & Planner: qwen3.5:4b
   - Code Engineer & Debugger:   qwen2.5-coder:7b
   - Vector Embedding Engine:     bge-m3
   - Cloud Heavyweight Tier:      nvidia/nemotron-3-ultra-550b-a55b (Nemotron 3 Ultra 550B-A55B)
2. Storage Location:
   - D:\\ORBIT\\Models
3. Hardware Governance (NVIDIA RTX 5070 - 8 GB VRAM):
   - Single-active-model memory management (unloads previous model via keep_alive: 0)
   - Dynamic discovery via Ollama /api/tags & /api/ps
   - Real-time VRAM, GPU util, CPU, RAM, and D: drive storage telemetry
"""

import os
import sys
import json
import time
import shutil
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

OLLAMA_MODELS_PATH = Path(r"D:\ORBIT\Models")
DEFAULT_OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

# Defined Model Roles
TARGET_MODELS = {
    "general": {
        "tag": "qwen3.5:4b",
        "aliases": ["qwen3.5:4b", "qwen3.5", "qwen2.5:3b", "qwen2.5:7b", "llama3.1:8b"],
        "name": "Qwen 3.5 4B",
        "role": "General Assistant, Planning & Task Classification",
        "context_window": 32768,
        "vram_estimate_gb": 3.8
    },
    "coding": {
        "tag": "qwen2.5-coder:7b",
        "aliases": ["qwen2.5-coder:7b", "qwen2.5-coder", "qwen-coder:7b", "codellama"],
        "name": "Qwen 2.5 Coder 7B",
        "role": "Software Architecture, Coding & Debugging",
        "context_window": 32768,
        "vram_estimate_gb": 5.6
    },
    "embeddings": {
        "tag": "bge-m3",
        "aliases": ["bge-m3", "bge", "nomic-embed-text"],
        "name": "BGE-M3",
        "role": "Memory Embeddings & Semantic Search",
        "context_window": 8192,
        "vram_estimate_gb": 1.5
    },
    "cloud": {
        "tag": "nvidia/nemotron-3-ultra-550b-a55b",
        "name": "NVIDIA Nemotron 3 Ultra 550B-A55B",
        "role": "Advanced Cloud Reasoning & Complex Problem Solving",
        "context_window": 131072,
        "vram_estimate_gb": 0.0
    }
}

class ModelManager:
    def __init__(self, ollama_host: str = DEFAULT_OLLAMA_HOST):
        self.host = ollama_host.rstrip("/")
        self._telemetry_cache = None
        self._telemetry_time = 0

    # ─── 1. Model Discovery & Catalog ──────────────────────────────────────────

    def query_ollama_tags(self) -> Tuple[bool, List[str], Optional[str]]:
        """Query Ollama API for installed models."""
        try:
            req = urllib.request.Request(
                f"{self.host}/api/tags",
                headers={"Accept": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                return True, models, None
        except Exception as e:
            return False, [], str(e)

    def query_active_loaded_models(self) -> List[str]:
        """Query Ollama /api/ps to see which models are loaded in VRAM right now."""
        try:
            req = urllib.request.Request(f"{self.host}/api/ps")
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return [m.get("name") for m in data.get("models", []) if m.get("name")]
        except Exception:
            return []

    def get_model_status_catalog(self) -> Dict[str, Any]:
        """
        Inspect all target models against Ollama's active manifest.
        Returns detailed status of each role.
        """
        ollama_online, installed_tags, err = self.query_ollama_tags()
        loaded_in_vram = self.query_active_loaded_models() if ollama_online else []

        catalog = {}
        for role_key, spec in TARGET_MODELS.items():
            if role_key == "cloud":
                from ai_router import check_nvidia_health
                nv = check_nvidia_health()
                catalog[role_key] = {
                    "tag": spec["tag"],
                    "name": spec["name"],
                    "role": spec["role"],
                    "installed": nv.get("configured", False),
                    "status": "ready" if nv.get("configured") else "missing_key",
                    "loaded_in_vram": False,
                    "provider": "nvidia",
                    "vram_gb": 0.0,
                    "storage_path": "Cloud API"
                }
                continue

            # Local Ollama model checks
            target_tag = spec["tag"]
            is_installed = False
            resolved_tag = None

            # Fuzzy match aliases
            for alias in spec["aliases"]:
                for inst in installed_tags:
                    if alias.lower() in inst.lower() or inst.lower() in alias.lower():
                        is_installed = True
                        resolved_tag = inst
                        break
                if is_installed:
                    break

            is_loaded = any(resolved_tag and (resolved_tag in loaded or loaded in resolved_tag) for loaded in loaded_in_vram)

            catalog[role_key] = {
                "tag": target_tag,
                "resolved_tag": resolved_tag,
                "name": spec["name"],
                "role": spec["role"],
                "installed": is_installed,
                "status": "ready" if is_installed else ("awaiting_download" if ollama_online else "ollama_offline"),
                "loaded_in_vram": is_loaded,
                "provider": "ollama",
                "vram_gb": spec["vram_estimate_gb"],
                "storage_path": str(OLLAMA_MODELS_PATH)
            }

        return {
            "ollama_online": ollama_online,
            "ollama_host": self.host,
            "ollama_error": err,
            "installed_models_count": len(installed_tags),
            "installed_models": installed_tags,
            "loaded_in_vram": loaded_in_vram,
            "catalog": catalog,
            "storage_drive": self.get_storage_drive_status()
        }

    # ─── 2. Storage Directory Telemetry ───────────────────────────────────────

    def get_storage_drive_status(self) -> Dict[str, Any]:
        """Inspect D:\\ORBIT\\Models storage health and free space."""
        d_path = Path("D:\\")
        status = {
            "configured_path": str(OLLAMA_MODELS_PATH),
            "exists": OLLAMA_MODELS_PATH.exists(),
            "drive": "D:",
            "total_gb": 0.0,
            "free_gb": 0.0,
            "used_gb": 0.0,
            "used_percent": 0.0
        }
        try:
            usage = shutil.disk_usage(str(d_path))
            status["total_gb"] = round(usage.total / (1024**3), 1)
            status["free_gb"] = round(usage.free / (1024**3), 1)
            status["used_gb"] = round(usage.used / (1024**3), 1)
            status["used_percent"] = round((usage.used / usage.total) * 100, 1)
        except Exception:
            pass
        return status

    # ─── 3. Single-Active-Model VRAM Management ──────────────────────────────

    def unload_model(self, model_tag: str) -> bool:
        """Immediately unload a model from GPU VRAM via Ollama keep_alive: 0."""
        try:
            req_data = json.dumps({"model": model_tag, "keep_alive": 0}).encode("utf-8")
            req = urllib.request.Request(
                f"{self.host}/api/generate",
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                return resp.status == 200
        except Exception as e:
            print(f"[ModelManager] Warning unloading '{model_tag}': {e}")
            return False

    def ensure_single_active_large_model(self, target_model: str):
        """
        RTX 5070 8GB VRAM Governor:
        If switching models (e.g. from qwen2.5-coder:7b to qwen3.5:4b),
        unload existing large models to ensure zero out-of-memory or CPU spilling.
        """
        loaded = self.query_active_loaded_models()
        for active in loaded:
            # Don't unload the model we are about to use or lightweight embeddings
            if target_model.lower() not in active.lower() and "embed" not in active.lower() and "bge" not in active.lower():
                print(f"[ModelManager Governor] Unloading non-target model '{active}' to free VRAM for '{target_model}'")
                self.unload_model(active)

    # ─── 4. Role Resolver ─────────────────────────────────────────────────────

    def resolve_model_for_role(self, role: str) -> Tuple[str, str, bool]:
        """
        Returns (model_tag, provider, is_installed) for given role:
        'general', 'coding', 'embeddings', or 'cloud'.
        """
        role_lower = role.lower()
        if role_lower == "cloud":
            return TARGET_MODELS["cloud"]["tag"], "nvidia", True

        status = self.get_model_status_catalog()
        cat = status.get("catalog", {}).get(role_lower)
        if cat and cat.get("installed") and cat.get("resolved_tag"):
            return cat["resolved_tag"], "ollama", True

        # If designated model not yet finished downloading:
        # Fall back to any installed local model
        installed = status.get("installed_models", [])
        if installed:
            # If coding requested, try to find another model with 'code'
            if role_lower == "coding":
                for inst in installed:
                    if "code" in inst.lower():
                        return inst, "ollama", True
            return installed[0], "ollama", True

        # Fallback target tag
        target_tag = TARGET_MODELS.get(role_lower, {}).get("tag", "qwen3.5:4b")
        return target_tag, "ollama", False

    # ─── 5. Embeddings via BGE-M3 ─────────────────────────────────────────────

    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate 1024-dim vector embedding using BGE-M3 in Ollama."""
        model_tag, provider, installed = self.resolve_model_for_role("embeddings")
        if not installed:
            return None

        try:
            req_data = json.dumps({"model": model_tag, "prompt": text}).encode("utf-8")
            req = urllib.request.Request(
                f"{self.host}/api/embeddings",
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("embedding")
        except Exception as e:
            print(f"[ModelManager] Embedding generation error: {e}")
            return None

    # ─── 6. Live Hardware Telemetry (GPU, VRAM, CPU, RAM, Disk) ───────────────

    def get_full_telemetry(self) -> Dict[str, Any]:
        """Cached 2s telemetry for GPU, VRAM, CPU, RAM, and Storage."""
        now = time.time()
        if self._telemetry_cache and (now - self._telemetry_time) < 2.0:
            return self._telemetry_cache

        info = {
            "gpu_name": "NVIDIA GeForce RTX 5070 Laptop GPU",
            "gpu_available": False,
            "vram_total_mb": 8151,
            "vram_used_mb": 0,
            "vram_free_mb": 8151,
            "vram_percent": 0.0,
            "gpu_util_percent": 0,
            "gpu_temp_c": 50,
            "cpu_percent": 0.0,
            "ram_total_gb": 32.0,
            "ram_used_gb": 0.0,
            "ram_percent": 0.0,
            "d_drive": self.get_storage_drive_status()
        }

        # Query nvidia-smi
        try:
            import subprocess
            proc = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=2.5
            )
            if proc.returncode == 0 and proc.stdout.strip():
                parts = [p.strip() for p in proc.stdout.strip().splitlines()[0].split(",")]
                if len(parts) >= 6:
                    info["gpu_available"] = True
                    info["gpu_name"] = parts[0]
                    tot = float(parts[1])
                    used = float(parts[2])
                    free = float(parts[3])
                    info["vram_total_mb"] = tot
                    info["vram_used_mb"] = used
                    info["vram_free_mb"] = free
                    info["vram_percent"] = round((used / tot) * 100, 1) if tot > 0 else 0.0
                    info["gpu_util_percent"] = int(parts[4])
                    info["gpu_temp_c"] = int(parts[5])
        except Exception:
            pass

        # Query psutil for CPU and RAM
        try:
            import psutil
            info["cpu_percent"] = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory()
            info["ram_total_gb"] = round(mem.total / (1024**3), 1)
            info["ram_used_gb"] = round(mem.used / (1024**3), 1)
            info["ram_percent"] = mem.percent
        except Exception:
            pass

        self._telemetry_cache = info
        self._telemetry_time = now
        return info

# Global Singleton
model_manager = ModelManager()

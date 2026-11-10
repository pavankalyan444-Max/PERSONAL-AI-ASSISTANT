#!/usr/bin/env python3
"""
ORBIT — Executor Agent (Deterministic PC Automation Service)
============================================================
Executes deterministic PC operations with security boundaries & approval gates:
1. File operations (create, read, write, append, list)
2. Directory management (create folder, organize)
3. Application launching (Windows os.startfile / subprocess)
4. Safe command execution with timeout & output capture
5. Destructive action protection (requires explicit confirmation flag)
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

class ExecutorAgent:
    name = "Executor"
    role = "Deterministic PC Operations & Tool Execution"

    # Known safe executables to launch
    SAFE_APPS = {
        "notepad": "notepad.exe",
        "calculator": "calc.exe",
        "calc": "calc.exe",
        "explorer": "explorer.exe",
        "code": "code",
        "terminal": "wt.exe",
        "cmd": "cmd.exe",
        "powershell": "powershell.exe",
        "edge": "msedge.exe",
        "browser": "msedge.exe"
    }

    # Commands / patterns that require explicit user approval
    DESTRUCTIVE_PATTERNS = ["rmdir", "del /f", "format", "drop", "truncate", "rm -rf", "taskkill /f /im system"]

    def __init__(self, workspace_root: Optional[str] = None):
        self.workspace_root = Path(workspace_root or os.getcwd()).resolve()

    def launch_app(self, app_name: str) -> Dict[str, Any]:
        """Launch a Windows application safely."""
        app_lower = app_name.lower().strip()
        exe = self.SAFE_APPS.get(app_lower, app_name)
        
        try:
            if sys.platform == "win32":
                # If path exists on disk, open with default handler
                if os.path.exists(exe):
                    os.startfile(exe)
                    return {"ok": True, "message": f"Opened '{exe}' via Windows file association."}
                else:
                    subprocess.Popen(exe, shell=True)
                    return {"ok": True, "message": f"Launched '{exe}' successfully."}
            else:
                subprocess.Popen([exe])
                return {"ok": True, "message": f"Launched '{exe}'."}
        except Exception as e:
            return {"ok": False, "error": f"Failed to launch '{app_name}': {str(e)}"}

    def open_file_or_dir(self, target_path: str) -> Dict[str, Any]:
        """Open a file or folder in native Windows Explorer/editor."""
        p = Path(target_path).resolve()
        if not p.exists():
            return {"ok": False, "error": f"Path '{target_path}' does not exist on disk."}

        try:
            if sys.platform == "win32":
                os.startfile(str(p))
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(p)])
            else:
                subprocess.Popen(["xdg-open", str(p)])
            return {"ok": True, "opened": str(p)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def create_directory(self, target_path: str) -> Dict[str, Any]:
        """Create a new folder."""
        try:
            p = Path(target_path).resolve()
            p.mkdir(parents=True, exist_ok=True)
            return {"ok": True, "created": str(p), "message": f"Folder '{p.name}' created successfully."}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def write_file(self, file_path: str, content: str, overwrite: bool = False) -> Dict[str, Any]:
        """Create or update a text/code file."""
        try:
            p = Path(file_path).resolve()
            if p.exists() and not overwrite:
                return {
                    "ok": False,
                    "requires_approval": True,
                    "error": f"File '{p.name}' already exists. Overwrite confirmation required."
                }
            
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                f.write(content)
            
            return {
                "ok": True,
                "path": str(p),
                "bytes_written": len(content.encode("utf-8")),
                "message": f"Successfully wrote {len(content)} characters to '{p.name}'."
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def read_file(self, file_path: str, max_lines: int = 500) -> Dict[str, Any]:
        """Read content of a file."""
        try:
            p = Path(file_path).resolve()
            if not p.exists():
                return {"ok": False, "error": f"File '{file_path}' not found."}
            if not p.is_file():
                return {"ok": False, "error": f"Path '{file_path}' is a directory, not a file."}
            
            with open(p, "r", encoding="utf-8", errors="replace") as f:
                lines = [f.readline() for _ in range(max_lines)]
                content = "".join(lines)
            
            return {"ok": True, "path": str(p), "content": content, "lines_read": len(lines)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def list_directory(self, dir_path: Optional[str] = None, max_items: int = 50) -> Dict[str, Any]:
        """List files and folders in directory."""
        try:
            p = Path(dir_path or self.workspace_root).resolve()
            if not p.exists():
                return {"ok": False, "error": f"Directory '{dir_path}' not found."}
            
            items = []
            for item in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                items.append({
                    "name": item.name,
                    "is_dir": item.is_dir(),
                    "size": item.stat().st_size if item.is_file() else None,
                    "ext": item.suffix.lower() if item.is_file() else None
                })
                if len(items) >= max_items:
                    break
            
            return {"ok": True, "directory": str(p), "items": items, "total": len(items)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def run_safe_command(self, cmd_line: str, confirmed_destructive: bool = False) -> Dict[str, Any]:
        """Execute terminal command with safety verification."""
        cmd_lower = cmd_line.lower()
        
        # Security check for destructive commands
        for pattern in self.DESTRUCTIVE_PATTERNS:
            if pattern in cmd_lower and not confirmed_destructive:
                return {
                    "ok": False,
                    "requires_approval": True,
                    "reason": f"Command contains potentially destructive operation: '{pattern}'. Explicit user confirmation required."
                }
        
        try:
            res = subprocess.run(
                cmd_line,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(self.workspace_root)
            )
            return {
                "ok": res.returncode == 0,
                "exit_code": res.returncode,
                "stdout": res.stdout.strip()[:4000],
                "stderr": res.stderr.strip()[:2000]
            }
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": "Command timed out after 30 seconds."}
        except Exception as e:
            return {"ok": False, "error": str(e)}

executor_agent = ExecutorAgent()

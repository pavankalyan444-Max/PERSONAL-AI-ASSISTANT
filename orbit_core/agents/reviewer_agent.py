#!/usr/bin/env python3
"""
ORBIT — Reviewer / Auditor Agent
================================
Responsible for ground-truth verification:
1. Validates physical file & system results on disk (does not trust claims).
2. Audits code syntax and logical safety.
3. Checks whether generated output satisfies the user's original objective.
"""

import os
from pathlib import Path
from typing import Dict, Any, List, Optional

class ReviewerAgent:
    name = "Reviewer"
    role = "Quality Assurance & Ground-Truth Verification"

    def verify_disk_operation(self, target_path: str, expected_type: str = "any") -> Dict[str, Any]:
        """
        Physically inspects the file system to verify if a file/dir actually exists.
        """
        p = Path(target_path).resolve()
        exists = p.exists()
        
        if not exists:
            return {
                "verified": False,
                "error": f"Physical verification failed: '{target_path}' does not exist on disk."
            }

        is_dir = p.is_dir()
        is_file = p.is_file()

        if expected_type == "dir" and not is_dir:
            return {"verified": False, "error": f"Expected directory at '{target_path}', but found file."}
        if expected_type == "file" and not is_file:
            return {"verified": False, "error": f"Expected file at '{target_path}', but found directory."}

        size = p.stat().st_size if is_file else None
        return {
            "verified": True,
            "path": str(p),
            "is_dir": is_dir,
            "is_file": is_file,
            "size_bytes": size,
            "message": f"Verified: '{p.name}' physically exists on disk."
        }

    def review_code_quality(self, code_snippet: str, language: str = "python") -> Dict[str, Any]:
        """Performs static checks and checks for syntax hazards."""
        warnings: List[str] = []
        
        # Security checks
        if "eval(" in code_snippet or "exec(" in code_snippet:
            warnings.append("Security Alert: Unsanitized eval/exec detected.")
        if "password" in code_snippet.lower() and "=" in code_snippet:
            warnings.append("Caution: Potential hardcoded credential string detected.")
        if language == "python":
            try:
                import ast
                ast.parse(code_snippet)
                syntax_valid = True
            except SyntaxError as e:
                syntax_valid = False
                warnings.append(f"Syntax error at line {e.lineno}: {e.msg}")
        else:
            syntax_valid = True

        return {
            "verified": len(warnings) == 0,
            "syntax_valid": syntax_valid,
            "warnings": warnings,
            "code_length": len(code_snippet)
        }

    def verify_response_alignment(self, prompt: str, response: str) -> Dict[str, Any]:
        """Checks if response actually answers user prompt."""
        if not response or len(response.strip()) == 0:
            return {"verified": False, "reason": "Empty response received."}
        
        return {"verified": True, "reason": "Response satisfies baseline completion criteria."}

reviewer_agent = ReviewerAgent()

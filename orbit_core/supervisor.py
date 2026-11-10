#!/usr/bin/env python3
"""
ORBIT — Supervisor Controller & Multi-Agent Orchestrator
=======================================================
Implements the master intelligence workflow:
USER INPUT → PRE-PROCESSING → SUPERVISOR → TASK CLASSIFICATION → MODEL ROUTING
  → AGENT ORCHESTRATION (Planner/Researcher/Coder/Executor/Reviewer)
  → GROUND-TRUTH VERIFICATION → RESPONSE → MEMORY PERSISTENCE
"""

import os
import sys
import time
import json
import uuid
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# Import router & memory store
import ai_router
from orbit_core.memory_store import memory_store
from orbit_core.agents.planner_agent import planner_agent
from orbit_core.agents.research_agent import research_agent
from orbit_core.agents.executor_agent import executor_agent
from orbit_core.agents.reviewer_agent import reviewer_agent

class Supervisor:
    """
    Central Controller for ORBIT Multi-Agent AI System.
    """

    SYSTEM_DIRECTIVE = """You are ORBIT, a high-performance, intelligent desktop AI operating system.
You speak with poise, precision, and efficiency.
- Deliver clear, direct, and actionable solutions.
- Never use repetitive pleasantries or filler phrases.
- When generating code, make it production-ready and modular.
- When presenting researched facts, state verified sources clearly.
- If a computer automation task was performed, report its physical ground-truth status."""

    def __init__(self):
        self.active_tasks: Dict[str, Any] = {}

    def get_agent_fleet_status(self) -> List[Dict[str, Any]]:
        """Return live status of all logical agents in the fleet."""
        recent_activities = memory_store.get_recent_activities(limit=10)
        
        agents = [
            {
                "id": "agent-supervisor",
                "number": 1,
                "name": "Supervisor",
                "role": "Central Intelligence & Model Routing",
                "status": "idle" if not self.active_tasks else "working",
                "assignment": "Monitoring cognitive pipeline & orchestrating agent delegations",
                "model": "Hybrid (Local/Cloud)",
                "tools": ["task-classification", "model-router", "context-assembler", "synthesis"],
                "progress": 1.0 if not self.active_tasks else 0.5,
                "lastActivity": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "goal": "Ensure accurate, ground-truth verified outcomes for all user directives"
            },
            {
                "id": "agent-planner",
                "number": 2,
                "name": "Planner",
                "role": "Task Decomposition & DAG Scheduling",
                "status": "idle",
                "assignment": "Standby for complex multi-step user workflows",
                "model": "Local / Cloud Reasoning",
                "tools": ["dag-planner", "dependency-solver", "resource-estimator"],
                "progress": 1.0,
                "lastActivity": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "goal": "Decompose high-complexity goals into executable DAG steps"
            },
            {
                "id": "agent-researcher",
                "number": 3,
                "name": "Researcher",
                "role": "Live Information Retrieval & Synthesis",
                "status": "idle",
                "assignment": "Ready for real-time web knowledge retrieval",
                "model": "Web Search Engine + LLM",
                "tools": ["duckduckgo-api", "source-extractor", "citation-generator"],
                "progress": 1.0,
                "lastActivity": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "goal": "Provide current, verified citations and factual briefs"
            },
            {
                "id": "agent-coder",
                "number": 4,
                "name": "Coder",
                "role": "Software Architecture & Implementation",
                "status": "idle",
                "assignment": "Code generation, refactoring, and module creation",
                "model": "Qwen-Coder / Nemotron 3 Ultra 550B",
                "tools": ["ast-builder", "syntax-checker", "code-generator"],
                "progress": 1.0,
                "lastActivity": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "goal": "Build robust, type-safe, modular code"
            },
            {
                "id": "agent-debugger",
                "number": 5,
                "name": "Debugger",
                "role": "Error Analysis & Root-Cause Resolution",
                "status": "idle",
                "assignment": "Inspecting runtime tracebacks and execution logs",
                "model": "Local / Cloud LLM",
                "tools": ["traceback-parser", "patch-generator", "log-analyzer"],
                "progress": 1.0,
                "lastActivity": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "goal": "Isolate defects and verify remediation patches"
            },
            {
                "id": "agent-reviewer",
                "number": 6,
                "name": "Reviewer / Auditor",
                "role": "Ground-Truth Verification & QA",
                "status": "idle",
                "assignment": "Verifying physical disk operations and response quality",
                "model": "Deterministic Verifier",
                "tools": ["filesystem-verifier", "code-auditor", "intent-checker"],
                "progress": 1.0,
                "lastActivity": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "goal": "Never trust unverified agent claims; verify actual results"
            },
            {
                "id": "agent-executor",
                "number": 7,
                "name": "Executor",
                "role": "Deterministic PC Automation & Tools",
                "status": "idle",
                "assignment": "Application launcher and safe file manager",
                "model": "Windows Native Service",
                "tools": ["os-launcher", "file-manager", "command-runner"],
                "progress": 1.0,
                "lastActivity": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "goal": "Execute approved operating system tasks deterministically"
            },
            {
                "id": "agent-memory",
                "number": 8,
                "name": "Memory Agent",
                "role": "Associative Recall & SQLite Persistence",
                "status": "idle",
                "assignment": "Maintaining conversation context and user preferences",
                "model": "SQLite + Keyword Matcher",
                "tools": ["sqlite-db", "associative-search", "profile-updater"],
                "progress": 1.0,
                "lastActivity": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "goal": "Preserve knowledge and relevant project context permanently"
            }
        ]

        return agents

    def process_input(
        self,
        user_input: str,
        session_id: str = "default",
        mode_override: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Master Execution Pipeline:
        1. Parse input and recall relevant memories
        2. Evaluate multi-dimensional complexity score
        3. Determine workflow: Direct Response vs Multi-Agent DAG
        4. Execute tool / agent steps if required (PC automation, web research)
        5. Ground-truth review by Reviewer Agent
        6. Synthesize response via Local LLM / NVIDIA Cloud
        7. Persist to short-term and long-term memory
        """
        t0 = time.time()
        input_text = user_input.strip()
        if not input_text:
            return {"error": "Empty input provided."}

        # ── Step 1: Memory Recall ───────────────────────────────────────────
        memory_store.log_activity("Supervisor", "info", f"Received directive: {input_text[:50]}...")
        relevant_memories = memory_store.search_long_term_memory(input_text, limit=3)
        recent_chat = memory_store.get_recent_messages(session_id, limit=6)

        memory_context = ""
        if relevant_memories:
            facts = [f"- {m['key']}: {m['content']}" for m in relevant_memories]
            memory_context = "\n[Known User Context & Preferences]:\n" + "\n".join(facts)

        # ── Step 2: Task Complexity & Routing ────────────────────────────────
        complexity_score, reasons = ai_router.score_query_complexity(input_text)
        
        # Check PC Automation Intent (Folder, File, App launch)
        input_lower = input_text.lower()
        is_pc_action = bool(re.search(r"\b(create|make|mkdir|build)\s+(a\s+)?(folder|directory|file)\b", input_lower)) or any(
            k in input_lower for k in ["open notepad", "open calc", "open calculator", "open folder", "launch app", "launch notepad", "launch calc"]
        )
        is_research = bool(re.search(r"\b(latest|current|news|who is|what happened|search web|search for|compare latest)\b", input_lower))

        # ── Step 3: Multi-Agent Delegation ──────────────────────────────────
        agent_artifacts: List[Dict[str, Any]] = []
        delegated_notes: List[str] = []

        # A. Execute PC Automation if requested
        if is_pc_action:
            memory_store.log_activity("Supervisor", "info", "Delegating PC action to Executor Agent")
            exec_res = self._handle_pc_action(input_text)
            delegated_notes.append(f"[Executor Result]: {exec_res.get('message') or exec_res.get('error')}")
            agent_artifacts.append({"agent": "Executor", "data": exec_res})
            
            # Reviewer Agent verifies outcome on disk
            if exec_res.get("created"):
                review = reviewer_agent.verify_disk_operation(exec_res["created"], expected_type="dir")
                delegated_notes.append(f"[Reviewer Audit]: {review.get('message', review.get('error'))}")
                agent_artifacts.append({"agent": "Reviewer", "data": review})
            elif exec_res.get("path"):
                review = reviewer_agent.verify_disk_operation(exec_res["path"], expected_type="file")
                delegated_notes.append(f"[Reviewer Audit]: {review.get('message', review.get('error'))}")
                agent_artifacts.append({"agent": "Reviewer", "data": review})

        # B. Execute Live Research if requested
        elif is_research:
            memory_store.log_activity("Supervisor", "info", "Delegating web research to Research Agent")
            research_res = research_agent.research_topic(input_text)
            if research_res.get("found"):
                delegated_notes.append(f"[Live Research Sources]:\n{research_res['summary']}")
                agent_artifacts.append({"agent": "Researcher", "data": research_res})

        # ── Step 4: Model Synthesis (Local Ollama vs NVIDIA Cloud) ───────────
        cfg = ai_router.load_router_config()
        routing_mode = mode_override or cfg.get("routing_mode", "auto")

        # Assemble prompt with memory and agent outputs
        full_system_prompt = self.SYSTEM_DIRECTIVE
        if memory_context:
            full_system_prompt += "\n" + memory_context
        if delegated_notes:
            full_system_prompt += "\n\n[Agent Execution Findings]:\n" + "\n\n".join(delegated_notes)

        # Classify task role: Coding (Qwen Coder) vs General Assistant/Planner (Qwen 3.5 4B)
        is_coding = bool(re.search(
            r"\b(code|coding|python|java|javascript|typescript|c\+\+|rust|html|css|sql|function|class|method|script|regex|debug|traceback|syntax|bug|refactor|compile|algorithm|git|unittest)\b",
            input_lower
        ))
        task_role = "coding" if is_coding else "general"

        # Dispatch inference through ai_router with explicit role
        dispatch_res = ai_router.route_and_execute(
            prompt=input_text,
            system_prompt=full_system_prompt,
            requested_mode=routing_mode,
            role=task_role
        )

        final_response = dispatch_res.get("content") or dispatch_res.get("response") or dispatch_res.get("error", "")
        provider = dispatch_res.get("provider", "local")
        model_used = dispatch_res.get("model", "orbit-core")
        duration_ms = int((time.time() - t0) * 1000)

        # ── Step 5: Ground-Truth Verification of LLM Output ──────────────────
        alignment = reviewer_agent.verify_response_alignment(input_text, final_response)
        if not alignment.get("verified"):
            final_response += "\n\n*(Note: Supervisor QA flagged response alignment verification)*"

        # ── Step 6: Memory Update ───────────────────────────────────────────
        memory_store.add_message(
            session_id=session_id,
            role="user",
            content=input_text
        )
        memory_store.add_message(
            session_id=session_id,
            role="assistant",
            content=final_response,
            provider=provider,
            model=model_used,
            duration_ms=duration_ms,
            metadata={"complexity_score": complexity_score, "reasons": reasons}
        )

        # Automatically extract user preference / fact if explicitly stated
        self._extract_and_learn_preference(input_text)

        memory_store.log_activity(
            "Supervisor",
            "success",
            f"Delivered response via {provider.upper()} ({duration_ms}ms)"
        )

        return {
            "response": final_response,
            "provider": provider,
            "model": model_used,
            "duration_ms": duration_ms,
            "routing_info": {
                "mode": routing_mode,
                "complexity_score": complexity_score,
                "reasons": reasons,
                "decision": dispatch_res.get("routing_info", {}).get("decision", ""),
                "fallback_triggered": dispatch_res.get("routing_info", {}).get("fallback_triggered", False)
            },
            "artifacts": agent_artifacts
        }

    def _handle_pc_action(self, prompt: str) -> Dict[str, Any]:
        """Deterministic PC action router."""
        p_lower = prompt.lower()
        desktop = Path(os.environ.get("USERPROFILE", "")) / "Desktop"

        # 1. Create folder
        m_folder = re.search(r"(?:create|make)(?: a)? folder (?:called|named)?\s*['\"]?([^'\"\n]+)['\"]?", prompt, re.IGNORECASE)
        if m_folder:
            raw_name = m_folder.group(1).strip()
            # Clean trailing location phrases like "on my desktop"
            folder_name = re.sub(r"\s+on\s+(?:my\s+)?desktop.*$", "", raw_name, flags=re.IGNORECASE).strip().strip("'\"")
            target = desktop / folder_name if "desktop" in p_lower else Path.cwd() / folder_name
            res = executor_agent.create_directory(str(target))
            return res

        # 2. Launch application
        for app in ["notepad", "calc", "calculator", "explorer", "terminal", "code", "browser", "edge"]:
            if f"open {app}" in p_lower or f"launch {app}" in p_lower:
                return executor_agent.launch_app(app)

        return {"ok": False, "error": "Could not extract specific executable PC action."}

    def _extract_and_learn_preference(self, text: str):
        """Extract explicit preference cues like 'my name is X' or 'I prefer Y'."""
        m_name = re.search(r"\bmy name is ([a-zA-Z]+)\b", text, re.IGNORECASE)
        if m_name:
            memory_store.save_long_term_memory("profile", "user_name", m_name.group(1), importance=8)

        m_pref = re.search(r"\bI prefer ([^.\n]+)", text, re.IGNORECASE)
        if m_pref:
            memory_store.save_long_term_memory("preference", "general", m_pref.group(1).strip(), importance=6)

supervisor = Supervisor()

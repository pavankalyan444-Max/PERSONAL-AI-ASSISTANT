#!/usr/bin/env python3
"""
ORBIT — Planner Agent
=====================
Decomposes complex requests into a structured Directed Acyclic Graph (DAG)
of executable tasks, with clear agent assignments and dependencies.
"""

from typing import Dict, Any, List, Optional
import uuid

class PlannerAgent:
    name = "Planner"
    role = "Task Decomposition & DAG Orchestration"

    def create_plan(self, user_goal: str, complexity_score: int) -> Dict[str, Any]:
        """
        Decompose goal into sequential or parallel steps based on intent.
        """
        plan_id = f"plan-{uuid.uuid4().hex[:8]}"
        goal_lower = user_goal.lower()

        tasks = []

        # 1. Research Intent
        if any(w in goal_lower for w in ["latest", "current", "news", "compare", "search", "who is", "what happened"]):
            tasks.append({
                "id": f"{plan_id}-t1",
                "agent": "Researcher",
                "description": f"Gather live web context and citations for: {user_goal[:60]}",
                "dependencies": [],
                "status": "pending"
            })
            tasks.append({
                "id": f"{plan_id}-t2",
                "agent": "Reviewer",
                "description": "Verify source citations and extract factual synthesis",
                "dependencies": [f"{plan_id}-t1"],
                "status": "pending"
            })
            tasks.append({
                "id": f"{plan_id}-t3",
                "agent": "Supervisor",
                "description": "Synthesize final cited response",
                "dependencies": [f"{plan_id}-t2"],
                "status": "pending"
            })

        # 2. PC Automation / File Operation Intent
        elif any(w in goal_lower for w in ["create folder", "mkdir", "write file", "open", "launch", "desktop", "delete"]):
            tasks.append({
                "id": f"{plan_id}-t1",
                "agent": "Executor",
                "description": f"Perform requested system action: {user_goal[:60]}",
                "dependencies": [],
                "status": "pending"
            })
            tasks.append({
                "id": f"{plan_id}-t2",
                "agent": "Reviewer",
                "description": "Audit physical file/folder existence and verify operation outcome",
                "dependencies": [f"{plan_id}-t1"],
                "status": "pending"
            })
            tasks.append({
                "id": f"{plan_id}-t3",
                "agent": "Supervisor",
                "description": "Deliver verified status confirmation to user",
                "dependencies": [f"{plan_id}-t2"],
                "status": "pending"
            })

        # 3. Coding / Engineering Intent
        elif any(w in goal_lower for w in ["build", "write code", "implement", "script", "app", "refactor", "bug", "fix"]):
            tasks.append({
                "id": f"{plan_id}-t1",
                "agent": "Coder",
                "description": f"Architect and generate clean implementation for: {user_goal[:60]}",
                "dependencies": [],
                "status": "pending"
            })
            tasks.append({
                "id": f"{plan_id}-t2",
                "agent": "Reviewer",
                "description": "Audit code quality, syntax soundness, and security safety",
                "dependencies": [f"{plan_id}-t1"],
                "status": "pending"
            })
            tasks.append({
                "id": f"{plan_id}-t3",
                "agent": "Supervisor",
                "description": "Format and deliver code solution with usage instructions",
                "dependencies": [f"{plan_id}-t2"],
                "status": "pending"
            })

        # 4. Standard Direct Intent (Simple Query / Conversation)
        else:
            tasks.append({
                "id": f"{plan_id}-t1",
                "agent": "Supervisor",
                "description": f"Direct reasoning response: {user_goal[:60]}",
                "dependencies": [],
                "status": "pending"
            })

        return {
            "plan_id": plan_id,
            "goal": user_goal,
            "complexity_score": complexity_score,
            "task_count": len(tasks),
            "tasks": tasks
        }

planner_agent = PlannerAgent()

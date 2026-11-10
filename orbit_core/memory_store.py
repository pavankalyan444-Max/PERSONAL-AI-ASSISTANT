#!/usr/bin/env python3
"""
ORBIT — Persistent Memory Store
================================
SQLite-backed persistent memory architecture:
1. Working Memory (active context & running task state)
2. Short-Term Memory (recent conversation history & turns)
3. Long-Term Memory (user preferences, facts, profile)
4. Project Memory (codebase structure, project notes)
5. Agent Tasks & Activity Logs (DAG task execution state)
"""

import os
import sqlite3
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

DB_PATH = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / ".orbit" / "orbit_memory.db"

class MemoryStore:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Create schema if not exists."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 1. Conversations (Short-Term Memory)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                provider TEXT,
                model TEXT,
                duration_ms INTEGER,
                metadata TEXT,
                timestamp REAL NOT NULL
            );
            """)

            # 2. Long-Term Memory (Preferences, Facts, Profile)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS long_term_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                key TEXT NOT NULL,
                content TEXT NOT NULL,
                importance INTEGER DEFAULT 5,
                embedding TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                UNIQUE(category, key)
            );
            """)

            # Upgrade existing table with embedding column if missing
            try:
                cursor.execute("ALTER TABLE long_term_memory ADD COLUMN embedding TEXT;")
            except sqlite3.OperationalError:
                pass

            # 3. Project Memory
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_name TEXT NOT NULL,
                summary TEXT NOT NULL,
                details TEXT,
                tags TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            );
            """)

            # 4. Multi-Agent Task Graph & Status
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                task_id TEXT PRIMARY KEY,
                parent_task_id TEXT,
                assigned_agent TEXT NOT NULL,
                model TEXT,
                description TEXT NOT NULL,
                status TEXT NOT NULL,
                progress REAL DEFAULT 0.0,
                input_payload TEXT,
                output_result TEXT,
                error TEXT,
                created_at REAL NOT NULL,
                finished_at REAL
            );
            """)

            # 5. Agent Activity Logs
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT,
                agent_name TEXT NOT NULL,
                activity_type TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp REAL NOT NULL
            );
            """)

            # Indexes for fast lookup
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id, timestamp);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ltm_category ON long_term_memory(category);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_time ON agent_activities(timestamp DESC);")
            
            conn.commit()

    # ─── Conversation / Short-Term Memory ─────────────────────────────────────
    
    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        duration_ms: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO conversations (session_id, role, content, provider, model, duration_ms, metadata, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session_id,
                role,
                content,
                provider,
                model,
                duration_ms,
                json.dumps(metadata or {}),
                time.time()
            ))
            conn.commit()
            return cursor.lastrowid

    def get_recent_messages(self, session_id: str = "default", limit: int = 20) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, session_id, role, content, provider, model, duration_ms, metadata, timestamp
                FROM conversations
                WHERE session_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (session_id, limit))
            rows = cursor.fetchall()
            messages = []
            for row in reversed(rows):
                messages.append({
                    "id": row["id"],
                    "session_id": row["session_id"],
                    "role": row["role"],
                    "content": row["content"],
                    "provider": row["provider"],
                    "model": row["model"],
                    "duration_ms": row["duration_ms"],
                    "metadata": json.loads(row["metadata"] or "{}"),
                    "timestamp": row["timestamp"]
                })
            return messages

    # ─── Long-Term Memory ─────────────────────────────────────────────────────

    def save_long_term_memory(
        self,
        category: str,
        key: str,
        content: str,
        importance: int = 5,
        embedding: Optional[List[float]] = None
    ) -> int:
        now = time.time()
        
        # Try generating embedding via BGE-M3 if not provided
        if embedding is None:
            try:
                from orbit_core.model_manager import model_manager
                embedding = model_manager.generate_embedding(content)
            except Exception:
                embedding = None

        emb_json = json.dumps(embedding) if embedding else None

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO long_term_memory (category, key, content, importance, embedding, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(category, key) DO UPDATE SET
                    content = excluded.content,
                    importance = excluded.importance,
                    embedding = COALESCE(excluded.embedding, long_term_memory.embedding),
                    updated_at = excluded.updated_at
            """, (category, key, content, importance, emb_json, now, now))
            conn.commit()
            return cursor.lastrowid

    def search_long_term_memory(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Hybrid Semantic + Keyword Search:
        1. Attempts vector similarity search via BGE-M3 embeddings
        2. Falls back to token keyword matching
        """
        # Try BGE-M3 Semantic Search
        try:
            from orbit_core.model_manager import model_manager
            query_vec = model_manager.generate_embedding(query)
            if query_vec:
                with self._get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        SELECT id, category, key, content, importance, embedding, created_at, updated_at
                        FROM long_term_memory
                        WHERE embedding IS NOT NULL
                    """)
                    rows = cursor.fetchall()
                    scored = []
                    for r in rows:
                        try:
                            emb = json.loads(r["embedding"])
                            # Cosine similarity
                            dot = sum(a * b for a, b in zip(query_vec, emb))
                            norm_a = sum(a * a for a in query_vec) ** 0.5
                            norm_b = sum(b * b for b in emb) ** 0.5
                            sim = dot / (norm_a * norm_b) if norm_a and norm_b else 0.0
                            scored.append((sim, dict(r)))
                        except Exception:
                            continue
                    
                    if scored:
                        scored.sort(key=lambda x: x[0], reverse=True)
                        results = [item[1] for item in scored[:limit]]
                        for res in results:
                            res.pop("embedding", None)
                        return results
        except Exception:
            pass

        # Fallback to Token Keyword matching
        tokens = [t.lower() for t in query.split() if len(t) > 2]
        if not tokens:
            return self.get_all_memories(limit=limit)
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            likes = " OR ".join(["content LIKE ? OR key LIKE ?" for _ in tokens])
            params = []
            for t in tokens:
                params.extend([f"%{t}%", f"%{t}%"])
            params.append(limit)
            
            cursor.execute(f"""
                SELECT id, category, key, content, importance, created_at, updated_at
                FROM long_term_memory
                WHERE {likes}
                ORDER BY importance DESC, updated_at DESC
                LIMIT ?
            """, params)
            return [dict(r) for r in cursor.fetchall()]

    def get_all_memories(self, category: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if category:
                cursor.execute("""
                    SELECT id, category, key, content, importance, created_at, updated_at
                    FROM long_term_memory
                    WHERE category = ?
                    ORDER BY importance DESC, updated_at DESC
                    LIMIT ?
                """, (category, limit))
            else:
                cursor.execute("""
                    SELECT id, category, key, content, importance, created_at, updated_at
                    FROM long_term_memory
                    ORDER BY importance DESC, updated_at DESC
                    LIMIT ?
                """, (limit,))
            return [dict(r) for r in cursor.fetchall()]

    def delete_memory(self, memory_id: int) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM long_term_memory WHERE id = ?", (memory_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ─── Multi-Agent Task Tracking ───────────────────────────────────────────

    def upsert_task(
        self,
        task_id: str,
        assigned_agent: str,
        description: str,
        status: str,
        parent_task_id: Optional[str] = None,
        model: Optional[str] = None,
        progress: float = 0.0,
        input_payload: Optional[Dict[str, Any]] = None,
        output_result: Optional[str] = None,
        error: Optional[str] = None
    ):
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO tasks (
                    task_id, parent_task_id, assigned_agent, model, description,
                    status, progress, input_payload, output_result, error, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(task_id) DO UPDATE SET
                    status = excluded.status,
                    progress = excluded.progress,
                    output_result = COALESCE(excluded.output_result, tasks.output_result),
                    error = COALESCE(excluded.error, tasks.error),
                    finished_at = CASE WHEN excluded.status IN ('completed', 'failed') THEN ? ELSE tasks.finished_at END
            """, (
                task_id, parent_task_id, assigned_agent, model, description,
                status, progress, json.dumps(input_payload or {}), output_result, error, now,
                now
            ))
            conn.commit()

    def get_tasks(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT task_id, parent_task_id, assigned_agent, model, description,
                       status, progress, input_payload, output_result, error, created_at, finished_at
                FROM tasks
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))
            return [dict(r) for r in cursor.fetchall()]

    def log_activity(self, agent_name: str, activity_type: str, message: str, task_id: Optional[str] = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO agent_activities (task_id, agent_name, activity_type, message, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, (task_id, agent_name, activity_type, message, time.time()))
            conn.commit()

    def get_recent_activities(self, limit: int = 40) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, task_id, agent_name, activity_type, message, timestamp
                FROM agent_activities
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            return [dict(r) for r in cursor.fetchall()]

# Global memory instance
memory_store = MemoryStore()

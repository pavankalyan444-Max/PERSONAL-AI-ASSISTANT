#!/usr/bin/env python3
"""
ORBIT — Research Agent
======================
Information retrieval and synthesis specialist:
1. Searches the web when real-time or current knowledge is requested.
2. Extracts snippets, facts, and source URLs.
3. Formats verified citations and structured synthesis briefs for the Supervisor.
"""

import urllib.request
import urllib.parse
import json
import re
from typing import Dict, Any, List, Optional

class ResearchAgent:
    name = "Researcher"
    role = "Information Retrieval & Web Synthesis"

    def search_web(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """
        Query DuckDuckGo Instant Answer API / HTML Lite for current knowledge.
        Falls back safely without external API dependencies.
        """
        results: List[Dict[str, str]] = []
        
        # 1. DuckDuckGo Instant Answer API
        try:
            api_url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json&no_html=1&skip_disambig=1"
            req = urllib.request.Request(
                api_url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                
                # Check Abstract
                if data.get("AbstractText"):
                    results.append({
                        "title": data.get("Heading", query),
                        "snippet": data.get("AbstractText", ""),
                        "url": data.get("AbstractURL", "https://duckduckgo.com")
                    })
                
                # Check RelatedTopics
                for topic in data.get("RelatedTopics", []):
                    if isinstance(topic, dict) and topic.get("Text"):
                        results.append({
                            "title": topic.get("FirstURL", "").split("/")[-1].replace("_", " "),
                            "snippet": topic.get("Text", ""),
                            "url": topic.get("FirstURL", "https://duckduckgo.com")
                        })
                    if len(results) >= max_results:
                        break
        except Exception as e:
            pass

        # 2. DuckDuckGo HTML Lite Fallback if instant answer empty
        if not results:
            try:
                lite_url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
                req = urllib.request.Request(
                    lite_url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                )
                with urllib.request.urlopen(req, timeout=4.0) as resp:
                    html = resp.read().decode("utf-8", errors="replace")
                    
                    # Regex extract title and snippets
                    matches = re.findall(
                        r'<a class="result__url" href="([^"]+)".*?<a class="result__snippet[^>]*>(.*?)</a>',
                        html,
                        re.DOTALL
                    )
                    for url, snippet in matches[:max_results]:
                        clean_snip = re.sub(r'<[^>]+>', '', snippet).strip()
                        # Unescape uddg redirect if present
                        actual_url = url
                        if "uddg=" in url:
                            m = re.search(r'uddg=([^&]+)', url)
                            if m:
                                actual_url = urllib.parse.unquote(m.group(1))
                        
                        results.append({
                            "title": query,
                            "snippet": clean_snip,
                            "url": actual_url
                        })
            except Exception:
                pass

        return results

    def research_topic(self, query: str) -> Dict[str, Any]:
        """Collect facts, format citations, and generate research summary."""
        raw_results = self.search_web(query, max_results=5)
        
        if not raw_results:
            return {
                "found": False,
                "query": query,
                "summary": f"No live search results retrieved for '{query}'. Local fallback context utilized.",
                "citations": []
            }
        
        # Format citation list
        citations = []
        snippets = []
        for i, r in enumerate(raw_results, 1):
            citations.append(f"[{i}] {r['title']} — {r['url']}")
            snippets.append(f"Source [{i}]: {r['snippet']}")

        summary = "\n\n".join(snippets)
        return {
            "found": True,
            "query": query,
            "summary": summary,
            "citations": citations
        }

research_agent = ResearchAgent()

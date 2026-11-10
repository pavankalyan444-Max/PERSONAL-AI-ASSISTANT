import re

with open(r'C:\Users\gchat\OneDrive\Desktop\jarvis ai\server.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the location after ask_claude function
old_pattern = r'(return output\s+except subprocess\.TimeoutExpired:\s+return "The request timed out\."\s+except Exception as e:\s+return f"Error: \{e\}"\s+)(\ndef find_files)'

new_functions = '''

def ask_nvidia(prompt: str) -> str:
    """Ask NVIDIA API with butler system prompt."""
    if not NVIDIA_API_KEY:
        return "NVIDIA_API_KEY not set. Please set it in your environment."
    
    system_prompt = """You are JARVIS, a polished British butler AI assistant. You speak with quiet competence, dry wit, and perfect manners. Never use emojis. Never say "As an AI language model." You have access to one tool: find_files(pattern). Use it when the user asks you to locate something on their disk. Call it by writing:

TOOL: find_files({"pattern": "your search terms"})

The tool will return matching files and folders. Present the results naturally in your response."""
    
    # Use a model that supports tool calling - Nemotron 3 Ultra
    payload = {
        "model": "nvidia/nemotron-3-ultra",
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
            "Content-Type": "application/json"
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode('utf-8'))
            output = result['choices'][0]['message']['content']
            
            # Parse tool calls
            tool_pattern = r'TOOL:\\s*find_files\\((\\{.*?\\})\\)'
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
            
            return output
    except urllib.error.HTTPError as e:
        return f"NVIDIA API error: {e.code} - {e.read().decode()}"
    except Exception as e:
        return f"Error: {e}"


def ask_ollama(prompt: str) -> str:
    """Ask local Ollama with butler system prompt."""
    if not OLLAMA_AVAILABLE:
        return "Ollama not available. Make sure it's running at " + OLLAMA_HOST
    
    system_prompt = """You are JARVIS, a polished British butler AI assistant. You speak with quiet competence, dry wit, and perfect manners. Never use emojis. Never say "As an AI language model." You have access to one tool: find_files(pattern). Use it when the user asks you to locate something on their disk. Call it by writing:

TOOL: find_files({"pattern": "your search terms"})

The tool will return matching files and folders. Present the results naturally in your response."""
    
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
            
            # Parse tool calls
            tool_pattern = r'TOOL:\\s*find_files\\((\\{.*?\\})\\)'
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
            
            return output
    except urllib.error.HTTPError as e:
        return f"Ollama error: {e.code} - {e.read().decode()}"
    except Exception as e:
        return f"Error: {e}"


def ask_llm(prompt: str) -> str:
    """Route to the configured LLM provider."""
    if LLM_PROVIDER == "nvidia":
        return ask_nvidia(prompt)
    elif LLM_PROVIDER == "ollama":
        return ask_ollama(prompt)
    else:  # claude (default)
        return ask_claude(prompt)


def find_files'''

# Replace the pattern
content = re.sub(old_pattern, r'\1' + new_functions, content, flags=re.DOTALL)

# Also update the handler to use ask_llm instead of ask_claude
content = content.replace('response = ask_claude(message)', 'response = ask_llm(message)')

# Update the state endpoint to include provider info
content = content.replace(
    '"claude_available": CLAUDE_AVAILABLE,',
    '"claude_available": CLAUDE_AVAILABLE,\n                "llm_provider": LLM_PROVIDER,'
)

with open(r'C:\Users\gchat\OneDrive\Desktop\jarvis ai\server.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched successfully")
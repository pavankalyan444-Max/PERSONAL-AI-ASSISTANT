with open(r'C:\Users\gchat\OneDrive\Desktop\jarvis ai\server.py', 'rb') as f:
    content = f.read()

# Find ask_nvidia function's output processing
idx = content.find(b'output = message.get(\'content\') or message.get(\'reasoning_content\') or ""')
# Find the end of that block - next function definition
end_idx = content.find(b'\ndef ask_ollama', idx)

# Replace the block
old_block = content[idx:end_idx]
new_block = b'output = message.get(\'content\') or message.get(\'reasoning_content\') or ""\n            \n            return process_tool_calls(output)'

new_content = content[:idx] + new_block + content[end_idx:]

with open(r'C:\Users\gchat\OneDrive\Desktop\jarvis ai\server.py', 'wb') as f:
    f.write(new_content)
print('Done')
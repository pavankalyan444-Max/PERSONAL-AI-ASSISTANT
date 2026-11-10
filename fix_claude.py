with open(r'C:\Users\gchat\OneDrive\Desktop\jarvis ai\server.py', 'rb') as f:
    content = f.read()

old = b"output = result.stdout.strip()\n        \n        tool_pattern = r'TOOL:\\s*find_files\\((\\{.*?\\})\\)'\n        matches = re.findall(tool_pattern, output, re.DOTALL)\n        \n        for match in matches:\n            try:\n                args = json.loads(match)\n                pattern = args.get(\"pattern\", \"\")\n                results = find_files(pattern)\n                result_text = format_search_results(results, pattern)\n                output = output.replace(f'TOOL: find_files({match})', result_text, 1)\n            except json.JSONDecodeError:\n                pass\n        \n        return output\n    except subprocess.TimeoutExpired:\n        return \"The request timed out.\"\n    except Exception as e:\n        return f\"Error: {e}\"\n\n\ndef ask_nvidia"

new = b"output = result.stdout.strip()\n        \n        return process_tool_calls(output)\n    except subprocess.TimeoutExpired:\n        return \"The request timed out.\"\n    except Exception as e:\n        return f\"Error: {e}\"\n\n\ndef ask_nvidia"

if old in content:
    new_content = content.replace(old, new)
    with open(r'C:\Users\gchat\OneDrive\Desktop\jarvis ai\server.py', 'wb') as f:
        f.write(new_content)
    print('Replaced successfully')
else:
    print('NOT FOUND')
    idx = content.find(b'output = result.stdout.strip()')
    print(content[idx:idx+500])
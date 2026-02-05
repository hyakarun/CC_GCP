import os
import json
import subprocess
import sys

def check_json(path):
    print(f"Checking JSON: {path}")
    if not os.path.exists(path):
        print(f"  [MISSING] {path}")
        return False
    try:
        with open(path, 'r', encoding='utf-8') as f:
            json.load(f)
        print("  [OK] Valid JSON")
        return True
    except json.JSONDecodeError as e:
        print(f"  [ERROR] Invalid JSON: {e}")
        return False

def check_js_syntax(path):
    print(f"Checking JS Syntax: {path}")
    if not os.path.exists(path):
        print(f"  [MISSING] {path}")
        return False
    try:
        # Node --check checks syntax without executing
        result = subprocess.run(["node", "--check", path], capture_output=True, text=True)
        if result.returncode == 0:
            print("  [OK] Syntax Valid")
            return True
        else:
            print(f"  [ERROR] Syntax Error:\n{result.stderr}")
            return False
    except FileNotFoundError:
        print("  [SKIP] Node.js not found, skipping JS syntax check")
        return True # Soft fail

def run_checks():
    errors = 0
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(project_root)
    
    # 1. Check master_data.json
    if not check_json("public/data/master_data.json"): errors += 1
    
    # 2. Check key JS files (Frontend & Backend)
    if not check_js_syntax("public/js/game.js"): errors += 1
    if not check_js_syntax("index.js"): errors += 1
    
    # 3. Running Linting (ESLint & Stylelint)
    print("Running Linting checks...")
    try:
        result = subprocess.run(["npm", "run", "validate"], capture_output=True, text=True)
        if result.returncode == 0:
            print("  [OK] Linting passed")
        else:
            print(f"  [ERROR] Linting failed:\n{result.stdout}\n{result.stderr}")
            # ESLint specific parsing to count errors vs warnings
            # Exit code 1 usually means errors, we treat it as an error
            errors += 1
    except Exception as e:
        print(f"  [ERROR] Failed to run linting: {e}")
        errors += 1

    # 4. Check for critical files existence
    critical_files = [
        "public/index.html",
        "public/css/style.css",
        "package.json",
        "eslint.config.mjs"
    ]
    for f in critical_files:
         if not os.path.exists(f):
             print(f"[MISSING] {f}")
             errors += 1
         else:
             print(f"[OK] Found {f}")

    print("-" * 20)
    if errors == 0:
        print("All checks passed! System looks healthy.")
        sys.exit(0)
    else:
        print(f"Found {errors} errors.")
        sys.exit(1)

if __name__ == "__main__":
    run_checks()

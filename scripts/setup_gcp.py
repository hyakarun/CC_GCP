import subprocess
import time
import sys
import json

REQUIRED_APIS = [
    "run.googleapis.com",
    "firestore.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com"
]

REPO_NAME = "game-repo"
REGION = "asia-northeast1"

def run_cmd(args, check=True):
    # Windows compatibility for gcloud command
    if sys.platform == "win32" and args[0] == "gcloud":
        # Check if gcloud.cmd exists or let shell resolve it
        from shutil import which
        if which("gcloud") is None and which("gcloud.cmd"):
             args[0] = "gcloud.cmd"
    
    try:
        print(f"Running: {' '.join(args)}")
        # Windows requires shell=True for some commands or explicit extension
        use_shell = sys.platform == "win32"
        res = subprocess.run(args, check=check, text=True, capture_output=True, encoding='utf-8', shell=use_shell)
        return res.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {e.cmd}")
        print(f"Stderr: {e.stderr}")
        sys.exit(1)

def main():
    print("=== 1. GCP Environment Setup ===")
    
    # 1. Initialize
    print("Initializing...")
    project_id = run_cmd(["gcloud", "config", "get-value", "project"])
    if not project_id:
        print("Error: No active project found. Please run 'gcloud auth login' first.")
        sys.exit(1)
    print(f"Project ID: {project_id}")

    # 2. Enable APIs
    print("Enabling APIs...")
    for api in REQUIRED_APIS:
        run_cmd(["gcloud", "services", "enable", api], check=False)
    
    print("Waiting 30 seconds for APIs to propagate...")
    time.sleep(30)

    # 3. Artifact Registry
    print("Checking Artifact Registry...")
    # List repositories to see if it exists
    repos = run_cmd(["gcloud", "artifacts", "repositories", "list", 
                     "--project", project_id, 
                     "--location", REGION, 
                     "--format=json"], check=False)
    
    repo_exists = False
    if repos:
        try:
            repo_list = json.loads(repos)
            for r in repo_list:
                if r['name'].endswith(f"/repositories/{REPO_NAME}"):
                    repo_exists = True
                    break
        except json.JSONDecodeError:
            pass

    if repo_exists:
        print(f"Repository '{REPO_NAME}' already exists.")
    else:
        print(f"Creating Artifact Registry repository '{REPO_NAME}'...")
        run_cmd([
            "gcloud", "artifacts", "repositories", "create", REPO_NAME,
            "--repository-format=docker",
            "--location", REGION,
            "--description", "Game Backend Repository"
        ])

    # 4. Firestore
    print("Checking Firestore...")
    # Check if database exists (default)
    db_check = run_cmd(["gcloud", "firestore", "databases", "describe", "--database=(default)", "--format=json"], check=False)
    
    if db_check:
        print("Firestore database already exists.")
    else:
        print(f"Creating Firestore database in {REGION} (Native Mode)...")
        # Note: 'gcloud firestore databases create' might prompt or fail if app engine is not set. 
        # Native mode requires region.
        run_cmd([
            "gcloud", "firestore", "databases", "create",
            "--location", REGION,
            "--type", "firestore-native"
        ])

    print("\n✅ Setup GCP Completed Successfully.")

if __name__ == "__main__":
    main()

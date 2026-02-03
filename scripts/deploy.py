import subprocess
import sys
import json

SERVICE_NAME = "cc-game-server"
REGION = "asia-northeast1"
REPO_NAME = "game-repo"

def run_cmd(args):
    """Run command and return stdout. Exit on failure."""
    
    # Windows compatibility
    if sys.platform == "win32" and args[0] == "gcloud":
        from shutil import which
        if which("gcloud") is None and which("gcloud.cmd"):
             args[0] = "gcloud.cmd"
             
    cmd_str = " ".join(args)
    print(f"Running: {cmd_str}")
    try:
        use_shell = sys.platform == "win32"
        res = subprocess.run(args, check=True, text=True, encoding='utf-8', capture_output=True, shell=use_shell)
        return res.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error executing command: {cmd_str}")
        print(f"Stderr: {e.stderr}")
        sys.exit(1)

def main():
    print("=== 3. Build & Deploy ===")
    
    # Get Project ID
    project_id = run_cmd(["gcloud", "config", "get-value", "project"])
    print(f"Project ID: {project_id}")
    
    image_tag = f"asia-northeast1-docker.pkg.dev/{project_id}/{REPO_NAME}/{SERVICE_NAME}"

    # 1. Build
    print(f"\n[1/2] Building container image: {image_tag}")
    # Specify staging bucket to avoid default bucket issues
    staging_bucket = f"gs://{project_id}-build-staging/source"
    run_cmd(["gcloud", "builds", "submit", "--tag", image_tag, "--gcs-source-staging-dir", staging_bucket, "."])
    print("✅ Build successful.")

    # 2. Deploy
    print(f"\n[2/2] Deploying to Cloud Run: {SERVICE_NAME}")
    deploy_args = [
        "gcloud", "run", "deploy", SERVICE_NAME,
        "--image", image_tag,
        "--platform", "managed",
        "--region", REGION,
        "--allow-unauthenticated",
        # Free tier optimization
        "--max-instances=1",
        "--min-instances=0",
        "--memory=512Mi",
        "--cpu=1",
        "--port", "8080",
        "--format=json"
    ]
    
    result_json = run_cmd(deploy_args)
    
    try:
        data = json.loads(result_json)
        url = data.get("status", {}).get("url")
        print("\n" + "="*50)
        print("🚀 Deployment Completed Successfully!")
        print(f"API Endpoint URL: {url}")
        print("="*50)
    except Exception as e:
        print("Deployment finished but failed to parse output.")
        print(result_json)

if __name__ == "__main__":
    main()

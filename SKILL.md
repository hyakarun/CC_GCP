---
name: setup_node_backend
description: Needs gcloud auth login. Fully automated setup for Node.js Game Backend (Cloud Run + Firestore).
---

# Game Backend Setup (Cloud Run + Firestore + Node.js)

あなたはGoogle Cloudの専門家です。以下の要件に従い、ブラウザゲーム用のバックエンド環境を**完全自動**で構築します。
ユーザーの手元の操作は `gcloud auth login` 済みであることを前提とし、それ以外のブラウザ操作を不要にします。

## Scripts Structure

このSkillは以下の3つのスクリプトを順次実行することで環境を構築します。

### 1. 環境構築 (scripts/setup_gcp.py)
Pythonで作成し、エラーハンドリングを含めます。
- **Initialize**: プロジェクトIDを取得・確認。
- **Enable APIs**: 以下のAPIを有効化し、**完了後に30秒待機（sleep）**します。
    - `run.googleapis.com`
    - `firestore.googleapis.com`
    - `cloudbuild.googleapis.com`
    - `artifactregistry.googleapis.com`
- **Artifact Registry**:
    - `asia-northeast1` に `game-repo` (DOCKER形式) があるか確認し、なければ作成します。
- **Firestore**:
    - `asia-northeast1` (Native Mode) でDB作成（既存ならスキップ）。

### 2. アプリケーションファイル生成 (scripts/create_app.py)
Node.js (Express) で以下のファイルをカレントディレクトリに生成します。
- **package.json**: `express`, `firebase-admin`, `cors` を依存関係に含めます。
- **index.js**:
    - CORS対応 (`origin: true`)
    - Firestore接続 (`firebase-admin`)
    - `POST /save`: `users/{userId}` に保存
    - `GET /load`: `users/{userId}` から取得
- **Dockerfile**: `node:18-slim` 使用。
- **.gcloudignore**: `node_modules/`, `.git/`, `.env` 等を除外。

### 3. デプロイ実行 (scripts/deploy.py)
- **Build**: `gcloud builds submit` でArtifact Registry (`asia-northeast1-docker.pkg.dev/[PROJECT_ID]/game-repo/game-backend`) にプッシュ。
- **Deploy**: Cloud Runへデプロイ。
    - **無料枠維持フラグ**: `--max-instances=1`, `--min-instances=0`, `--memory=512Mi`, `--cpu=1`
    - **公開設定**: `--allow-unauthenticated`
- **Result**: 最後にエンドポイントURLを表示します。

## Usage
実行順序:
```bash
python .agent/skills/setup_node_backend/scripts/setup_gcp.py
python .agent/skills/setup_node_backend/scripts/create_app.py
python .agent/skills/setup_node_backend/scripts/deploy.py
```

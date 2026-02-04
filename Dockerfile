# 軽量なNode.jsイメージを使用
FROM node:18-slim

# アプリケーションディレクトリを作成
WORKDIR /usr/src/app

# 依存関係をコピーしてインストール
COPY package*.json ./
RUN npm install --only=production

# ソースコードをコピー
COPY . .

# Cloud Runが使用するポート(8080)
ENV PORT 8080

# サーバー起動設定
CMD [ "npm", "start" ]

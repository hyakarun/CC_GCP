import os

# --- File Contents ---

PACKAGE_JSON = """{
  "name": "game-backend",
  "version": "1.0.0",
  "description": "Game Backend with Firestore",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "firebase-admin": "^11.11.0",
    "cors": "^2.8.5"
  }
}"""

INDEX_JS = """const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// Initialize Firestore
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Routes
// POST /save: Save game data
app.post('/save', async (req, res) => {
  try {
    const { userId, data } = req.body;
    if (!userId || !data) {
      return res.status(400).send({ error: "Missing userId or data" });
    }
    
    // Save to users/{userId} with merge: true
    await db.collection('users').doc(userId).set(data, { merge: true });
    
    res.status(200).send({ status: "success", userId });
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// GET /load: Load game data
app.get('/load', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).send({ error: "Missing userId query param" });
    }
    
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) {
      return res.status(404).send({ error: "User not found" });
    }
    
    res.status(200).send(doc.data());
  } catch (error) {
    console.error("Error loading data:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('Game Backend is running.');
});

// Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
"""

DOCKERFILE = """# Use lightweight Node.js image
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --only=production

# Bundle app source
COPY . .

# Cloud Run sets PORT (default 8080)
ENV PORT 8080

# Start command
CMD [ "npm", "start" ]
"""

GCLOUDIGNORE = """node_modules/
.git/
.env
README.md
*.py
"""

def create_file(filename, content):
    print(f"Creating {filename}...")
    with open(filename, "w", encoding='utf-8') as f:
        f.write(content.strip())

def main():
    print("=== 2. Create Application Files ===")
    
    create_file("package.json", PACKAGE_JSON)
    create_file("index.js", INDEX_JS)
    create_file("Dockerfile", DOCKERFILE)
    create_file(".gcloudignore", GCLOUDIGNORE)
    
    print("\n✅ Application files generated successfully.")

if __name__ == "__main__":
    main()

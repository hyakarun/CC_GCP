const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

// Firebase Admin SDK 初期化
// 環境変数（FIRESTORE_EMULATOR_HOST）がある場合は自動的にエミュレータに接続されます
try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
} catch (e) {
    // ローカル環境などで認証情報がない場合は警告を出す（デプロイ済み環境では必須）
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
        console.warn("Firebase Admin couldn't be initialized normally. Check credentials if not running in Emulator.");
    }
    // エミュレータ時は初期化が不完全でも動作することがあるので継続
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
}
const db = admin.firestore();

const app = express();

// --- 静的ファイルの配信設定 ---
// public フォルダ内の HTML, CSS, JS などを優先的に配信します
app.use(express.static(path.join(__dirname, 'public')));

// ミドルウェア設定
app.use(cors({
    origin: true, // 全ドメイン許可（開発中）
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// --- API エンドポイント ---

// 1. セッションチェック
app.get('/check_session.php', async (req, res) => {
    const userEmail = req.cookies.user_email;
    if (userEmail) {
        res.json({ status: 'success', email: userEmail });
    } else {
        res.json({ status: 'error', message: 'Not logged in' });
    }
});

// 2. ログイン
app.post('/login.php', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ status: 'error', message: 'Missing fields' });

        const userRef = db.collection('users').doc(email);
        const doc = await userRef.get();

        if (!doc.exists || !bcrypt.compareSync(password, doc.data().password)) {
            return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
        }

        // Cookieにメールアドレスを保存（簡易セッション）
        res.cookie('user_email', email, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'Lax' });
        res.json({ status: 'success', email });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// 3. 新規登録
app.post('/register.php', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) return res.status(400).json({ status: 'error', message: 'Missing fields' });

        const userRef = db.collection('users').doc(email);
        const doc = await userRef.get();

        if (doc.exists) {
            return res.status(400).json({ status: 'error', message: 'Email already exists' });
        }

        await userRef.set({
            name: name || 'Hero',
            password: bcrypt.hashSync(password, 10),
            save_data: "{}",
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ status: 'success' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// 4. セーブ
app.post('/save_game.php', async (req, res) => {
    try {
        const userEmail = req.cookies.user_email;
        if (!userEmail) return res.status(401).json({ status: 'error', message: 'Not logged in' });

        const { save_data } = req.body;
        await db.collection('users').doc(userEmail).update({
            save_data: save_data,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ status: 'success' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// 5. ロード
app.get('/load_game.php', async (req, res) => {
    try {
        const userEmail = req.cookies.user_email;
        if (!userEmail) return res.status(401).json({ status: 'error', message: 'Not logged in' });

        const doc = await db.collection('users').doc(userEmail).get();
        if (!doc.exists) return res.status(404).json({ status: 'error', message: 'User not found' });

        res.json({ status: 'success', save_data: doc.data().save_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// 画面配信 (SPA対応: 見つからないパスは index.html を返す)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

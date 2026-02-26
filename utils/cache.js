// --- 簡易 In-Memory Cache (一時的に無効化) ---
const userCache = new Map();

function getFromCache(email) {
    // キャッシュを無効化
    return null;
}

function setToCache(email, data) {
    // キャッシュしない
}

function updateSaveData(email, saveData) {
    // キャッシュを更新しない
}

module.exports = {
    getFromCache,
    setToCache,
    updateSaveData
};

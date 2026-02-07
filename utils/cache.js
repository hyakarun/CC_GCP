// --- 簡易 In-Memory Cache ---
const userCache = new Map();
const CACHE_TTL = 60 * 1000; // 60秒

function getFromCache(email) {
    const cached = userCache.get(email);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setToCache(email, data) {
    userCache.set(email, {
        data: data,
        timestamp: Date.now()
    });
}

function updateSaveData(email, saveData) {
    const cached = userCache.get(email);
    if (cached) {
        cached.data.save_data = saveData;
        cached.timestamp = Date.now();
    }
}

module.exports = {
    getFromCache,
    setToCache,
    updateSaveData
};

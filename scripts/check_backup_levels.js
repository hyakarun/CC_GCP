const fs = require('fs');

const backupFile = 'backup_prod_data_before_migration.json';
if (!fs.existsSync(backupFile)) {
    console.error('Backup file not found.');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

console.log('--- User Levels in Backup (from save_data string) ---');
for (const email in data) {
    const user = data[email];
    let level = 'N/A';
    let money = 'N/A';
    
    if (user.save_data && user.save_data !== '{}') {
        try {
            const save = JSON.parse(user.save_data);
            level = save.lv || '?';
            money = save.money || 0;
        } catch (e) {
            level = 'Error parsing';
        }
    }
    
    // トップレベルのLvフィールドがある場合も表示
    const topLv = user.Lv || user.lv || '-';
    
    console.log(`${email.padEnd(35)} | SaveLv: ${String(level).padEnd(3)} | TopLv: ${String(topLv).padEnd(3)} | Money: ${money}`);
}

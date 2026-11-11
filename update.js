const https = require('https');

// 設定要爬取的網址
const TARGET_URL = 'https://lotto2.arclink.com.tw/539/539open-1.html';

// 取得台灣當前日期字串 (YYYY-MM-DD)
function getTodayString() {
    const d = new Date();
    // 轉換為台灣時區 (UTC+8)
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const twDate = new Date(utc + (3600000 * 8));
    
    const year = twDate.getFullYear();
    const month = String(twDate.getMonth() + 1).padStart(2, '0');
    const day = String(twDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 動態抓取網頁號碼
function fetchLatestNumbers() {
    return new Promise((resolve, reject) => {
        https.get(TARGET_URL, (res) => {
            let html = '';
            res.on('data', (chunk) => { html += chunk; });
            res.on('end', () => {
                try {
                    // 使用正則表達式動態抓取 bgcolor="#ffff99" 裡的號碼
                    const regex = /bgcolor="#ffff99"[^>]*>\s*(\d{2})\s*<\/td>/gi;
                    const matches = [...html.matchAll(regex)];
                    const balls = matches.map(m => m[1]);

                    if (balls.length !== 5) {
                        return reject(new Error(`抓到的號碼數量不正確: ${balls.length}`));
                    }
                    resolve(balls);
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

async function runUpdate() {
    try {
        const currentTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        console.log(`[${currentTime}] 開始執行今彩539自動更新...`);
        
        const balls = await fetchLatestNumbers();
        const today = getTodayString();
        
        // 依照您的需求在 Actions Log 記錄日期與號碼
        console.log(`[${currentTime}] 抓取成功！`);
        console.log(`日期: ${today}`);
        console.log(`開獎號碼: ${balls.join(', ')}`);

        const newEntry = `['${today}',['${balls.join("','")}']]`;
        console.log(`產生的格式: ${newEntry}`);

    } catch (error) {
        console.error(`[錯誤] 更新失敗: ${error.message}`);
    }
}

runUpdate();

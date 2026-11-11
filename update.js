const https = require('https');

// 設定要爬取的網址
const TARGET_URL = 'https://lotto2.arclink.com.tw/539/539open-1.html';

// 取得今天的日期字串 (YYYY-MM-DD)
function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 抓取網頁並解析 5 個號碼
function fetchLatestNumbers() {
    return new Promise((resolve, reject) => {
        https.get(TARGET_URL, (res) => {
            let html = '';
            res.on('data', (chunk) => { html += chunk; });
            res.on('end', () => {
                try {
                    const regex = /<td[^>]*>\s*(\d{2})\s*<\/td>/gi;
                    const matches = [...html.matchAll(regex)];
                    const balls = matches.slice(0, 5).map(m => m[1]);

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
        console.log("開始執行今彩539自動更新...");
        const balls = await fetchLatestNumbers();
        const today = getTodayString();
        
        console.log(`日期: ${today}`);
        console.log(`抓取到的落球號碼:`, balls);

        const newEntry = `['${today}',['${balls.join("','")}']]`;
        console.log("準備插入首列的格式：", newEntry);

    } catch (error) {
        console.error("更新失敗:", error.message);
    }
}

runUpdate();

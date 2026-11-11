const { chromium } = require('playwright');

const TARGET_URL = 'https://lotto2.arclink.com.tw/539/539open-1.html';

// 取得台灣當前日期字串 (YYYY-MM-DD)
function getTodayString() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const twDate = new Date(utc + (3600000 * 8));
    const year = twDate.getFullYear();
    const month = String(twDate.getMonth() + 1).padStart(2, '0');
    const day = String(twDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function runUpdate() {
    console.log("開始啟動無頭瀏覽器執行 Playwright 抓取...");
    
    // 啟動瀏覽器
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // 前往目標網頁並等待網路完全閒置、轉址完成
        console.log(`正在連線至: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

        // 給予一點時間確保 JavaScript 挑戰與重新導向完全結束
        await page.waitForTimeout(3000);

        // 取得渲染後的完整 HTML 內容
        const html = await page.content();
        
        // 利用正則抓取開獎號碼
        const regex = /bgcolor="#ffff99"[^>]*>\s*(\d{2})\s*<\/td>/gi;
        const matches = [...html.matchAll(regex)];
        const balls = matches.map(m => m[1]);

        console.log(`[偵測] 抓到的符合標籤數: ${balls.length}`);

        if (balls.length !== 5) {
            throw new Error(`抓到的號碼數量不正確: ${balls.length}`);
        }

        const today = getTodayString();
        console.log(`[成功] 日期: ${today}`);
        console.log(`[成功] 開獎號碼: ${balls.join(', ')}`);

        const newEntry = `['${today}',['${balls.join("','")}']]`;
        console.log(`準備寫入的格式: ${newEntry}`);

    } catch (error) {
        console.error(`[錯誤] 抓取失敗: ${error.message}`);
    } finally {
        await browser.close();
    }
}

runUpdate();

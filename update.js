// 引入 Node.js 內建的 https 模組用來發送網路請求
const https = require('https');

// 今彩539直播動態號碼的官方 API 網址（用來抓取最新的落球順序）
const LIVE_API_URL = 'https://www.pilio.idv.tw/Live/DrawLiveRead.asp?ltotype=lto539';

// 從 GitHub Secrets 讀取您設定的權杖 (GH_PAT)
const GH_TOKEN = process.env.GH_PAT; 

// 支援您的雙 GitHub 帳號與檔案設定（預設為 88ll88 與 88l88）
const GH_ACCOUNTS = [
    { owner: '88ll88', repo: '888', path: 'vvv.js' },
    { owner: '88l88', repo: '888', path: 'vvv.js' }
];

// 自動取得台灣當前日期，格式為 YYYY-MM-DD
function getTodayString() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const twDate = new Date(utc + (3600000 * 8)); // 轉換成台灣時區 (UTC+8)
    const year = twDate.getFullYear();
    const month = String(twDate.getMonth() + 1).padStart(2, '0');
    const day = String(twDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 1. 發送請求去抓取直播中的 5 顆落球號碼
function fetchLiveDrawBalls() {
    return new Promise((resolve, reject) => {
        https.get(LIVE_API_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://www.pilio.idv.tw/lto539/list.asp'
            }
        }, (res) => {
            let chunks = [];
            // 接收資料片段
            res.on('data', (chunk) => { chunks.push(chunk); });
            // 接收完畢
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                // 利用正則表達式抓出網頁中所有的兩位數號碼
                const matches = text.match(/\d{2}/g);
                
                // 如果抓到的號碼少於 4 個，代表還沒開始開獎或數量不足
                if (!matches || matches.length < 4) {
                    return reject(new Error(`目前抓到的號碼數量不足 4 個 (當前數量: ${matches ? matches.length : 0})`));
                }
                // 取出前 5 個號碼作為落球順序
                resolve(matches.slice(0, 5));
            });
        }).on('error', reject);
    });
}

// 2. 透過 GitHub API 讀取遠端倉庫的檔案內容與 sha 碼
function getGithubFile(owner, repo, filePath) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/contents/${filePath}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Node.js Script',
                'Authorization': `Bearer ${GH_TOKEN}`,
                'Accept': 'vnd.github+json'
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`讀取 GitHub 檔案失敗 (HTTP ${res.statusCode}): ${data}`));
                }
                try {
                    const json = JSON.parse(data);
                    // GitHub API 回傳的檔案內容是 Base64 編碼，需轉回 UTF-8 字串
                    const content = Buffer.from(json.content, 'base64').toString('utf8');
                    resolve({ content, sha: json.sha });
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

// 3. 將更新後的檔案內容寫回 GitHub 倉庫
function updateGithubFile(owner, repo, filePath, newContent, sha) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            message: `Auto update loto 539 data for ${getTodayString()}`,
            content: Buffer.from(newContent, 'utf8').toString('base64'), // 轉回 Base64
            sha: sha // 必須帶上檔案的 sha 才能成功覆蓋
        });

        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/contents/${filePath}`,
            method: 'PUT',
            headers: {
                'User-Agent': 'Node.js Script',
                'Authorization': `Bearer ${GH_TOKEN}`,
                'Accept': 'vnd.github+json',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let resData = '';
            res.on('data', chunk => { resData += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    resolve(resData);
                } else {
                    reject(new Error(`寫入 GitHub 失敗 (HTTP ${res.statusCode}): ${resData}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// 主執行程式
async function runUpdate() {
    try {
        const currentTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        console.log(`[${currentTime}] 開始執行今彩539自動更新程序...`);
        
        // 步驟 A：從直播 API 抓取最新落球號碼
        const balls = await fetchLiveDrawBalls();
        const today = getTodayString();
        const newEntry = `['${today}',['${balls.join("','")}']]`;
        console.log(`[成功抓取] 最新落球順序: ${newEntry}`);

        // 步驟 B：對每個 GitHub 帳號/倉庫進行更新
        for (const account of GH_ACCOUNTS) {
            console.log(`正在處理帳號 ${account.owner} 的 ${account.path}...`);
            
            // 讀取遠端檔案
            const { content, sha } = await getGithubFile(account.owner, account.repo, account.path);

            // 檢查是否已經寫入過今天的記錄，避免重複新增
            if (content.includes(`'${today}'`)) {
                console.log(`[提示] ${account.owner} 的檔案中已經存在 ${today} 的記錄，跳過。`);
                continue;
            }

            // 將新的一筆資料插入到陣列最前端
            let updatedContent = content;
            const firstBracketIndex = content.indexOf('[');
            if (firstBracketIndex !== -1) {
                updatedContent = content.slice(0, firstBracketIndex + 1) + '\n    ' + newEntry + ',' + content.slice(firstBracketIndex + 1);
            } else {
                throw new Error("無法解析檔案中的陣列結構");
            }

            // 將新內容推送回 GitHub
            await updateGithubFile(account.owner, account.repo, account.path, updatedContent, sha);
            console.log(`[完成] ${account.owner} 的 ${account.path} 已成功更新！`);
        }

    } catch (error) {
        console.error(`[錯誤] ${error.message} (若在非開獎時間執行屬正常現象)`);
    }
}

// 執行主程式
runUpdate();

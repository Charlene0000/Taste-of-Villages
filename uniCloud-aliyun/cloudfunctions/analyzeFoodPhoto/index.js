'use strict';
const crypto = require('crypto');

// =================配置区=================
// 1. 百度智能云 (用于识别菜品)
// 文档: https://cloud.baidu.com/doc/IMAGERECOGNITION/s/tk3bcxbb0
// 2. DeepSeek (用于生成评价)
// 获取地址: https://platform.deepseek.com/
// 密钥统一由 app-config 提供，源码不含真实凭据；未配置时走本地降级路径。
function loadAppConfig() {
	const candidates = ['app-config', '../common/app-config']
	for (const id of candidates) {
		try {
			return require(id)
		} catch (e) {
			// 尝试下一个候选路径
		}
	}
	throw new Error('[analyzeFoodPhoto] 无法加载 app-config 模块')
}
const CONFIG = loadAppConfig().getConfig();

const BAIDU_API_KEY = (CONFIG.baidu && CONFIG.baidu.apiKey) || 'your-baidu-api-key-placeholder';
const BAIDU_SECRET_KEY = (CONFIG.baidu && CONFIG.baidu.secretKey) || 'your-baidu-secret-key-placeholder';

const DEEPSEEK_API_KEY = (CONFIG.deepseek && CONFIG.deepseek.apiKey) || 'your-deepseek-key-placeholder';
const DEEPSEEK_API_URL = (CONFIG.deepseek && CONFIG.deepseek.apiUrl) || 'https://api.deepseek.com/v1/chat/completions';
// =======================================

exports.main = async (event, context) => {
    const { fileID } = event;

    if (!fileID) {
        return { code: 400, message: '请上传图片' };
    }

    try {
        // 1. 获取图片临时链接
        let imageUrl = fileID;
        if (fileID.startsWith('cloud://')) {
            const tempRes = await uniCloud.getTempFileURL({ fileList: [fileID] });
            imageUrl = tempRes.fileList[0].tempFileURL;
        }

        // 2. 调用百度 AI 识别食物
        const recognitionResult = await recognizeFoodBaidu(imageUrl);

        // 如果没有识别出食物，或者分数太低
        if (!recognitionResult || recognitionResult.length === 0) {
            console.warn('Baidu AI did not find valid food');
            return { code: 200, data: { isFood: false, score: 60, comment: "这看起来不像食物哦，换张照片试试？", tags: [] } };
        }

        // 百度返回的 result 数组中，第一项通常是置信度最高的
        const foodName = recognitionResult[0].name || '美食';
        const confidence = parseFloat(recognitionResult[0].probability) || 0; // 0-1 float
        const calorie = recognitionResult[0].calorie || null;

        // 检查是否为明确的非食物类别
        const nonFoodKeywords = ['非菜', '非食', '不是', '其他', '未知'];
        const isNonFood = nonFoodKeywords.some(keyword => foodName.includes(keyword));

        if (isNonFood) {
            console.warn(`Detected non-food category: ${foodName}`);
            return {
                code: 200,
                data: {
                    isFood: false,
                    score: 60,
                    comment: "这好像不是菜哦，换张美食照片试试吧！🍜",
                    tags: ['非食物']
                }
            };
        }

        // 置信度阈值检查：低于50%认为不是食物
        if (confidence < 0.5) {
            console.warn(`Low confidence (${(confidence * 100).toFixed(1)}%) for: ${foodName}`);
            return {
                code: 200,
                data: {
                    isFood: false,
                    score: 60,
                    comment: "这看起来不太像食物哦，换张菜品照片试试？🤔",
                    tags: ['非食物']
                }
            };
        }

        // 3. 生成更有差异性的评分
        // 基础分：置信度 * 30 (0-30分)
        // 基准分：65分
        // 随机波动：±5分
        const baseScore = Math.floor(confidence * 30 + 65);
        const randomAdjust = Math.floor(Math.random() * 11) - 5; // -5 到 +5
        const finalScore = Math.max(70, Math.min(100, baseScore + randomAdjust));

        // 4. 调用 DeepSeek 生成评价（传入更多信息）
        const commentData = await generateComment(foodName, confidence, calorie, finalScore);

        return {
            code: 200,
            message: '分析完成',
            data: {
                isFood: true,
                score: finalScore,
                comment: commentData.comment,
                tags: [foodName, ...commentData.tags].slice(0, 3)
            }
        };

    } catch (e) {
        console.error('AI分析失败:', e);
        // 直接返回错误信息，不再掩耳盗铃
        return { code: 500, message: `AI Error: ${e.message}` };
    }
};

// --- 下面是详细的 API 调用逻辑 ---

// 模拟模式 (兜底)
function mockAnalysis() {
    const comments = [
        "看起来色泽诱人，火候掌握得恰到好处！😋",
        "隔着屏幕都能闻到香气！😍",
        "这是一道让人食欲大增的美味！🔥"
    ];
    return {
        code: 200,
        message: '(模拟)分析完成',
        data: {
            isFood: true,
            score: 88,
            comment: comments[Math.floor(Math.random() * comments.length)],
            tags: ['美食', '推荐']
        }
    }
}

// 调用 DeepSeek 生成评价（优化多样性）
async function generateComment(foodName, confidence, calorie, score) {
    try {
        // 随机选择评论风格，增加多样性
        const styles = [
            "资深美食评论家，语言优雅专业",
            "热情的吃货博主，语言活泼有趣",
            "严苛的米其林评委，点评犀利精准",
            "怀旧的美食作家，充满人文情怀",
            "年轻的美食网红，幽默风趣爱用emoji"
        ];
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];

        // 随机选择评论关注点
        const focuses = [
            "重点评价色香味",
            "关注营养健康",
            "强调烹饪技巧",
            "描述口感层次",
            "讲述文化故事"
        ];
        const randomFocus = focuses[Math.floor(Math.random() * focuses.length)];

        // 根据分数给出情绪倾向
        let mood = "中性";
        if (score >= 90) mood = "非常赞赏";
        else if (score >= 80) mood = "比较喜欢";
        else if (score >= 75) mood = "还不错";
        else mood = "略有保留";

        const messages = [
            {
                role: "system",
                content: `你是一个${randomStyle}，${randomFocus}。语气${mood}。每次回复都要有新意，避免重复。`
            },
            {
                role: "user",
                content: `评价"${foodName}"这道菜（置信度${(confidence * 100).toFixed(0)}%${calorie ? '，卡路里' + calorie : ''}），给出一段独特的简短点评(40字以内)和2-3个标签。返回JSON：{"comment": "...", "tags": ["tag1", "tag2"]}`
            }
        ];

        const response = await uniCloud.httpclient.request(DEEPSEEK_API_URL, {
            method: 'POST',
            dataType: 'json',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            data: {
                model: 'deepseek-chat',
                messages: messages,
                response_format: { type: 'json_object' },
                temperature: 0.9  // 提高随机性
            }
        });

        if (response.status === 200) {
            const content = response.data.choices[0].message.content;
            return JSON.parse(content);
        }
    } catch (e) {
        console.error('DeepSeek Error:', e);
    }

    // 兜底评论也加入随机性
    const fallbacks = [
        { comment: `${foodName}的经典滋味，令人回味无穷！`, tags: ['传统美味', '推荐'] },
        { comment: `这道${foodName}色香味俱全，真是视觉与味觉的双重享受！`, tags: ['精致', '诱人'] },
        { comment: `${foodName}，家的味道，温暖人心！`, tags: ['温馨', '怀旧'] }
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ... (DeepSeek function remains similar, verify if it needs to be included in replacement chuck)
// Since I am replacing the TOP part and the BOTTOM part, I should probably check line numbers.
// Wait, the "mockAnalysis" and "generateComment" are in the middle.
// I can just replace the whole file content or use multiple chunks if safer.
// Let's replace the whole file structure or large chunks.

// CHUNK 1: Constants and Main
// CHUNK 2: RecognizeFoodBaidu Implementation

// Let's stick to replacing specific functions.
// Actually, `uniCloud` environment might have stale code if I don't replace cleanly.

// --- Helper Functions ---

async function getBaiduAccessToken() {
    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`;
    const res = await uniCloud.httpclient.request(url, { dataType: 'json' });
    if (res.data && res.data.access_token) {
        return res.data.access_token;
    }
    throw new Error('Failed to get Baidu Access Token: ' + JSON.stringify(res.data));
}

async function recognizeFoodBaidu(imageUrl) {
    console.log('Starting Baidu Analysis for:', imageUrl);
    const token = await getBaiduAccessToken();

    // Baidu Dish Recognition URL
    const apiUrl = `https://aip.baidubce.com/rest/2.0/image-classify/v2/dish?access_token=${token}`;

    try {
        // 方法1: 先尝试使用 URL 参数（更高效）
        // 注意：百度API的url参数需要是公网可访问的URL
        const postData = `url=${encodeURIComponent(imageUrl)}&top_num=3`;

        const res = await uniCloud.httpclient.request(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: postData,
            dataType: 'json',
            timeout: 30000 // 30秒超时
        });

        console.log('Baidu Response:', JSON.stringify(res.data));

        if (res.data && res.data.result) {
            return res.data.result; // [{name: '麻婆豆腐', probability: '0.9', calorie: '119', ...}]
        }

        if (res.data && res.data.error_msg) {
            // 如果URL方式失败（比如URL不可访问），尝试下载并转base64
            if (res.data.error_code === 216201 || res.data.error_msg.includes('URL')) {
                console.log('URL method failed, trying base64 method...');
                return await recognizeFoodBaiduBase64(imageUrl, apiUrl);
            }
            throw new Error(`Baidu API Error (${res.data.error_code}): ${res.data.error_msg}`);
        }

        return null;
    } catch (error) {
        console.error('Baidu recognition error:', error);
        // 如果URL方式出错，尝试base64方式
        if (error.message && error.message.includes('URL')) {
            console.log('Fallback to base64 method due to URL error');
            return await recognizeFoodBaiduBase64(imageUrl, apiUrl);
        }
        throw error;
    }
}

// 使用base64方式调用百度API（备用方案）
async function recognizeFoodBaiduBase64(imageUrl, apiUrl) {
    try {
        console.log('Downloading image for base64 encoding...');

        // 下载图片
        const downloadRes = await uniCloud.httpclient.request(imageUrl, {
            method: 'GET',
            dataType: 'text',
            dataAsQueryString: true,
            timeout: 15000
        });

        if (!downloadRes.data) {
            throw new Error('Failed to download image');
        }

        // 转换为base64
        const base64Image = Buffer.from(downloadRes.data, 'binary').toString('base64');

        // URL encode the base64 string
        const postData = `image=${encodeURIComponent(base64Image)}&top_num=3`;

        console.log('Sending base64 image to Baidu API...');
        const res = await uniCloud.httpclient.request(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: postData,
            dataType: 'json',
            timeout: 30000
        });

        console.log('Baidu Base64 Response:', JSON.stringify(res.data));

        if (res.data && res.data.result) {
            return res.data.result;
        }

        if (res.data && res.data.error_msg) {
            throw new Error(`Baidu API Error (${res.data.error_code}): ${res.data.error_msg}`);
        }

        return null;
    } catch (error) {
        console.error('Base64 recognition error:', error);
        throw error;
    }
}

'use strict';
const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');


const IS_AI_ENABLED = true; 


// =================配置区（密钥统一由 app-config 提供，源码不含真实凭据）=================
// 读取顺序：uni-config-center(app-config plugin) → config.local.json → config.json 占位符
// 未配置时 isServiceEnabled() 返回 false，调用方走本地降级路径，不产生外部调用与费用。
function loadAppConfig() {
	// 'app-config' 适用于 uniCloud 部署后的 common 模块解析；
	// '../common/app-config' 适用于仓库内本地直接运行（如 node 脚本 / 单测）。
	const candidates = ['app-config', '../common/app-config']
	for (const id of candidates) {
		try {
			return require(id)
		} catch (e) {
			// 尝试下一个候选路径
		}
	}
	throw new Error('[ai-agent] 无法加载 app-config 模块，请确认 uniCloud-aliyun/cloudfunctions/common/app-config 存在')
}
const appConfig = loadAppConfig();
const CONFIG = appConfig.getConfig();

const DEEPSEEK_API_KEY = (CONFIG.deepseek && CONFIG.deepseek.apiKey) || 'your-deepseek-key-placeholder';
const DEEPSEEK_API_URL = (CONFIG.deepseek && CONFIG.deepseek.apiUrl) || 'https://api.deepseek.com/v1/chat/completions';

const XFYUN_APPID = (CONFIG.xfyun && CONFIG.xfyun.appId) || 'your-xfyun-appid-placeholder';
const XFYUN_API_SECRET = (CONFIG.xfyun && CONFIG.xfyun.apiSecret) || 'your-xfyun-api-secret-placeholder';
const XFYUN_API_KEY = (CONFIG.xfyun && CONFIG.xfyun.apiKey) || 'your-xfyun-api-key-placeholder';

// =======================================
//
// ── 能力开关 ──────────────────────────────────────────────
// 本云函数在 Sprint 2 后被收窄为「云端能力提供者」，不再承担编排职责。
// 编排（意图识别 → 工具调度 → 降级）由前端 agent/core 负责。
//
//   action=knowledge  本地 knowledge.json 检索    → 零外部依赖、零费用（默认可用）
//   action=chat      DeepSeek LLM 推理            → 收费，默认关闭
//   action=tts       讯飞语音合成                  → 收费，默认关闭
//   action=clear     清除聊天记录                  → 本地数据库
//
// isServiceEnabled 同时校验 _enabled 标志与字段是否已脱离占位符形态，
// 任一不满足即视为未启用，调用方走本地降级路径。
const isDeepseekEnabled = appConfig.isServiceEnabled('deepseek')
const isXfyunEnabled = appConfig.isServiceEnabled('xfyun')



function loadKnowledgeBase() {
  try {
    const knowledgePath = path.join(__dirname, 'knowledge.json');
    if (!fs.existsSync(knowledgePath)) {
      console.warn('知识库文件不存在:', knowledgePath);
      return [];
    }
    
    const rawData = fs.readFileSync(knowledgePath, 'utf8');

    
    const sanitized = rawData.replace(/^\s*\/\/.*$/gm, '');
    const knowledge = JSON.parse(sanitized);
    const base = Array.isArray(knowledge.knowledge_base) ? knowledge.knowledge_base : [];

    
    const flat = base.flat(Infinity).filter(item => item && typeof item === 'object');
    return flat;
  } catch (e) {
    console.error('读取知识库失败:', e.message);
    return [];
  }
}


function searchKnowledge(question, knowledgeBase) {
  if (!question || !knowledgeBase.length) return '';
  
  const lowerQuestion = question.toLowerCase().trim();
  if (!lowerQuestion) return '';
  
  let bestMatch = '';
  // 修复：原实现用 Infinity 当「精确匹配」哨兵，导致后续关键词加权的
  // `matchCount > maxMatchScore` 在 Infinity 面前永远为 false，
  // 关键词加权路径实质失效。这里改用独立的命中级别标记。
  let bestLevel = 0;   // 0=无命中 1=关键词命中 2=包含匹配 3=精确匹配
  let bestScore = 0;   // 关键词命中数

  knowledgeBase.forEach(item => {
    if (!item.question || !item.answer) return;
    
    const questionVariants = item.question.split('||').map(q => q.toLowerCase().trim());
    
    questionVariants.forEach(variant => {
      if (!variant) return;
      
      // 精确匹配 —— 最高优先级，直接选定
      if (lowerQuestion === variant) {
        bestMatch = item.answer;
        bestLevel = 3;
        bestScore = 0;
        return;
      }
      
      // 包含匹配
      if (lowerQuestion.includes(variant) || variant.includes(lowerQuestion)) {
        if (bestLevel < 3) {
          bestMatch = item.answer;
          bestLevel = 2;
        }
        return;
      }
      
      // 关键词加权命中
      const questionKeywords = [...new Set(lowerQuestion.split(/\s+|，|。|？|！|、|：|；/))].filter(k => k.length > 0);
      const kbKeywords = [...new Set(variant.split(/\s+|，|。|？|！|、|：|；/))].filter(k => k.length > 0);
      
      if (questionKeywords.length === 0 || kbKeywords.length === 0) return;
      
      let matchCount = 0;
      kbKeywords.forEach(keyword => {
        if (questionKeywords.includes(keyword)) {
          matchCount++;
        }
      });
      
      // 关键词命中只在没有更高优先级命中时生效
      if (matchCount > 0 && bestLevel < 2 && matchCount > bestScore) {
        bestScore = matchCount;
        bestLevel = 1;
        bestMatch = item.answer;
      }
    });
  });

  return bestMatch;
}


async function callDeepSeek(messages) {
  try {
    const response = await uniCloud.httpclient.request(DEEPSEEK_API_URL, {
      method: 'POST',
      dataType: 'json',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      data: {
        model: 'deepseek-chat',
        messages: messages,
        stream: false,
        temperature: 0.0, 
        max_tokens: 500
      }
    });

    if (response.status === 200) {
      return { success: true, data: response.data };
    } else {
      console.error('DeepSeek API 返回错误:', response.status, response.data);
      return { success: false, error: response.data || `HTTP错误: ${response.status}` };
    }
  } catch (e) {
    console.error('DeepSeek API 调用异常:', e.message);
    return { success: false, error: `请求异常: ${e.message}` };
  }
}


function getXfyunWssUrl() {
  try {
    const host = 'tts-api.xfyun.cn';
    const date = new Date().toUTCString();
    const algorithm = 'hmac-sha256';
    const headers = 'host date request-line';
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, XFYUN_API_SECRET);
    const signature = CryptoJS.enc.Base64.stringify(signatureSha);
    const authorizationOrigin = `api_key="${XFYUN_API_KEY}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    return `wss://${host}/v2/tts?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;
  } catch (e) {
    console.error('生成讯飞TTS签名失败:', e.message);
    throw e;
  }
}


async function handleTTS(data) {
  if (!IS_AI_ENABLED) {
    return { code: 403, message: 'AI功能暂停服务' };
  }
  const { params } = data;
  if (!params || typeof params !== 'object') {
    return { code: 400, message: '参数格式错误，需要传入params对象' };
  }
  
  const { text } = params;
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return { code: 400, message: '缺少text参数或text为空' };
  }
  
  if (XFYUN_APPID === 'YOUR_APPID' || !XFYUN_APPID) {
    return { code: 500, message: '请配置有效的讯飞APPID' };
  }

  // 讯飞未启用时降级：不发起外部调用，返回 audio: null 与文本，
  // 由前端决定是否用可选 TTS 适配器播报。保证零配置可跑、零费用。
  if (!isXfyunEnabled) {
    console.log('[ai-agent] 讯飞 TTS 未启用，返回降级结果（audio=null）');
    return {
      code: 200,
      audio: null,
      text: text.trim(),
      degraded: true,
      source: 'tts-fallback',
      message: 'TTS 未启用，已降级为纯文本（前端可改用本地口型动画）'
    };
  }

  const wssUrl = getXfyunWssUrl();
  const WebSocket = require('ws');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wssUrl);
    let audioData = [];
    let timeoutTimer = null;

    timeoutTimer = setTimeout(() => {
      ws.close();
      resolve({ code: 500, message: 'TTS请求超时' });
    }, 30000);

    ws.on('open', () => {
      console.log('讯飞TTS WebSocket连接成功');
      const frame = {
        common: {
          app_id: XFYUN_APPID
        },
        business: {
          aue: 'lame',
          sfl: 1,
          auf: 'audio/L16;rate=16000',
          vcn: params.vcn || 'xiaoyan',
          speed: params.speed || 50,
          volume: params.volume || 50,
          pitch: params.pitch || 50,
          bgs: 0,
          tte: 'UTF8'
        },
        data: {
          status: 2,
          text: Buffer.from(text.trim()).toString('base64')
        }
      };
      ws.send(JSON.stringify(frame));
    });

    ws.on('message', (data, isBinary) => {
      try {
        const res = JSON.parse(data.toString());
        if (res.code !== 0) {
          console.error('讯飞TTS错误:', res);
          clearTimeout(timeoutTimer);
          resolve({ code: 500, message: `TTS错误: ${res.message || res.desc} (${res.code})` });
          return;
        }

        if (res.data && res.data.audio) {
          audioData.push(res.data.audio);
        }

        if (res.data && res.data.status === 2) {
          ws.close();
        }
      } catch (e) {
        console.error('解析TTS响应失败:', e.message);
      }
    });

    ws.on('close', () => {
      clearTimeout(timeoutTimer);
      if (audioData.length === 0) {
        resolve({ code: 500, message: '未获取到音频数据' });
        return;
      }
      
      const buffers = audioData.map(chunk => Buffer.from(chunk, 'base64'));
      const finalBuffer = Buffer.concat(buffers);
      const finalBase64 = finalBuffer.toString('base64');

      resolve({ code: 200, audio: finalBase64, message: 'TTS合成成功' });
    });

    ws.on('error', (err) => {
      clearTimeout(timeoutTimer);
      console.error('TTS WebSocket错误:', err.message);
      resolve({ code: 500, message: `WebSocket连接失败: ${err.message}` });
    });
  });
}


async function handleChat(uid, data) {
  console.log('--- AI Agent Chat Start ---');
  if (!IS_AI_ENABLED) {
    return { code: 403, message: 'AI功能暂停服务' };
  }
  console.log('UID:', uid || 'Guest');

  
  const { messages: currentMessages } = data;
  if (!currentMessages || !Array.isArray(currentMessages)) {
    return { code: 400, message: '参数错误：需要传入messages数组' };
  }

  
  
  const userMessage = [...currentMessages].reverse().find(m => m.role === 'user');
  if (!userMessage || !userMessage.content) {
    return { code: 400, message: '缺少用户问题' };
  }
  const userQuestion = userMessage.content.trim();

  
  const knowledgeBase = loadKnowledgeBase();
  const knowledgeContent = searchKnowledge(userQuestion, knowledgeBase);
  console.log('匹配到的知识库内容:', knowledgeContent || '无');

  
  if (knowledgeContent) {
    const directResult = {
      id: `kb_${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'knowledge-base-direct',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: knowledgeContent
          },
          finish_reason: 'stop'
        }
      ]
    };

    if (uid) {
      try {
        const db = uniCloud.database();
        await db.collection('ai-chat-history').doc(uid).set({
          user_id: uid,
          last_question: userQuestion,
          last_answer: knowledgeContent,
          updated_at: Date.now()
        });
      } catch (e) {
        console.error('保存聊天记录失败:', e.message);
      }
    }

    return { code: 200, result: directResult, message: '命中知识库并直出', source: 'knowledge-base' };
  }

  
  const incomingSystem = currentMessages.find(m => m.role === 'system');
  let baseSystemContent = incomingSystem ? incomingSystem.content : '';
  baseSystemContent = baseSystemContent.trim();

  
  // LLM 未配置时降级：不再硬调 DeepSeek，而是明确告知前端走本地规则路径。
  // 这保证默认路径零外部调用、零费用，且行为可预期。
  if (!isDeepseekEnabled) {
    console.log('[ai-agent] DeepSeek 未启用，返回降级状态（前端将走本地规则回答）');
    return {
      code: 200,
      source: 'fallback',
      degraded: true,
      message: 'LLM 未启用，已降级为本地知识库检索',
      result: {
        id: `fallback_${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'knowledge-base-fallback',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '这个问题我暂时没有查到对应的知识。你可以在「Agent 演示」页体验完整的工具编排能力。'
            },
            finish_reason: 'stop'
          }
        ]
      }
    };
  }

  
  // 多轮上下文：保留此前的对话历史，而非只取最后一条用户消息
  const history = currentMessages.filter(m => m.role === 'user' || m.role === 'assistant');
  const fullContext = [
    { role: 'system', content: baseSystemContent },
    ...history.slice(-10)
  ];

  console.log('最终发送的指令:', baseSystemContent || '无额外系统指令');
  console.log('用户问题:', userQuestion);
  console.log('上下文轮数:', fullContext.length);

  
  const res = await callDeepSeek(fullContext);

  if (res.success) {
    const aiReply = res.data.choices?.[0]?.message;
    if (!aiReply) {
      return { code: 500, message: 'AI返回格式错误', details: res.data };
    }

    
    if (uid) {
      try {
        const db = uniCloud.database();
        await db.collection('ai-chat-history').doc(uid).set({
          user_id: uid,
          last_question: userQuestion,
          last_answer: aiReply.content,
          updated_at: Date.now()
        });
      } catch (e) {
        console.error('保存聊天记录失败:', e.message);
      }
    }

    return { code: 200, result: res.data, message: '请求成功' };
  } else {
    console.error('DeepSeek API 调用失败:', res.error);
    return { code: 500, message: 'AI服务调用失败', details: res.error };
  }
}


async function handleClear(uid) {
  try {
    const db = uniCloud.database();
    await db.collection('ai-chat-history').doc(uid).remove();
    return { code: 200, message: '聊天记录已清空' };
  } catch (e) {
    console.error('清除聊天记录失败:', e.message);
    return { code: 500, message: '清除聊天记录失败', details: e.message };
  }
}


exports.main = async (event, context) => {
  try {
    const { action, data } = event;
    const uid = context.auth?.uid || event.uid || event.openid;

    if (!uid && action === 'clear') {
      return { code: 401, message: '清空记录需要用户ID' };
    }

    switch (action) {
      case 'checkStatus':
        return { code: 200, enable: IS_AI_ENABLED };
      case 'chat':
        return await handleChat(uid, data);
      case 'clear':
        return await handleClear(uid);
      case 'tts':
        return await handleTTS(data);
      default:
        return { code: 400, message: `未知的动作类型: ${action}` };
    }
  } catch (e) {
    console.error('云函数主流程异常:', e.message);
    return { code: 500, message: '服务器内部错误', details: e.message };
  }
};
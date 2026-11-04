'use strict'

/**
 * LLM 适配器（可选，默认不加载）
 *
 * ⚠️ 本文件**不会**被默认路径 import。
 *    agent/core/index.js 只在显式传入 options.llmAdapter 时才会 require 它，
 *    默认的 rule-adapter 路径完全不触碰本文件，也不需要任何 API Key。
 *
 * 接入方式
 * --------
 * 1. 在 uni-config-center 的 app-config 中配置 deepseek：
 *      { "deepseek": { "_enabled": true, "apiKey": "<你的 key>" } }
 * 2. 实现下面的 createAdapter(config) 返回一个适配器对象，
 *    它需要提供 classify(input) 与可选的 plan(input, options)：
 *
 *      const adapter = {
 *        async classify(input) {
 *          const res = await callLLM(input, '把用户问题归类到: user-stats / server-time / echo 之一，输出 JSON')
 *          return [{ intent: 'user-stats', score: 1, confidence: 0.9, matched: [] }]
 *        }
 *      }
 *
 * 3. 在调用处显式启用：
 *      runAgent('我登录了几次', { llmAdapter: require('./agent/adapters/llm-adapter').createAdapter() })
 *
 * 设计要点
 * --------
 * 适配器契约只有两个方法（classify / plan），因此规则适配器与 LLM 适配器
 * 可以互换，编排层不需要关心底下是规则还是模型 —— 这是「可插拔适配器」的意义。
 *
 * 关键约束：LLM 只用于**意图分类**，不用于生成最终答案。
 * 最终答案永远由工具的真实返回值聚合而成 —— 这样即使模型判断错了意图，
 * 也不会凭空编造事实，只是调用了错误的工具，而 trace 会记录下这个错误。
 */

const DEFAULT_MODEL = 'deepseek-chat'
const DEFAULT_API_URL = 'https://api.deepseek.com/v1/chat/completions'

/** 供 LLM 参考的可用意图清单 */
const INTENT_HINT = [
	'user-stats —— 查询当前用户的登录次数、注册天数、最近登录时间',
	'server-time —— 获取当前服务器时间',
	'echo —— 回显一段文本（调试用）'
].join('\n')

/**
 * 从 app-config 读取 LLM 配置
 * @returns {Object|null} 配置对象；未启用时返回 null
 */
function loadConfig () {
	const candidates = ['app-config', '../common/app-config']
	for (const id of candidates) {
		try {
			const cfg = require(id).getConfig()
			const deepseek = cfg.deepseek || {}
			if (deepseek._enabled === true &&
				typeof deepseek.apiKey === 'string' &&
				deepseek.apiKey.indexOf('-placeholder') === -1) {
				return deepseek
			}
			return null
		} catch (e) {
			// 尝试下一个候选路径
		}
	}
	return null
}

/**
 * 调用 LLM，返回文本内容
 * @param {string} prompt
 * @param {Object} config
 * @returns {Promise<string>}
 */
async function callLLM (prompt, config) {
	const response = await uniCloud.httpclient.request(config.apiUrl || DEFAULT_API_URL, {
		method: 'POST',
		dataType: 'json',
		timeout: 30000,
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${config.apiKey}`
		},
		data: {
			model: config.model || DEFAULT_MODEL,
			messages: [{ role: 'user', content: prompt }],
			stream: false,
			temperature: 0
		}
	})

	if (response.status !== 200) {
		throw new Error(`LLM 请求失败: HTTP ${response.status}`)
	}
	const choice = response.data && response.data.choices && response.data.choices[0]
	if (!choice || !choice.message) {
		throw new Error('LLM 返回格式错误')
	}
	return choice.message.content || ''
}

/**
 * 创建 LLM 适配器
 *
 * @param {Object} options
 * @param {Object} options.config 覆盖配置（默认从 app-config 读取）
 * @returns {Object} 适配器对象，实现 classify(input)
 */
function createAdapter (options = {}) {
	const config = options.config || loadConfig()

	if (!config) {
		throw new Error(
			'LLM 适配器未启用。请在 uni-config-center 的 app-config 中设置 ' +
			'deepseek._enabled = true 并填写 apiKey。默认路径请使用 rule-adapter。'
		)
	}

	return {
		name: 'llm-adapter',

		/**
		 * 意图分类：让模型输出 JSON 数组
		 * @param {string} input
		 * @returns {Promise<Array<{intent: string, score: number, confidence: number, matched: Array<string>}>>}
		 */
		async classify (input) {
			const prompt = [
				'请把用户的问题归类到下面已有的意图之一：',
				INTENT_HINT,
				'',
				'只输出 JSON 数组，不要任何解释文字。格式：',
				'[{"intent":"user-stats","score":1,"confidence":0.9,"matched":[]}]',
				'',
				'若无法归类，输出 []。',
				'',
				'用户问题：' + input
			].join('\n')

			const raw = await callLLM(prompt, config)
			const text = raw.replace(/```json|```/g, '').trim()

			let parsed
			try {
				parsed = JSON.parse(text)
			} catch (e) {
				throw new Error('LLM 返回的内容不是合法 JSON: ' + text.slice(0, 100))
			}

			if (!Array.isArray(parsed)) return []

			// 归一化置信度到 [0,1]
			return parsed
				.filter(p => p && typeof p.intent === 'string')
				.map(p => ({
					intent: p.intent,
					score: typeof p.score === 'number' ? p.score : 1,
					confidence: typeof p.confidence === 'number'
						? Math.max(0, Math.min(1, p.confidence))
						: 0.5,
					matched: Array.isArray(p.matched) ? p.matched : []
				}))
				.sort((a, b) => b.confidence - a.confidence)
		}
	}
}

module.exports = {
	createAdapter,
	loadConfig,
	INTENT_HINT,
	DEFAULT_MODEL,
	DEFAULT_API_URL
}

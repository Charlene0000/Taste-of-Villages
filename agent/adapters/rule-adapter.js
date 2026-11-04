'use strict'

/**
 * 规则匹配适配器（自研，零外部依赖）
 *
 * 默认适配器。不 import 任何第三方库，纯 JS 实现。
 *
 * 职责：
 *   1. 意图识别 —— 关键词加权打分
 *   2. 置信度评估 —— 最高分低于阈值时，交给 fallback 降级
 *
 * 关键词加权策略：
 *   每个意图声明若干关键词与权重，命中即累加；
 *   命中关键词占该意图全部关键词的比例作为覆盖率加成。
 */

const INTENTS = [
	{
		intent: 'user-stats',
		keywords: [
			{ word: '登录', weight: 3 },
			{ word: '登陆', weight: 3 },
			{ word: '登入', weight: 3 },
			{ word: '几次', weight: 2 },
			{ word: '多少次', weight: 2 },
			{ word: '注册', weight: 2 },
			{ word: '天数', weight: 2 },
			{ word: '多少天', weight: 2 },
			{ word: '账号', weight: 1 },
			{ word: '账户', weight: 1 },
			{ word: '统计', weight: 1 }
		]
	},
	{
		intent: 'server-time',
		keywords: [
			{ word: '几点', weight: 3 },
			{ word: '时间', weight: 3 },
			{ word: '现在', weight: 2 },
			{ word: '当前', weight: 2 },
			{ word: '服务器', weight: 2 },
			{ word: '时刻', weight: 2 },
			{ word: '日期', weight: 1 }
		]
	},
	{
		intent: 'echo',
		keywords: [
			{ word: '回显', weight: 3 },
			{ word: 'echo', weight: 3 },
			{ word: '测试', weight: 1 },
			{ word: '调试', weight: 2 }
		]
	}
]

/**
 * 对输入做意图分类
 *
 * @param {string} input 用户输入
 * @returns {Array<{intent: string, score: number, confidence: number, matched: Array<string>}>}
 *          按 score 降序
 */
function classify (input) {
	const text = typeof input === 'string' ? input.toLowerCase() : ''
	if (!text) return []

	return INTENTS.map(intent => {
		let score = 0
		const matched = []

		for (const kw of intent.keywords) {
			if (text.indexOf(kw.word.toLowerCase()) !== -1) {
				score += kw.weight
				matched.push(kw.word)
			}
		}

		// 覆盖率加成：命中的关键词占该意图关键词总数的比例
		const coverage = intent.keywords.length > 0 ? matched.length / intent.keywords.length : 0
		const finalScore = score + coverage * 2

		// 置信度归一到 [0,1]：满分约 8（最高权重 3 + 覆盖率加成 2）
		const confidence = Math.min(1, finalScore / 8)

		return {
			intent: intent.intent,
			score: finalScore,
			confidence: Number(confidence.toFixed(4)),
			matched
		}
	}).filter(r => r.score > 0).sort((a, b) => b.score - a.score)
}

/**
 * 从意图映射到工具调用序列
 *
 * 支持多意图 → 多工具串行。
 * 「我登录了几次现在几点」这类复合提问会同时命中 user-stats 与 server-time，
 * 按分类得分顺序串行执行。
 *
 * @param {string} input
 * @param {Object} options
 * @param {number} options.threshold 置信度阈值，低于此值不产出工具序列
 * @returns {{ calls: Array<{tool: string, args: Object}>, matches: Array }}
 */
function plan (input, options = {}) {
	const threshold = typeof options.threshold === 'number' ? options.threshold : 0.3
	const matches = classify(input)

	// 取出所有达到阈值的意图
	const accepted = matches.filter(m => m.confidence >= threshold)

	if (!accepted.length) {
		return { calls: [], matches, confident: false }
	}

	// 构造工具调用序列（按得分降序串行）
	const calls = accepted.map(m => ({
		tool: m.intent,
		args: extractArgs(input, m.intent),
		confidence: m.confidence
	}))

	return { calls, matches, confident: true }
}

/**
 * 从原始输入中抽取工具参数（规则抽取，够用即可）
 */
function extractArgs (input, intent) {
	const text = typeof input === 'string' ? input : ''

	switch (intent) {
		case 'echo': {
			// 去掉引导词后的剩余部分
			const m = text.match(/(?:回显|echo)\s*[:：]?\s*(.+)/i)
			return { message: m ? m[1].trim() : text.trim() }
		}
		case 'server-time': {
			const readable = /几点|时间|日期/.test(text)
			return { format: readable ? 'readable' : 'iso' }
		}
		case 'user-stats': {
			return { includeDevices: /设备|登录设备/.test(text) }
		}
		default:
			return {}
	}
}

module.exports = {
	classify,
	plan,
	INTENTS
}

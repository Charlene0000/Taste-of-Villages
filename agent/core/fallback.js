'use strict'

/**
 * 降级策略（自研）
 *
 * 设计动机
 * --------
 * 规则驱动的 Agent 在未知输入下最容易犯的错是「硬猜一个工具并返回看似合理的结果」——
 * 用户问「今天天气怎么样」，Agent 却不动声色地返回了服务器时间，
 * 看起来答非所问却没有任何错误提示。
 *
 * 机制
 * ----
 * 当 planner 判定置信度不足时，fallback 不猜测，而是返回一份**能力清单**：
 * 我能做哪些事、以及你该怎么问。
 *
 * 这样做的好处：
 *   - 行为可预期：低置信度永远走同一条路径
 *   - 不会返回错误工具结果（可被单测断言）
 *   - 对用户有建设性：把「我不知道」变成「你可以这样问我」
 */

const registry = require('../tools/index')

/**
 * 生成能力清单
 *
 * @param {Object} options
 * @param {Array} options.matches 规划阶段得到的候选意图（可能为空）
 * @param {string} options.reason  降级原因
 * @returns {{
 *   ok: boolean,
 *   type: string,
 *   message: string,
 *   capabilities: Array<{name: string, description: string, required: Array<string>}>,
 *   suggestions: Array<string>,
 *   matches: Array
 * }}
 */
function capabilityList (options = {}) {
	const { matches = [], reason = 'low-confidence' } = options

	// 从工具注册表读取真实能力，保证清单与实际可用工具一致
	const capabilities = registry.listCapabilities()

	const suggestions = capabilities.map(c => {
		const req = c.required && c.required.length ? `（需要参数：${c.required.join(', ')}）` : ''
		return `${c.description}${req}`
	})

	const reasonText = {
		'no-intent-matched': '我没太理解你的问题。',
		'low-confidence': '我不太确定你想问什么。',
		'empty-input': '你还没输入内容。'
	}[reason] || '我不太确定你想问什么。'

	return {
		ok: true,
		type: 'fallback',
		message: `${reasonText}不过我可以做这些事情：`,
		capabilities,
		suggestions,
		matches
	}
}

/**
 * 降级文案（带具体建议的完整回答）
 */
function reply (options = {}) {
	const list = capabilityList(options)
	const lines = list.suggestions.map((s, i) => `  ${i + 1}. ${s}`)
	return {
		...list,
		answer: [
			list.message,
			...lines,
			'',
			'试试这样问：「我登录了几次」「现在几点」「回显 hello」'
		].join('\n')
	}
}

module.exports = {
	capabilityList,
	reply
}

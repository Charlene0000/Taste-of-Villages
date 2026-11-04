'use strict'

/**
 * 意图识别与任务规划（自研）
 *
 * 两阶段规划：
 *   阶段一 —— 意图分类：借助适配器对输入打分，得到候选意图与置信度
 *   阶段二 —— 工具序列规划：把意图映射为工具调用序列，支持单工具与多工具串行
 *
 * 置信度阈值机制：
 *   当最高置信度低于 threshold 时，planner 不产出任何工具序列，
 *   转由 fallback 返回能力清单 —— 这是「Agent 在未知输入下行为可预期」的关键。
 *   绝不在低置信度下硬猜一个工具并返回看似合理的结果。
 */

const ruleAdapter = require('../adapters/rule-adapter')

/** 默认置信度阈值 */
const DEFAULT_THRESHOLD = 0.3

/**
 * 第一阶段：意图分类
 *
 * @param {string} input
 * @param {Object} adapter 适配器，需实现 classify(input)
 * @returns {Array<{intent: string, score: number, confidence: number, matched: Array<string>}>}
 */
function classify (input, adapter = ruleAdapter) {
	if (!adapter || typeof adapter.classify !== 'function') {
		throw new Error('适配器必须实现 classify(input)')
	}
	return adapter.classify(input) || []
}

/**
 * 第二阶段：规划工具调用序列
 *
 * @param {string} input
 * @param {Object} options
 * @param {Object} options.adapter   意图适配器，默认 rule-adapter
 * @param {number} options.threshold 置信度阈值
 * @returns {{
 *   confident: boolean,
 *   calls: Array<{tool: string, args: Object, confidence: number}>,
 *   matches: Array,
 *   bestConfidence: number,
 *   reason?: string
 * }}
 */
function plan (input, options = {}) {
	const adapter = options.adapter || ruleAdapter
	const threshold = typeof options.threshold === 'number' ? options.threshold : DEFAULT_THRESHOLD

	const text = typeof input === 'string' ? input.trim() : ''
	if (!text) {
		return {
			confident: false,
			calls: [],
			matches: [],
			bestConfidence: 0,
			reason: 'empty-input'
		}
	}

	// 阶段一：意图分类
	const matches = classify(text, adapter)
	const bestConfidence = matches.length ? matches[0].confidence : 0

	// 置信度不足 → 不产出工具序列，交由 fallback 处理
	if (!matches.length || bestConfidence < threshold) {
		return {
			confident: false,
			calls: [],
			matches,
			bestConfidence,
			reason: matches.length ? 'low-confidence' : 'no-intent-matched'
		}
	}

	// 阶段二：工具序列规划
	const planned = adapter.plan ? adapter.plan(text, { threshold }) : null
	let calls = []

	if (planned && Array.isArray(planned.calls)) {
		calls = planned.calls
	} else {
		// 适配器未提供 plan() 时，退化为「只取最高分意图」
		calls = [{
			tool: matches[0].intent,
			args: {},
			confidence: matches[0].confidence
		}]
	}

	// 过滤掉置信度不足的次要意图，避免误触发工具
	const filtered = calls.filter(c => (c.confidence === undefined) || c.confidence >= threshold)

	if (!filtered.length) {
		return {
			confident: false,
			calls: [],
			matches,
			bestConfidence,
			reason: 'low-confidence'
		}
	}

	return {
		confident: true,
		calls: filtered,
		matches,
		bestConfidence
	}
}

module.exports = {
	plan,
	classify,
	DEFAULT_THRESHOLD
}

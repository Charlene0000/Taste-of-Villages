'use strict'

/**
 * 工具调度与结果聚合（自研）
 *
 * 职责：
 *   1. 按规划序列串行执行工具
 *   2. 调用前做参数 Schema 校验 —— 校验失败返回结构化错误，不抛异常
 *   3. 捕获工具内部异常，转换为结构化错误
 *   4. 聚合多个工具的结果为一段可读回答
 *   5. 记录每个工具的执行耗时，供 trace 可观测
 */

const registry = require('../tools/index')

/**
 * 执行单个工具
 *
 * @param {string} name 工具名
 * @param {Object} args 参数
 * @param {Object} context 上下文
 * @returns {Promise<{ok: boolean, tool: string, result?: Object, error?: Object, durationMs: number}>}
 */
async function runTool (name, args, context = {}) {
	const startedAt = Date.now()

	// 工具是否存在
	const tool = registry.get(name)
	if (!tool) {
		return {
			ok: false,
			tool: name,
			durationMs: Date.now() - startedAt,
			error: {
				code: 'TOOL_NOT_FOUND',
				message: `未注册的工具: ${name}`
			}
		}
	}

	// 参数校验 —— 失败返回结构化错误，不抛异常
	const validation = registry.validate(name, args)
	if (!validation.valid) {
		return {
			ok: false,
			tool: name,
			durationMs: Date.now() - startedAt,
			error: {
				code: 'INVALID_PARAMS',
				message: `工具 ${name} 参数校验失败`,
				details: validation.errors
			}
		}
	}

	// 实际执行 —— 捕获内部异常
	try {
		const result = await tool.handler(validation.valid ? args : {}, context)
		return {
			ok: true,
			tool: name,
			result,
			durationMs: Date.now() - startedAt
		}
	} catch (e) {
		return {
			ok: false,
			tool: name,
			durationMs: Date.now() - startedAt,
			error: {
				code: 'TOOL_EXECUTION_ERROR',
				message: e && e.message ? e.message : '工具执行异常',
				details: e && e.stack ? e.stack.split('\n').slice(0, 3) : undefined
			}
		}
	}
}

/**
 * 串行执行工具序列并聚合结果
 *
 * @param {Array<{tool: string, args: Object, confidence?: number}>} calls
 * @param {Object} context
 * @returns {Promise<{
 *   ok: boolean,
 *   results: Array,
 *   answer: string,
 *   totalDurationMs: number
 * }>}
 */
async function run (calls, context = {}) {
	const startedAt = Date.now()
	const results = []

	for (const call of calls || []) {
		const r = await runTool(call.tool, call.args || {}, context)
		results.push({
			tool: call.tool,
			args: call.args || {},
			confidence: call.confidence,
			ok: r.ok,
			result: r.result,
			error: r.error,
			durationMs: r.durationMs
		})
	}

	return {
		ok: results.every(r => r.ok),
		results,
		answer: aggregate(results),
		totalDurationMs: Date.now() - startedAt
	}
}

/**
 * 聚合多个工具结果为一段可读回答
 *
 * @param {Array} results
 * @returns {string}
 */
function aggregate (results) {
	const succeeded = (results || []).filter(r => r.ok && r.result)
	if (!succeeded.length) {
		const failed = (results || []).filter(r => !r.ok)
		if (!failed.length) return ''
		return '工具执行未产生结果：' + failed.map(f => {
			const detail = f.error && f.error.details ? '（' + f.error.details.map(d => d.message).join('；') + '）' : ''
			return `${f.tool} ${f.error ? f.error.message : '执行失败'}${detail}`
		}).join('；')
	}

	return succeeded.map(r => {
		const msg = r.result && r.result.message ? r.result.message : JSON.stringify(r.result)
		return msg
	}).join('\n')
}

module.exports = {
	run,
	runTool,
	aggregate
}

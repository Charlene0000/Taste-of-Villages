'use strict'

/**
 * Agent 编排层入口（自研）
 *
 * 一次 runAgent 调用的完整链路：
 *
 *   输入
 *    → planner.plan()        两阶段规划：意图分类 → 工具序列
 *    → 置信度足够？
 *       ├─ 是 → executor.run()   串行执行 + 参数校验 + 结果聚合
 *       └─ 否 → fallback.reply() 返回能力清单（不猜测、不胡编）
 *    → memory.push()         写入短期上下文
 *    → trace.push()          写入环形缓冲区，供前端查看
 *
 * 默认路径（rule-adapter）零外部依赖，不需要任何 API Key。
 */

const planner = require('./planner')
const executor = require('./executor')
const fallback = require('./fallback')
const memoryModule = require('./memory')
const traceModule = require('./trace')
const registry = require('../tools/index')

// 注册内置工具（默认工具集）
registry.registerAll([
	require('../tools/user-stats'),
	require('../tools/server-time'),
	require('../tools/echo')
])

/** 全局 trace 环形缓冲区（保留最近 20 条） */
const traceBuffer = new traceModule.TraceBuffer({ capacity: traceModule.DEFAULT_CAPACITY })

/** 全局默认 memory 实例 */
let defaultMemory = new memoryModule.Memory()

/**
 * 覆盖全局 memory（前端可在 onLoad 时注入带持久化的实例）
 */
function setMemory (memory) {
	defaultMemory = memory
	return defaultMemory
}

function getMemory () {
	return defaultMemory
}

/**
 * 获取最近的 trace（供前端「Agent 演示」页展示）
 * @param {number} limit
 */
function getTraces (limit) {
	return traceBuffer.list(limit)
}

/**
 * 清空 trace
 */
function clearTraces () {
	traceBuffer.clear()
}

/**
 * 执行一次 Agent 任务
 *
 * @param {string} input 用户输入
 * @param {Object} context 上下文（传给工具 handler）
 * @param {Object} context.user  当前用户信息
 * @param {Object} options
 * @param {Object} options.adapter    意图适配器，默认 rule-adapter
 * @param {number} options.threshold  置信度阈值
 * @param {Object} options.memory     记忆实例，默认全局实例
 * @param {boolean} options.recordMemory 是否写入记忆，默认 true
 * @returns {Promise<{
 *   ok: boolean,
 *   type: string,
 *   answer: string,
 *   plan: Object,
 *   results: Array,
 *   fallback: Object|null,
 *   trace: Object,
 *   durationMs: number
 * }>}
 */
async function runAgent (input, context = {}, options = {}) {
	const startedAt = Date.now()
	const memory = options.memory || defaultMemory

	// 第一阶段 + 第二阶段：规划
	const plan = planner.plan(input, {
		adapter: options.adapter,
		threshold: options.threshold
	})

	let execution = null
	let fb = null
	let type = 'tool-result'

	if (!plan.confident) {
		// 置信度不足 → 降级为能力清单，绝不猜测工具
		type = 'fallback'
		fb = fallback.reply({
			matches: plan.matches,
			reason: plan.reason
		})
	} else {
		// 串行执行工具并聚合结果
		execution = await executor.run(plan.calls, context)
	}

	const answer = execution ? execution.answer : fb.answer

	// 写入记忆
	if (options.recordMemory !== false && memory && typeof memory.push === 'function') {
		try {
			memory.push(input, answer)
		} catch (e) {
			// 记忆写入失败不影响主流程
		}
	}

	// 生成并写入 trace
	const trace = traceModule.buildTrace({
		input,
		plan,
		execution,
		fallback: fb,
		durationMs: Date.now() - startedAt
	})
	traceBuffer.push(trace)

	return {
		ok: true,
		type,
		answer,
		plan: {
			confident: plan.confident,
			reason: plan.reason || null,
			bestConfidence: plan.bestConfidence,
			matches: plan.matches,
			calls: plan.calls
		},
		results: execution ? execution.results : [],
		fallback: fb,
		trace,
		durationMs: trace.durationMs
	}
}

module.exports = {
	runAgent,
	getTraces,
	clearTraces,
	setMemory,
	getMemory,
	traceBuffer,
	// 子模块一并导出，便于单测与调试
	planner,
	executor,
	fallback,
	memory: memoryModule,
	trace: traceModule,
	registry
}

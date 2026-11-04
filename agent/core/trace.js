'use strict'

/**
 * 执行轨迹（自研，可观测性）
 *
 * 每次 runAgent 调用生成一条 trace，记录：
 *   输入 → 规划结果 → 每个工具的执行耗时 → 最终输出
 *
 * 存储：内存环形缓冲区，保留最近 N 条（默认 20）。
 * 环形缓冲的实现：写满后覆盖最旧的一条，内存占用恒定。
 *
 * 为什么值得做：
 *   「AI 回答得不对」是最难排查的问题类型。有了 trace，
 *   可以直接看到是「意图识别错了」还是「工具参数错了」还是「工具本身抛异常」，
 *   而不是只能对着最终输出猜测。
 */

/** 默认容量 */
const DEFAULT_CAPACITY = 20

class TraceBuffer {
	/**
	 * @param {Object} options
	 * @param {number} options.capacity 保留条数
	 */
	constructor (options = {}) {
		this.capacity = typeof options.capacity === 'number' ? options.capacity : DEFAULT_CAPACITY
		this.items = []
		this._seq = 0
	}

	/**
	 * 写入一条 trace
	 * @param {Object} trace
	 * @returns {Object} 写入的 trace（含 id 与 at）
	 */
	push (trace) {
		this._seq++
		const entry = Object.assign({
			id: `trace_${this._seq}`,
			at: Date.now()
		}, trace)

		this.items.push(entry)

		// 环形覆盖：超出容量时丢弃最旧的
		if (this.items.length > this.capacity) {
			this.items.splice(0, this.items.length - this.capacity)
		}

		return entry
	}

	/**
	 * 读取最近 N 条（最新的在前）
	 * @param {number} limit
	 */
	list (limit) {
		const items = this.items.slice().reverse()
		if (typeof limit === 'number' && limit > 0) return items.slice(0, limit)
		return items
	}

	/**
	 * 按 id 查找
	 */
	get (id) {
		return this.items.find(t => t.id === id) || null
	}

	/** 清空 */
	clear () {
		this.items = []
	}

	/** 条数 */
	size () {
		return this.items.length
	}
}

/**
 * 构造一条 trace
 * @param {Object} params
 */
function buildTrace (params = {}) {
	const {
		input = '',
		plan = null,
		execution = null,
		fallback = null,
		durationMs = 0
	} = params

	return {
		input,
		planned: plan ? {
			confident: plan.confident,
			reason: plan.reason || null,
			bestConfidence: plan.bestConfidence,
			matches: plan.matches || [],
			calls: (plan.calls || []).map(c => ({ tool: c.tool, args: c.args, confidence: c.confidence }))
		} : null,
		steps: execution ? (execution.results || []).map(r => ({
			tool: r.tool,
			args: r.args,
			ok: r.ok,
			durationMs: r.durationMs,
			error: r.error || null
		})) : [],
		fallback: fallback ? {
			type: fallback.type,
			message: fallback.message,
			capabilities: fallback.capabilities
		} : null,
		answer: execution ? execution.answer : (fallback ? fallback.answer : ''),
		durationMs
	}
}

module.exports = {
	TraceBuffer,
	buildTrace,
	DEFAULT_CAPACITY
}

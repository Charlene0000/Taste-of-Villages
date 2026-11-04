'use strict'

/**
 * 短期对话上下文（自研）
 *
 * 作用：解决原始 ai-agent 云函数的「无多轮记忆」问题
 *      （它只取最后一条 user message，每轮独立，上文全部丢失）。
 *
 * 存储策略：
 *   - 内存为主，默认保留最近 N 轮（默认 10）
 *   - 可选持久化：传入 storage 适配器（uni.setStorageSync / uni.getStorageSync）
 *     即可跨冷启动保留
 *
 * 设计取舍：
 *   不做向量检索、不做摘要压缩 —— 在本项目的对话规模（单轮问 AI 美食向导）
 *   下，简单的滑动窗口已经足够，且行为完全可预期、可单测。
 */

/** 默认保留轮数 */
const DEFAULT_MAX_TURNS = 10

class Memory {
	/**
	 * @param {Object} options
	 * @param {number} options.maxTurns   保留的最大轮数
	 * @param {Object} options.storage    持久化适配器，需实现 getItem/setItem
	 * @param {string} options.namespace  持久化命名空间（多用户隔离）
	 */
	constructor (options = {}) {
		this.maxTurns = typeof options.maxTurns === 'number' ? options.maxTurns : DEFAULT_MAX_TURNS
		this.storage = options.storage || null
		this.namespace = options.namespace || 'default'
		this.turns = []
		this._load()
	}

	/** 持久化 key */
	get _key () {
		return `agent-memory:${this.namespace}`
	}

	_load () {
		if (!this.storage || typeof this.storage.getItem !== 'function') return
		try {
			const raw = this.storage.getItem(this._key)
			if (raw) {
				const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
				if (Array.isArray(parsed)) this.turns = parsed.slice(-this.maxTurns)
			}
		} catch (e) {
			// 持久化不可用时降级为纯内存，不影响主流程
			this.turns = []
		}
	}

	_save () {
		if (!this.storage || typeof this.storage.setItem !== 'function') return
		try {
			this.storage.setItem(this._key, JSON.stringify(this.turns))
		} catch (e) {
			// 忽略持久化失败
		}
	}

	/**
	 * 记录一轮对话
	 * @param {string} user 用户输入
	 * @param {string} assistant 助手回答
	 */
	push (user, assistant) {
		this.turns.push({
			user: typeof user === 'string' ? user : '',
			assistant: typeof assistant === 'string' ? assistant : '',
			at: Date.now()
		})
		// 滑动窗口裁剪
		if (this.turns.length > this.maxTurns) {
			this.turns = this.turns.slice(-this.maxTurns)
		}
		this._save()
	}

	/**
	 * 读取最近若干轮的上下文
	 * @param {number} limit 取最近几轮，默认全部
	 * @returns {Array<{user: string, assistant: string, at: number}>}
	 */
	get (limit) {
		if (typeof limit === 'number' && limit > 0) {
			return this.turns.slice(-limit)
		}
		return this.turns.slice()
	}

	/**
	 * 把历史拼成一段文本，供 LLM 适配器使用
	 * @param {number} limit
	 * @returns {string}
	 */
	toText (limit) {
		return this.get(limit).map(t => `用户: ${t.user}\n助手: ${t.assistant}`).join('\n')
	}

	/**
	 * 是否存在上文（供 planner 做「上下文补全」判断）
	 */
	hasHistory () {
		return this.turns.length > 0
	}

	/** 清空 */
	clear () {
		this.turns = []
		this._save()
	}

	/** 当前轮数 */
	size () {
		return this.turns.length
	}
}

module.exports = {
	Memory,
	DEFAULT_MAX_TURNS
}

'use strict'

/**
 * AvatarController —— 数字人播报控制器（自研）
 *
 * 对外暴露三个方法：
 *   speak(text)        开始播报
 *   stop()             立即打断并复位
 *   setExpression(name) 切换表情
 *
 * 打断语义（覆盖式，非队列式）
 * --------------------------------
 * 连续调用 speak() 时，**新调用会打断旧调用**，不排队。
 *
 * 理由：数字人是对话反馈，用户再次说话意味着他不想听上一句。
 * 排队会导致「我问三句，它慢慢答三句」的滞后感，反而更糟。
 *
 * 代价：若业务确实需要排队（如依次播报多条通知），
 *      可通过 options.queue = true 开启排队模式。
 *
 * 播放循环：requestAnimationFrame 驱动，按时间轴从口型序列采样，
 *           到达末尾自动闭口并停止循环。
 */

const lipsync = require('../bridge/lipsync')

class AvatarController {
	/**
	 * @param {Object} options
	 * @param {Object} options.avatar    CanvasAvatar 实例
	 * @param {Object} options.tts       TTS 适配器，需实现 speak(text, handlers) / stop()
	 * @param {Function} options.requestFrame 注入 rAF（便于测试），默认用全局 requestAnimationFrame
	 * @param {Function} options.cancelFrame 注入 cancelAnimationFrame
	 * @param {number} options.speed     口型速度倍率
	 * @param {boolean} options.queue    是否启用排队模式（默认 false = 覆盖式）
	 */
	constructor (options = {}) {
		this.avatar = options.avatar || null
		this.tts = options.tts || null
		this.speed = typeof options.speed === 'number' && options.speed > 0 ? options.speed : 1
		this.queueMode = options.queue === true

		this._requestFrame = options.requestFrame ||
			(typeof requestAnimationFrame !== 'undefined'
				? requestAnimationFrame.bind(globalThis)
				: (cb) => setTimeout(() => cb(Date.now()), 16))
		this._cancelFrame = options.cancelFrame ||
			(typeof cancelAnimationFrame !== 'undefined'
				? cancelAnimationFrame.bind(globalThis)
				: (id) => clearTimeout(id))

		/** 当前口型帧序列 */
		this.frames = []
		/** 播放起始时间戳 */
		this.startedAt = 0
		/** rAF 句柄 */
		this._rafId = null
		/** 当前是否在播报 */
		this.speaking = false
		/** 排队等待的文本 */
		this._queue = []
		/** 状态变化回调 */
		this.onStateChange = options.onStateChange || null
	}

	/**
	 * 开始播报
	 * @param {string} text 要说的文本
	 * @param {Object} options
	 * @param {string} options.expression 播报时的表情
	 * @returns {boolean} 是否成功开始
	 */
	speak (text, options = {}) {
		if (typeof text !== 'string' || !text.trim()) return false

		if (this.queueMode) {
			// 排队模式：正在播报时入队
			if (this.speaking) {
				this._queue.push({ text, options })
				return true
			}
		} else {
			// 覆盖模式：打断当前播报
			// 先把状态置为 false 再启动新的，让 onStateChange 能观察到
			// 「停 → 启」这一真实语义（而不是被 _setState 的去重吞掉）。
			if (this.speaking) {
				this._interrupt()
				this._setState(false)
			}
		}

		this._start(text, options)
		return true
	}

	/**
	 * 立即停止播报并复位口型
	 */
	stop () {
		this._interrupt()
		this._queue = []
		this._setState(false)
	}

	/**
	 * 切换表情
	 * @param {string} name neutral / happy / thinking / surprised
	 * @returns {boolean} 是否设置成功
	 */
	setExpression (name) {
		if (!this.avatar || typeof this.avatar.setExpression !== 'function') return false
		return this.avatar.setExpression(name)
	}

	/**
	 * 实际启动一次播报
	 */
	_start (text, options = {}) {
		this.frames = lipsync.build(text, { speed: this.speed })
		this.startedAt = Date.now()

		if (options.expression && this.avatar) {
			this.avatar.setExpression(options.expression)
		}

		// 调用 TTS 适配器（默认 noop，只做口型不出声）
		if (this.tts && typeof this.tts.speak === 'function') {
			try {
				this.tts.speak(text, {
					onStart: () => {},
					onEnd: () => {}
				})
			} catch (e) {
				// TTS 失败不影响口型动画
				console.warn('[avatar-controller] TTS 调用失败:', e && e.message)
			}
		}

		this._setState(true)
		this._tick()
	}

	/**
	 * 打断当前播报 —— 只清理内部资源，不改对外状态
	 *
	 * 对外状态统一由 _setState 维护，这样 onStateChange 回调
	 * 一定能看到状态变化（曾因这里直接改 speaking 导致回调漏发）。
	 */
	_interrupt () {
		if (this._rafId !== null) {
			this._cancelFrame(this._rafId)
			this._rafId = null
		}
		this.frames = []

		// 口型复位
		if (this.avatar && typeof this.avatar.setMouthOpenY === 'function') {
			this.avatar.setMouthOpenY(0)
		}

		// 停止音频
		if (this.tts && typeof this.tts.stop === 'function') {
			try {
				this.tts.stop()
			} catch (e) {
				// 忽略
			}
		}
	}

	/**
	 * 结束当前播报（播完或被打断时统一走这里）
	 *
	 * 注意：必须通过 _setState 更新状态，否则 onStateChange 回调
	 * 不会收到 speaking=false —— 这是实际踩过的坑：
	 * 打断路径直接改 this.speaking 会绕过状态通知。
	 */
	_finish () {
		this._interrupt()
		this._setState(false)

		// 队列模式下继续播下一条
		if (this.queueMode && this._queue.length) {
			const next = this._queue.shift()
			this._start(next.text, next.options)
		}
	}

	/**
	 * rAF 循环：按时间轴采样口型
	 */
	_tick = () => {
		const elapsed = Date.now() - this.startedAt

		if (this.avatar) {
			const value = lipsync.sampleAt(this.frames, elapsed)
			this.avatar.setMouthOpenY(value)
			if (typeof this.avatar.update === 'function') {
				this.avatar.update(16)
			}
			if (typeof this.avatar.render === 'function') {
				this.avatar.render()
			}
		}

		const duration = lipsync.totalDuration(this.frames)

		if (elapsed >= duration) {
			// 播完，闭口停止
			this._rafId = null
			this._finish()
			return
		}

		this._rafId = this._requestFrame(this._tick)
	}

	/**
	 * 更新状态并通知外部
	 */
	_setState (speaking) {
		if (this.speaking === speaking) return
		this.speaking = speaking
		if (typeof this.onStateChange === 'function') {
			try {
				this.onStateChange(speaking)
			} catch (e) {
				// 忽略回调异常
			}
		}
	}

	/**
	 * 当前状态快照（供调试与测试）
	 */
	getState () {
		return {
			speaking: this.speaking,
			frameCount: this.frames.length,
			duration: lipsync.totalDuration(this.frames),
			queued: this._queue.length,
			expression: this.avatar ? this.avatar.expression : null,
			mouthOpenY: this.avatar ? this.avatar.mouthOpenY : null
		}
	}

	/**
	 * 销毁：停止一切并释放引用
	 */
	destroy () {
		this.stop()
		this._queue = []
		this.avatar = null
		this.tts = null
	}
}

module.exports = { AvatarController }

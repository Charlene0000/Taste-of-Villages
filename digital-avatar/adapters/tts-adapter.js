'use strict'

/**
 * TTS 适配器（默认 noop）
 *
 * 默认实现**不出声** —— 只做口型动画。
 *
 * 原因：讯飞 TTS 是收费服务，若作为默认路径会违反「零配置、零费用」的约束。
 * 因此默认适配器是 noop：文本照常被处理成口型序列，但不发声。
 *
 * 可选实现
 * --------
 * 传入自定义适配器即可启用真实语音：
 *
 *   const tts = {
 *     speak(text, { onStart, onEnd }) {
 *       uniCloud.callFunction({
 *         name: 'ai-agent',
 *         data: { action: 'tts', data: { params: { text } } }
 *       }).then(res => {
 *         if (res.result && res.result.audio) {
 *           const ctx = uni.createInnerAudioContext()
 *           ctx.src = 'data:audio/mp3;base64,' + res.result.audio
 *           ctx.onPlay(onStart)
 *           ctx.onEnded(onEnd)
 *           ctx.play()
 *           this._ctx = ctx
 *         } else {
 *           onEnd()   // 云端降级返回 audio: null
 *         }
 *       })
 *     },
 *     stop() { if (this._ctx) { this._ctx.stop(); this._ctx.destroy(); this._ctx = null } }
 *   }
 *
 * 注意：ai-agent 云函数的 tts action 在讯飞未配置时返回 { audio: null }，
 *       此时不发出声音，仅口型动画继续 —— 这正是设计好的降级路径。
 */

/**
 * 默认 noop 适配器
 */
const noop = {
	name: 'noop',

	/**
	 * 不发声
	 * @param {string} text
	 * @param {Object} handlers { onStart, onEnd }
	 */
	speak (text, handlers = {}) {
		if (typeof handlers.onStart === 'function') handlers.onStart()
		// 立即结束：不产生音频，也不占用播放资源
		if (typeof handlers.onEnd === 'function') handlers.onEnd()
	},

	/**
	 * 无需停止
	 */
	stop () {}
}

/**
 * 创建一个使用 uni 内置音频能力的 TTS 适配器（可选，需云端已配置讯飞）
 *
 * 该适配器调用 ai-agent 云函数的 tts action：
 *   - 云端返回 audio → 播放
 *   - 云端返回 audio: null（未配置讯飞）→ 不出声，仅口型动画
 *
 * @param {Object} options
 * @param {string} options.vcn 音色，默认 x4_yezi
 * @returns {Object} TTS 适配器
 */
function createUniAudioAdapter (options = {}) {
	let ctx = null

	return {
		name: 'uni-audio',

		speak (text, handlers = {}) {
			const self = this
			if (!text || !text.trim()) {
				if (typeof handlers.onEnd === 'function') handlers.onEnd()
				return
			}

			uniCloud.callFunction({
				name: 'ai-agent',
				data: {
					action: 'tts',
					data: {
						params: {
							text: text.slice(0, 100),
							vcn: options.vcn || 'x4_yezi'
						}
					}
				}
			}).then((res) => {
				const result = res && res.result
				if (result && result.audio) {
					if (typeof handlers.onStart === 'function') handlers.onStart()
					ctx = uni.createInnerAudioContext()
					ctx.src = 'data:audio/mp3;base64,' + result.audio
					ctx.onEnded(() => {
						if (typeof handlers.onEnd === 'function') handlers.onEnd()
					})
					ctx.onError(() => {
						if (typeof handlers.onEnd === 'function') handlers.onEnd()
					})
					ctx.play()
				} else {
					// 云端降级：不出声
					if (typeof handlers.onEnd === 'function') handlers.onEnd()
				}
			}).catch(() => {
				if (typeof handlers.onEnd === 'function') handlers.onEnd()
			})
		},

		stop () {
			if (ctx) {
				try {
					ctx.stop()
					ctx.destroy()
				} catch (e) {
					// 忽略
				}
				ctx = null
			}
		}
	}
}

module.exports = {
	noop,
	createUniAudioAdapter,
	default: noop
}

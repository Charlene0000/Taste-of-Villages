'use strict'

/**
 * LipSyncBridge —— 文本 → 口型参数序列（自研，纯函数）
 *
 * 设计目标
 * --------
 * 在**没有任何 TTS 音频**的前提下，口型也能随文本节奏自然开合。
 * 这使得数字人演示在零配置、零费用的情况下依然完整可用。
 *
 * 核心算法（纯规则，不依赖音频分析）
 * ------------------------------------
 * 1. 文本按字符切分，逐字符估算发音时长：
 *    · 汉字      —— 约 1 个音节，基准 200ms
 *    · 英文字母  —— 约 0.5 个音节，基准 120ms
 *    · 数字      —— 按位读，基准 150ms
 *    · 标点      —— 停顿，逗号 120ms / 句号 260ms / 换行 300ms
 * 2. 每个字符映射为一个口型开合值：
 *    · 开口音（a/o/e 类的汉字与部分字母）→ 大开
 *    · 闭口音（m/n/b/p 类）→ 闭合
 *    · 其他 → 中等开合
 *    · 标点 → 完全闭合（停顿）
 * 3. 输出 [{t, value}] 序列：t 为累计时间（ms），value ∈ [0,1]
 *
 * 精度边界（诚实声明）
 * --------------------
 * 本映射是**近似**的，不是音素级对齐：
 *   - 不做真实拼音转换，用字符类别近似代替
 *   - 引入完整拼音库可提升精度，但会增加数百 KB 依赖，
 *     与「clone 即可运行、零外部依赖」的约束冲突，故不引入
 *   - 实际观感上，口型开合节奏与文本朗读节奏基本吻合，
 *     但无法做到与专业 lip-sync 逐帧对齐
 *
 * 音频驱动为可选增强：analyzeAudio() 预留了接口，
 * 默认不启用，也不影响默认路径。
 */

/** 各类字符的基准时长（毫秒） */
const DURATION = {
	han: 200,       // 汉字（≈1 音节）
	latin: 120,     // 英文字母（≈0.5 音节）
	digit: 150,     // 数字（逐位读）
	space: 60,      // 空格
	comma: 120,     // 逗号停顿
	period: 260,    // 句号停顿
	question: 280,  // 问号停顿
	exclaim: 280,   // 感叹号停顿
	newline: 300,   // 换行停顿
	other: 140
}

/** 口型开合幅度档位 */
const MOUTH = {
	closed: 0.05,   // 闭口音 / 停顿
	narrow: 0.28,   // 窄口
	medium: 0.55,   // 中等
	wide: 0.85      // 大开
}

/**
 * 判断字符类别
 * @param {string} ch
 * @returns {string} 类别键
 */
function charCategory (ch) {
	const code = ch.charCodeAt(0)

	// 汉字（含扩展区）
	if (code >= 0x4e00 && code <= 0x9fff) return 'han'
	// ASCII 数字
	if (code >= 48 && code <= 57) return 'digit'
	// ASCII 字母
	if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return 'latin'
	// 空格
	if (ch === ' ' || ch === '\t') return 'space'
	// 换行
	if (ch === '\n' || ch === '\r') return 'newline'
	// 中文标点
	if (ch === '，' || ch === '、' || ch === '；' || ch === '：') return 'comma'
	if (ch === '。' || ch === '！' || ch === '？') return 'period'
	if (ch === '…' || ch === '—' || ch === '～') return 'period'
	// 英文标点
	if (ch === ',' || ch === ';') return 'comma'
	if (ch === '.' || ch === '!' || ch === '?') return 'period'
	if (ch === '，' === false && (ch === '、')) return 'comma'

	return 'other'
}

/**
 * 根据字符估算口型开合值
 * @param {string} ch
 * @param {string} category 字符类别
 * @returns {number} ∈ [0,1]
 */
function mouthValueFor (ch, category) {
	// 停顿类：完全闭合
	if (category === 'comma' || category === 'period' ||
		category === 'newline' || category === 'space') {
		return MOUTH.closed
	}

	// 闭口音：汉字中含「口」「合」等偏旁时多为闭口音，此处按常见闭口字表近似
	const closedHanzi = ['m', 'n', 'b', 'p', 'f']
	const lower = ch.toLowerCase()
	if (category === 'latin' && closedHanzi.indexOf(lower) !== -1) {
		return MOUTH.closed
	}

	// 开口音：a/o/e 类字母
	const openLetters = ['a', 'o', 'e']
	if (category === 'latin' && openLetters.indexOf(lower) !== -1) {
		return MOUTH.wide
	}

	// 汉字：按字符编码散列，在中等到大开之间取值 —— 同一句话里的汉字口型
	// 会有起伏变化，避免全程一个幅度显得机械
	if (category === 'han') {
		const hash = (codePointOf(ch) * 2654435761) % 1000
		if (hash < 35) return MOUTH.wide
		if (hash < 60) return MOUTH.narrow
		return MOUTH.medium
	}

	if (category === 'digit') return MOUTH.medium

	return MOUTH.medium
}

function codePointOf (ch) {
	return ch.codePointAt(0) || 0
}

/**
 * 由文本构建口型参数序列
 *
 * @param {string} text 文本
 * @param {Object} options
 * @param {number} options.speed 速度倍率，>1 更快，默认 1
 * @param {number} options.minInterval 相邻两帧最小间隔（ms），默认 40
 * @returns {Array<{t: number, value: number}>} t 为累计时间（ms），value ∈ [0,1]
 */
function build (text, options = {}) {
	const speed = typeof options.speed === 'number' && options.speed > 0 ? options.speed : 1
	const minInterval = typeof options.minInterval === 'number' ? options.minInterval : 40

	if (typeof text !== 'string' || text.length === 0) {
		return []
	}

	const chars = Array.from(text) // 按 Unicode 码点切分，正确处理代理对
	const frames = []
	let t = 0

	for (const ch of chars) {
		const category = charCategory(ch)
		const base = DURATION[category] || DURATION.other
		const duration = Math.max(minInterval, Math.round(base / speed))

		frames.push({
			t,
			value: Number(mouthValueFor(ch, category).toFixed(4))
		})

		t += duration
	}

	// 末尾补一帧闭合，表示「说完后嘴合上」
	if (frames.length) {
		frames.push({
			t,
			value: MOUTH.closed
		})
	}

	return frames
}

/**
 * 计算序列总时长
 * @param {Array<{t: number, value: number}>} frames
 * @returns {number} 毫秒
 */
function totalDuration (frames) {
	if (!frames || !frames.length) return 0
	return frames[frames.length - 1].t
}

/**
 * 在指定时间点采样口型值（用于播放时按时间轴取值）
 *
 * @param {Array<{t: number, value: number}>} frames
 * @param {number} time 当前时间（ms）
 * @returns {number} ∈ [0,1]
 */
function sampleAt (frames, time) {
	if (!frames || !frames.length) return MOUTH.closed

	if (time <= frames[0].t) return frames[0].value

	for (let i = 1; i < frames.length; i++) {
		const cur = frames[i]
		const prev = frames[i - 1]
		if (time < cur.t) {
			// 在 prev 与 cur 之间线性插值，让口型过渡平滑
			const span = cur.t - prev.t
			if (span <= 0) return cur.value
			const ratio = (time - prev.t) / span
			return prev.value + (cur.value - prev.value) * ratio
		}
	}

	return MOUTH.closed
}

/**
 * 音频分析接口（预留，默认不启用）
 *
 * 设计说明：真实的口型同步需要从音频的 RMS 能量或频谱推导开口度。
 * 本项目默认路径不依赖音频，因此该接口仅定义契约，不实现具体分析 ——
 * 实现它需要 Web Audio API 的 AnalyserNode，且在 App 端（uni-app）
 * 与 H5 端的 API 不一致，跨端适配成本高于收益。
 *
 * 若未来接入，只需返回与 build() 相同结构的数组即可，
 * AvatarController 不关心序列的来源。
 *
 * @param {ArrayBuffer} audioBuffer 音频数据
 * @returns {Promise<Array<{t: number, value: number}>>}
 */
async function analyzeAudio (audioBuffer) {
	throw new Error(
		'analyzeAudio 为预留接口：默认路径不依赖音频分析。' +
		'如需实现，请按 build() 的返回结构提供 [{t, value}] 序列。'
	)
}

module.exports = {
	build,
	sampleAt,
	totalDuration,
	analyzeAudio,
	charCategory,
	mouthValueFor,
	DURATION,
	MOUTH
}

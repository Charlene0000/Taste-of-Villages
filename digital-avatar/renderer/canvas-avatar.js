'use strict'

/**
 * Canvas 2D 数字人形象渲染器（自研）
 *
 * 全部形象由代码绘制 —— 不引入 Live2D、不引入二进制模型文件、
 * 不依赖任何收费渲染服务。代码在仓库内可读、可改、可讲。
 *
 * 绘制内容：头部、眼睛、眉毛、嘴巴、腮红、身体。
 * 嘴巴用 quadraticCurveTo 绘制可开合的曲线，开合程度由 setMouthOpenY(v) 控制。
 *
 * 表情系统：setExpression(name) 支持 neutral / happy / thinking / surprised。
 * 表情通过眼睛形状、眉毛角度、嘴角曲率三个维度组合实现。
 */

/** 支持的表情 */
const EXPRESSIONS = ['neutral', 'happy', 'thinking', 'surprised']

class CanvasAvatar {
	/**
	 * @param {Object} options
	 * @param {CanvasRenderingContext2D} options.ctx canvas 2D 上下文
	 * @param {number} options.width  画布宽（逻辑像素）
	 * @param {number} options.height 画布高（逻辑像素）
	 * @param {string} options.expression 初始表情
	 * @param {boolean} options.autoDraw 是否在 render 后自动提交（小程序端需 ctx.draw()）
	 */
	constructor (options = {}) {
		this.ctx = options.ctx || null
		this.width = options.width || 300
		this.height = options.height || 300
		// 小程序端的 createCanvasContext 需要显式 draw() 才会真正上屏
		this.autoDraw = options.autoDraw !== false

		/** 嘴巴开合度 ∈ [0,1] */
		this.mouthOpenY = 0
		/** 当前表情 */
		this.expression = EXPRESSIONS.indexOf(options.expression) !== -1
			? options.expression
			: 'neutral'
		/** 眨眼进度 0~1，1 表示完全闭合 */
		this.blink = 0
		/** 呼吸相位 */
		this.breathPhase = 0
	}

	/**
	 * 设置嘴巴开合度
	 * @param {number} v ∈ [0,1]，超出范围会被裁剪
	 */
	setMouthOpenY (v) {
		const num = typeof v === 'number' && !Number.isNaN(v) ? v : 0
		this.mouthOpenY = Math.max(0, Math.min(1, num))
		return this
	}

	/**
	 * 设置表情
	 * @param {string} name neutral / happy / thinking / surprised
	 * @returns {boolean} 是否设置成功（名称非法时返回 false 并保持原表情）
	 */
	setExpression (name) {
		if (EXPRESSIONS.indexOf(name) === -1) return false
		this.expression = name
		return true
	}

	/**
	 * 设置眨眼进度
	 */
	setBlink (v) {
		const num = typeof v === 'number' && !Number.isNaN(v) ? v : 0
		this.blink = Math.max(0, Math.min(1, num))
		return this
	}

	/**
	 * 推进呼吸相位（每帧调用）
	 * @param {number} dt 距上一帧的毫秒数
	 */
	update (dt = 16) {
		this.breathPhase = (this.breathPhase + dt / 1000) % (Math.PI * 2)
	}

	/**
	 * 渲染一帧
	 */
	render () {
		const ctx = this.ctx
		if (!ctx) return

		const w = this.width
		const h = this.height
		const cx = w / 2

		ctx.clearRect(0, 0, w, h)

		// 呼吸缩放
		const breath = 1 + Math.sin(this.breathPhase) * 0.012

		// 背景光晕
		const glow = ctx.createRadialGradient(cx, h * 0.42, w * 0.1, cx, h * 0.42, w * 0.55)
		glow.addColorStop(0, 'rgba(255, 214, 165, 0.42)')
		glow.addColorStop(1, 'rgba(255, 214, 165, 0)')
		ctx.fillStyle = glow
		ctx.fillRect(0, 0, w, h)

		// 身体
		this._drawBody(ctx, cx, h, breath)

		// 头部
		const headY = h * 0.42
		const headR = w * 0.22 * breath
		this._drawHead(ctx, cx, headY, headR)
		this._drawEyes(ctx, cx, headY, headR)
		this._drawBrows(ctx, cx, headY, headR)
		this._drawBlush(ctx, cx, headY, headR)
		this._drawMouth(ctx, cx, headY, headR)

		// 小程序端需要显式提交绘制指令
		if (this.autoDraw && typeof ctx.draw === 'function') {
			ctx.draw()
		}
	}

	/* ------------------------- 绘制各部件 ------------------------- */

	_drawBody (ctx, cx, h, breath) {
		const bodyTop = h * 0.62
		const bodyW = w * 0.34 * breath
		const bodyH = h * 0.34

		ctx.save()
		ctx.beginPath()
		ctx.moveTo(cx - bodyW / 2, h)
		ctx.quadraticCurveTo(cx - bodyW / 2, bodyTop, cx, bodyTop)
		ctx.quadraticCurveTo(cx + bodyW / 2, bodyTop, cx + bodyW / 2, h)
		ctx.closePath()
		ctx.fillStyle = '#FFAB91'
		ctx.fill()

		// 衣领装饰
		ctx.beginPath()
		ctx.ellipse(cx, bodyTop + 6, w * 0.09, h * 0.025, 0, 0, Math.PI * 2)
		ctx.fillStyle = '#FFF3E0'
		ctx.fill()
		ctx.restore()
	}

	_drawHead (ctx, cx, headY, headR) {
		ctx.save()
		// 头发
		ctx.beginPath()
		ctx.ellipse(cx, headY - headR * 0.28, headR * 1.06, headR * 0.86, 0, Math.PI, Math.PI * 2)
		ctx.fillStyle = '#5D4037'
		ctx.fill()

		// 脸
		ctx.beginPath()
		ctx.ellipse(cx, headY, headR * 0.9, headR, 0, 0, Math.PI * 2)
		ctx.fillStyle = '#FFE0B2'
		ctx.fill()
		ctx.restore()
	}

	_drawEyes (ctx, cx, headY, headR) {
		const eyeY = headY - headR * 0.08
		const eyeDx = headR * 0.34
		const eyeR = headR * 0.13

		for (const sign of [-1, 1]) {
			const ex = cx + sign * eyeDx

			ctx.save()
			ctx.beginPath()
			ctx.ellipse(ex, eyeY, eyeR, eyeR * (1 - this.blink * 0.92), 0, 0, Math.PI * 2)
			ctx.fillStyle = '#FFFFFF'
			ctx.fill()

			// 瞳孔
			if (this.blink < 0.6) {
				ctx.beginPath()
				ctx.ellipse(ex, eyeY + eyeR * 0.08, eyeR * 0.5, eyeR * 0.55, 0, 0, Math.PI * 2)
				ctx.fillStyle = '#3E2723'
				ctx.fill()
			}
			ctx.restore()
		}
	}

	_drawBrows (ctx, cx, headY, headR) {
		const browY = headY - headR * 0.3
		const browDx = headR * 0.34
		const browW = headR * 0.3
		const browH = headR * 0.05

		// 不同表情的眉毛角度
		let angle = 0
		if (this.expression === 'thinking') angle = -0.28
		else if (this.expression === 'surprised') angle = 0.2
		else if (this.expression === 'happy') angle = 0.1

		for (const sign of [-1, 1]) {
			const bx = cx + sign * browDx
			ctx.save()
			ctx.translate(bx, browY)
			ctx.rotate(sign * angle)
			ctx.beginPath()
			ctx.moveTo(-browW / 2, 0)
			ctx.quadraticCurveTo(0, -browH, browW / 2, 0)
			ctx.strokeStyle = '#5D4037'
			ctx.lineWidth = Math.max(2, headR * 0.055)
			ctx.lineCap = 'round'
			ctx.stroke()
			ctx.restore()
		}
	}

	_drawBlush (ctx, cx, headY, headR) {
		if (this.expression !== 'happy' && this.expression !== 'surprised') return
		const blushY = headY + headR * 0.22
		const blushDx = headR * 0.55
		const r = headR * 0.17

		for (const sign of [-1, 1]) {
			ctx.save()
			ctx.beginPath()
			ctx.ellipse(cx + sign * blushDx, blushY, r, r * 0.62, 0, 0, Math.PI * 2)
			ctx.fillStyle = 'rgba(255, 138, 128, 0.32)'
			ctx.fill()
			ctx.restore()
		}
	}

	_drawMouth (ctx, cx, headY, headR) {
		const mouthY = headY + headR * 0.36
		const mouthW = headR * 0.44

		// 开合高度由 mouthOpenY 控制，最大为 mouthW 的 60%
		const openH = mouthW * 0.6 * this.mouthOpenY

		// 不同表情的嘴角曲率
		let curve = 0
		if (this.expression === 'happy') curve = mouthW * 0.28
		else if (this.expression === 'thinking') curve = -mouthW * 0.12
		else if (this.expression === 'surprised') curve = mouthW * 0.08

		ctx.save()
		ctx.beginPath()

		if (openH > 1.5) {
			// 张口：上弧 + 下弧围成椭圆
			ctx.moveTo(cx - mouthW / 2, mouthY)
			ctx.quadraticCurveTo(cx, mouthY - openH * 0.85, cx + mouthW / 2, mouthY)
			ctx.quadraticCurveTo(cx, mouthY + openH, cx - mouthW / 2, mouthY)
			ctx.closePath()
			ctx.fillStyle = '#8D3A3A'
			ctx.fill()
			// 舌头
			ctx.beginPath()
			ctx.ellipse(cx, mouthY + openH * 0.42, mouthW * 0.22, openH * 0.3, 0, 0, Math.PI * 2)
			ctx.fillStyle = '#E57373'
			ctx.fill()
		} else {
			// 闭口或微开：一条带曲率的线
			ctx.moveTo(cx - mouthW / 2, mouthY)
			ctx.quadraticCurveTo(cx, mouthY + curve + openH, cx + mouthW / 2, mouthY)
			ctx.strokeStyle = '#8D3A3A'
			ctx.lineWidth = Math.max(2, headR * 0.06)
			ctx.lineCap = 'round'
			ctx.stroke()
		}

		ctx.restore()
	}
}

module.exports = {
	CanvasAvatar,
	EXPRESSIONS
}

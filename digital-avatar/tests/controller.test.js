'use strict'

/**
 * AvatarController 单元测试（Sprint 3）
 *
 * 覆盖：speak 启动、stop 立即复位、覆盖式打断、队列模式、
 *       setExpression、状态快照。
 */

const assert = require('assert')
const { AvatarController } = require('../controller/avatar-controller')
const { CanvasAvatar } = require('../renderer/canvas-avatar')

/** 创建一个可控的假 avatar（不依赖 canvas） */
function createFakeAvatar () {
	return {
		expression: 'neutral',
		mouthOpenY: 0,
		renderCount: 0,
		setMouthOpenY (v) {
			this.mouthOpenY = v
			return this
		},
		setExpression (name) {
			if (['neutral', 'happy', 'thinking', 'surprised'].indexOf(name) === -1) return false
			this.expression = name
			return true
		},
		update () {},
		render () {
			this.renderCount++
		}
	}
}

/** 创建可控的 rAF 桩：手动推进帧 */
function createFrameStub () {
	let queue = []
	let id = 0
	return {
		requestFrame (cb) {
			id++
			queue.push({ id, cb })
			return id
		},
		cancelFrame (handleId) {
			queue = queue.filter(f => f.id !== handleId)
		},
		/** 推进 n 帧，每帧间隔 ms 毫秒 */
		step (n = 1, ms = 16) {
			for (let i = 0; i < n; i++) {
				const current = queue
				queue = []
				const now = Date.now() + ms
				const realNow = Date.now
				Date.now = () => now
				try {
					current.forEach(f => f.cb(now))
				} finally {
					Date.now = realNow
				}
			}
		},
		pending () {
			return queue.length
		}
	}
}

global.describe('AvatarController 播报控制', () => {
	test('speak 启动后 speaking 为 true', () => {
		const avatar = createFakeAvatar()
		const frames = createFrameStub()
		const ctrl = new AvatarController({
			avatar,
			requestFrame: frames.requestFrame,
			cancelFrame: frames.cancelFrame
		})
		assert.strictEqual(ctrl.speak('你好世界'), true)
		assert.strictEqual(ctrl.getState().speaking, true)
	})

	test('speak 空文本返回 false', () => {
		const ctrl = new AvatarController({ avatar: createFakeAvatar() })
		assert.strictEqual(ctrl.speak(''), false)
		assert.strictEqual(ctrl.speak('   '), false)
		assert.strictEqual(ctrl.speak(null), false)
	})

	test('stop 立即复位口型并停止', () => {
		const avatar = createFakeAvatar()
		const frames = createFrameStub()
		const ctrl = new AvatarController({
			avatar,
			requestFrame: frames.requestFrame,
			cancelFrame: frames.cancelFrame
		})
		ctrl.speak('你好世界')
		frames.step(3)
		assert.ok(avatar.mouthOpenY > 0, '播报中口型应张开')

		ctrl.stop()
		assert.strictEqual(avatar.mouthOpenY, 0, '停止后口型应复位')
		assert.strictEqual(ctrl.getState().speaking, false)
		assert.strictEqual(frames.pending(), 0, 'rAF 应被取消')
	})

	test('覆盖式打断：新 speak 打断旧播报', () => {
		const avatar = createFakeAvatar()
		const frames = createFrameStub()
		const ctrl = new AvatarController({
			avatar,
			requestFrame: frames.requestFrame,
			cancelFrame: frames.cancelFrame
		})
		ctrl.speak('第一句话内容比较长一些')
		const firstFrameCount = ctrl.getState().frameCount
		ctrl.speak('短')
		// 帧序列已被新文本替换（长度不同，可明确区分）
		assert.notStrictEqual(ctrl.getState().frameCount, firstFrameCount,
			'帧序列应被新文本替换')
		assert.ok(ctrl.getState().frameCount < firstFrameCount)
		assert.strictEqual(ctrl.getState().speaking, true)
	})

	test('连续 speak 不会产生双动画（只保留一个 rAF 链）', () => {
		const avatar = createFakeAvatar()
		const frames = createFrameStub()
		const ctrl = new AvatarController({
			avatar,
			requestFrame: frames.requestFrame,
			cancelFrame: frames.cancelFrame
		})
		ctrl.speak('一')
		ctrl.speak('二')
		ctrl.speak('三')
		assert.strictEqual(frames.pending(), 1, '应只有一条 rAF 链，实际 ' + frames.pending())
	})

	test('队列模式下 speak 会入队', () => {
		const avatar = createFakeAvatar()
		const frames = createFrameStub()
		const ctrl = new AvatarController({
			avatar,
			queue: true,
			requestFrame: frames.requestFrame,
			cancelFrame: frames.cancelFrame
		})
		ctrl.speak('第一句')
		ctrl.speak('第二句')
		assert.strictEqual(ctrl.getState().queued, 1)
	})

	test('setExpression 切换表情', () => {
		const avatar = createFakeAvatar()
		const ctrl = new AvatarController({ avatar })
		assert.strictEqual(ctrl.setExpression('happy'), true)
		assert.strictEqual(avatar.expression, 'happy')
		assert.strictEqual(ctrl.setExpression('not-exist'), false)
		assert.strictEqual(avatar.expression, 'happy', '非法表情不应改变当前表情')
	})

	test('状态快照包含关键字段', () => {
		const avatar = createFakeAvatar()
		const ctrl = new AvatarController({ avatar })
		ctrl.speak('你好')
		const s = ctrl.getState()
		assert.ok('speaking' in s)
		assert.ok('frameCount' in s)
		assert.ok('duration' in s)
		assert.ok('expression' in s)
		assert.ok('mouthOpenY' in s)
	})

	test('onStateChange 回调被触发', () => {
		const avatar = createFakeAvatar()
		const frames = createFrameStub()
		const states = []
		const ctrl = new AvatarController({
			avatar,
			requestFrame: frames.requestFrame,
			cancelFrame: frames.cancelFrame,
			onStateChange: (s) => states.push(s)
		})
		ctrl.speak('你好')
		ctrl.stop()
		assert.ok(states.includes(true), '应触发 speaking=true')
		assert.ok(states.includes(false), '应触发 speaking=false')
	})

	test('TTS 抛异常不影响口型动画', () => {
		const avatar = createFakeAvatar()
		const frames = createFrameStub()
		const ctrl = new AvatarController({
			avatar,
			requestFrame: frames.requestFrame,
			cancelFrame: frames.cancelFrame,
			tts: {
				speak () { throw new Error('TTS 挂了') },
				stop () {}
			}
		})
		ctrl.speak('你好')
		assert.strictEqual(ctrl.getState().speaking, true, '不应因 TTS 异常而中断')
	})
})

global.describe('CanvasAvatar 渲染器', () => {
	test('setMouthOpenY 裁剪到 [0,1]', () => {
		const a = new CanvasAvatar({ ctx: null })
		a.setMouthOpenY(2)
		assert.strictEqual(a.mouthOpenY, 1)
		a.setMouthOpenY(-1)
		assert.strictEqual(a.mouthOpenY, 0)
		a.setMouthOpenY(0.5)
		assert.strictEqual(a.mouthOpenY, 0.5)
	})

	test('setMouthOpenY 忽略非法值', () => {
		const a = new CanvasAvatar({ ctx: null })
		a.setMouthOpenY(0.5)
		a.setMouthOpenY('abc')
		assert.strictEqual(a.mouthOpenY, 0, '非法值应归零')
	})

	test('setExpression 只接受支持的名称', () => {
		const a = new CanvasAvatar({ ctx: null })
		assert.strictEqual(a.setExpression('happy'), true)
		assert.strictEqual(a.expression, 'happy')
		assert.strictEqual(a.setExpression('angry'), false)
		assert.strictEqual(a.expression, 'happy')
	})

	test('无 ctx 时 render 不抛异常', () => {
		const a = new CanvasAvatar({ ctx: null })
		assert.doesNotThrow(() => a.render())
	})

	test('update 推进呼吸相位', () => {
		const a = new CanvasAvatar({ ctx: null })
		const before = a.breathPhase
		a.update(100)
		assert.notStrictEqual(a.breathPhase, before)
	})
})

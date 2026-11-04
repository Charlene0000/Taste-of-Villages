'use strict'

/**
 * LipSyncBridge 单元测试（Sprint 3）
 *
 * 覆盖：序列长度与文本长度匹配、value 值域 [0,1]、t 单调递增、
 *       空输入、标点闭合、采样插值、精度边界说明。
 */

const assert = require('assert')
const lipsync = require('../bridge/lipsync')

const tests = []
function test (name, fn) {
	tests.push({ name, fn })
}

global.describe('LipSyncBridge 口型序列', () => {
	test('空文本返回空序列', () => {
		assert.deepStrictEqual(lipsync.build(''), [])
		assert.deepStrictEqual(lipsync.build(null), [])
		assert.deepStrictEqual(lipsync.build(undefined), [])
	})

	test('序列长度 = 字符数 + 1（末尾闭合帧）', () => {
		const text = '你好世界'
		const frames = lipsync.build(text)
		assert.strictEqual(frames.length, Array.from(text).length + 1)
	})

	test('全部 value 都在 [0,1] 内', () => {
		const texts = ['你好世界', 'Hello World', '12345', '你好，世界！', '   ', '混合 text 混排 123']
		for (const text of texts) {
			for (const f of lipsync.build(text)) {
				assert.ok(f.value >= 0 && f.value <= 1,
					`「${text}」的值 ${f.value} 越界`)
			}
		}
	})

	test('t 严格单调递增', () => {
		const frames = lipsync.build('我登录了几次现在几点')
		for (let i = 1; i < frames.length; i++) {
			assert.ok(frames[i].t > frames[i - 1].t,
				`第 ${i} 帧时间未递增: ${frames[i - 1].t} → ${frames[i].t}`)
		}
	})

	test('t 从 0 开始', () => {
		const frames = lipsync.build('测试')
		assert.strictEqual(frames[0].t, 0)
	})

	test('末尾帧为闭合（value 接近 0）', () => {
		const frames = lipsync.build('你好')
		const last = frames[frames.length - 1]
		assert.ok(last.value <= 0.1, '末尾应闭口，实际 ' + last.value)
	})

	test('标点产生闭合帧', () => {
		const frames = lipsync.build('好，')
		const commaFrame = frames[frames.length - 2]
		assert.ok(commaFrame.value <= 0.1, '逗号处应闭口')
	})

	test('英文与数字也能生成有效序列', () => {
		const frames = lipsync.build('Hello 123')
		assert.ok(frames.length > 0)
		for (const f of frames) {
			assert.ok(f.value >= 0 && f.value <= 1)
		}
	})

	test('speed 越大总时长越短', () => {
		const slow = lipsync.totalDuration(lipsync.build('你好世界你好世界', { speed: 1 }))
		const fast = lipsync.totalDuration(lipsync.build('你好世界你好世界', { speed: 2 }))
		assert.ok(fast < slow, `fast(${fast}) 应小于 slow(${slow})`)
	})

	test('相同文本产生相同序列（纯函数确定性）', () => {
		const a = lipsync.build('你好世界')
		const b = lipsync.build('你好世界')
		assert.deepStrictEqual(a, b)
	})
})

global.describe('LipSyncBridge 采样', () => {
	test('时间早于第一帧时返回首帧值', () => {
		const frames = lipsync.build('你好')
		assert.strictEqual(lipsync.sampleAt(frames, -100), frames[0].value)
	})

	test('时间超出序列时返回闭合', () => {
		const frames = lipsync.build('你好')
		assert.ok(lipsync.sampleAt(frames, 999999) <= 0.1)
	})

	test('空序列采样返回闭合', () => {
		assert.ok(lipsync.sampleAt([], 100) <= 0.1)
	})

	test('插值结果落在相邻两帧之间', () => {
		const frames = lipsync.build('你好世界')
		const mid = (frames[0].t + frames[1].t) / 2
		const v = lipsync.sampleAt(frames, mid)
		const lo = Math.min(frames[0].value, frames[1].value)
		const hi = Math.max(frames[0].value, frames[1].value)
		assert.ok(v >= lo - 1e-6 && v <= hi + 1e-6,
			`插值 ${v} 应在 [${lo}, ${hi}] 内`)
	})
})

global.describe('LipSyncBridge 精度边界', () => {
	test('字符分类正确', () => {
		assert.strictEqual(lipsync.charCategory('中'), 'han')
		assert.strictEqual(lipsync.charCategory('a'), 'latin')
		assert.strictEqual(lipsync.charCategory('5'), 'digit')
		assert.strictEqual(lipsync.charCategory('，'), 'comma')
		assert.strictEqual(lipsync.charCategory('。'), 'period')
		assert.strictEqual(lipsync.charCategory(' '), 'space')
	})

	test('闭口字母 m/n/b/p 映射为闭合', () => {
		for (const ch of ['m', 'n', 'b', 'p']) {
			const v = lipsync.mouthValueFor(ch, 'latin')
			assert.ok(v <= 0.1, `${ch} 应闭口，实际 ${v}`)
		}
	})

	test('开口字母 a/o/e 映射为大开', () => {
		for (const ch of ['a', 'o', 'e']) {
			const v = lipsync.mouthValueFor(ch, 'latin')
			assert.ok(v >= 0.8, `${ch} 应大开，实际 ${v}`)
		}
	})

	test('analyzeAudio 为预留接口，调用时抛明确错误', async () => {
		let msg = ''
		try {
			await lipsync.analyzeAudio(new ArrayBuffer(0))
		} catch (e) {
			msg = e.message
		}
		assert.ok(msg.includes('预留接口'), '错误信息应说明是预留接口，实际: ' + msg)
	})
})

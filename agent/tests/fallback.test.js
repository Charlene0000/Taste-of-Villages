'use strict'

/**
 * fallback 单元测试（Sprint 2）
 *
 * 覆盖：能力清单生成、与工具注册表一致性、不返回工具结果、
 *       降级原因到文案的映射。
 */

const assert = require('assert')
const fallback = require('../core/fallback')
const registry = require('../tools/index')

global.describe('fallback 降级策略', () => {
	test('能力清单非空', () => {
		const r = fallback.capabilityList({ reason: 'no-intent-matched' })
		assert.ok(r.capabilities.length > 0)
		assert.strictEqual(r.type, 'fallback')
	})

	test('能力清单与工具注册表一致', () => {
		const r = fallback.capabilityList({})
		const registered = registry.listCapabilities()
		assert.strictEqual(r.capabilities.length, registered.length)
		for (const c of r.capabilities) {
			assert.ok(registry.get(c.name), `清单中的 ${c.name} 应已注册`)
		}
	})

	test('降级结果不包含任何工具执行结果', () => {
		const r = fallback.reply({ reason: 'low-confidence' })
		assert.strictEqual(r.results, undefined)
		assert.strictEqual(r.ok, true)
	})

	test('降级文案包含能力列表与示例问法', () => {
		const r = fallback.reply({ reason: 'low-confidence' })
		assert.ok(r.answer.includes('我不太确定'))
		assert.ok(r.answer.length > 10)
		assert.ok(Array.isArray(r.suggestions))
	})

	test('不同降级原因有不同文案', () => {
		const a = fallback.reply({ reason: 'no-intent-matched' })
		const b = fallback.reply({ reason: 'empty-input' })
		assert.notStrictEqual(a.message, b.message)
	})

	test('matches 被透传到结果中（便于调试）', () => {
		const matches = [{ intent: 'server-time', confidence: 0.1 }]
		const r = fallback.capabilityList({ matches })
		assert.strictEqual(r.matches, matches)
	})
})

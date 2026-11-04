'use strict'

/**
 * planner 单元测试（Sprint 2）
 *
 * 覆盖：正常意图分类、多工具串行规划、低置信度不产出工具序列、空输入处理。
 */

const assert = require('assert')
const planner = require('../core/planner')
const ruleAdapter = require('../adapters/rule-adapter')

global.describe('planner 阶段一：意图分类', () => {
	test('「我登录了几次」应识别为 user-stats', () => {
		const matches = planner.classify('我登录了几次', ruleAdapter)
		assert.ok(matches.length > 0, '应至少有一个匹配')
		assert.strictEqual(matches[0].intent, 'user-stats')
		assert.ok(matches[0].confidence > 0.3, '置信度应超过阈值，实际 ' + matches[0].confidence)
	})

	test('「现在几点」应识别为 server-time', () => {
		const matches = planner.classify('现在几点', ruleAdapter)
		assert.ok(matches.length > 0)
		assert.strictEqual(matches[0].intent, 'server-time')
	})

	test('分类结果按置信度降序排列', () => {
		const matches = planner.classify('我登录了几次现在几点', ruleAdapter)
		for (let i = 1; i < matches.length; i++) {
			assert.ok(matches[i - 1].confidence >= matches[i].confidence,
				'第 ' + i + ' 项顺序错误')
		}
	})

	test('无关输入不产生任何匹配', () => {
		const matches = planner.classify('今天天气怎么样', ruleAdapter)
		assert.strictEqual(matches.length, 0, '不应有匹配，实际 ' + JSON.stringify(matches))
	})

	test('置信度值域在 [0,1] 内', () => {
		const matches = planner.classify('我登录了几次现在几点回显hello', ruleAdapter)
		for (const m of matches) {
			assert.ok(m.confidence >= 0 && m.confidence <= 1, '置信度越界: ' + m.confidence)
		}
	})
})

global.describe('planner 阶段二：工具序列规划', () => {
	test('单工具：只规划出一个调用', () => {
		const plan = planner.plan('我登录了几次', { adapter: ruleAdapter })
		assert.strictEqual(plan.confident, true)
		assert.strictEqual(plan.calls.length, 1)
		assert.strictEqual(plan.calls[0].tool, 'user-stats')
	})

	test('多工具串行：复合提问规划出两个调用', () => {
		const plan = planner.plan('我登录了几次现在几点', { adapter: ruleAdapter })
		assert.strictEqual(plan.confident, true)
		assert.strictEqual(plan.calls.length, 2, '应规划出 2 个工具')
		const tools = plan.calls.map(c => c.tool)
		assert.ok(tools.includes('user-stats'), '应包含 user-stats')
		assert.ok(tools.includes('server-time'), '应包含 server-time')
	})

	test('多工具顺序按置信度降序', () => {
		const plan = planner.plan('我登录了几次现在几点', { adapter: ruleAdapter })
		const confs = plan.calls.map(c => c.confidence)
		for (let i = 1; i < confs.length; i++) {
			assert.ok(confs[i - 1] >= confs[i], '调用顺序未按置信度排列')
		}
	})

	test('低置信度不产出工具序列', () => {
		const plan = planner.plan('今天天气怎么样', { adapter: ruleAdapter })
		assert.strictEqual(plan.confident, false)
		assert.strictEqual(plan.calls.length, 0, '不应产出工具调用')
		assert.strictEqual(plan.reason, 'no-intent-matched')
	})

	test('空输入被安全处理', () => {
		const plan = planner.plan('', { adapter: ruleAdapter })
		assert.strictEqual(plan.confident, false)
		assert.strictEqual(plan.reason, 'empty-input')
		assert.strictEqual(plan.calls.length, 0)
	})

	test('null / undefined 输入被安全处理', () => {
		assert.strictEqual(planner.plan(null, { adapter: ruleAdapter }).confident, false)
		assert.strictEqual(planner.plan(undefined, { adapter: ruleAdapter }).confident, false)
	})

	test('阈值可调：调高后普通提问也会降级', () => {
		const plan = planner.plan('我登录了几次', { adapter: ruleAdapter, threshold: 0.99 })
		assert.strictEqual(plan.confident, false)
		assert.strictEqual(plan.calls.length, 0)
	})

	test('适配器缺少 classify 时抛出明确错误', () => {
		assert.throws(() => planner.classify('测试', {}), /适配器必须实现/)
	})
})

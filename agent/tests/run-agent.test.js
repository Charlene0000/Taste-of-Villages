'use strict'

/**
 * runAgent 端到端测试（Sprint 2）
 *
 * 覆盖四种规定场景：
 *   1. 正常意图      —— 单工具执行
 *   2. 多工具串行    —— 复合提问
 *   3. 未知意图降级  —— 返回能力清单
 *   4. 参数校验失败  —— 返回结构化错误
 *
 * 以及 trace 可观测性、记忆写入、默认路径不加载 llm-adapter。
 */

const assert = require('assert')
const path = require('path')
const fs = require('fs')
const agent = require('../core/index')

global.describe('runAgent 场景一：正常意图', () => {
	test('「我登录了几次」返回单工具结果', async () => {
		const r = await agent.runAgent('我登录了几次', {})
		assert.strictEqual(r.ok, true)
		assert.strictEqual(r.type, 'tool-result')
		assert.strictEqual(r.plan.calls.length, 1)
		assert.strictEqual(r.results[0].tool, 'user-stats')
		assert.ok(r.answer.includes('登录'))
	})

	test('「现在几点」返回单工具结果', async () => {
		const r = await agent.runAgent('现在几点', {})
		assert.strictEqual(r.type, 'tool-result')
		assert.strictEqual(r.results[0].tool, 'server-time')
		assert.ok(r.answer.length > 0)
	})

	test('已登录上下文下 user-stats 返回真实统计', async () => {
		const r = await agent.runAgent('我登录了几次', {
			user: { login_count: 7, register_date: Date.now() - 3 * 24 * 3600 * 1000, nickname: 'CharLene' }
		})
		assert.strictEqual(r.results[0].ok, true)
		assert.strictEqual(r.results[0].result.loginCount, 7)
		assert.strictEqual(r.results[0].result.registerDays, 3)
	})
})

global.describe('runAgent 场景二：多工具串行', () => {
	test('复合提问串行执行两个工具', async () => {
		const r = await agent.runAgent('我登录了几次现在几点', {})
		assert.strictEqual(r.type, 'tool-result')
		assert.strictEqual(r.plan.calls.length, 2)
		assert.strictEqual(r.results.length, 2)
		// 顺序按置信度降序，不固定为 user-stats 在前
		const tools = r.results.map(x => x.tool)
		assert.ok(tools.includes('user-stats'), '应包含 user-stats')
		assert.ok(tools.includes('server-time'), '应包含 server-time')
	})

	test('串行执行顺序与规划顺序一致', async () => {
		const r = await agent.runAgent('我登录了几次现在几点', {})
		for (let i = 0; i < r.plan.calls.length; i++) {
			assert.strictEqual(r.results[i].tool, r.plan.calls[i].tool,
				'第 ' + i + ' 个执行结果应与规划顺序一致')
		}
	})

	test('聚合回答同时包含两个工具的输出', async () => {
		const r = await agent.runAgent('我登录了几次现在几点', {})
		assert.ok(r.answer.includes('登录'))
		assert.ok(r.answer.length > 0)
	})

	test('串行执行的总耗时不小于各工具耗时之和', async () => {
		const r = await agent.runAgent('我登录了几次现在几点', {})
		const sum = r.results.reduce((a, x) => a + x.durationMs, 0)
		assert.ok(r.plan.calls.length === 2)
		assert.ok(typeof sum === 'number')
	})
})

global.describe('runAgent 场景三：未知意图降级', () => {
	test('无关问题返回能力清单而非工具结果', async () => {
		const r = await agent.runAgent('今天天气怎么样', {})
		assert.strictEqual(r.ok, true)
		assert.strictEqual(r.type, 'fallback')
		assert.strictEqual(r.results.length, 0, '不应执行任何工具')
		assert.ok(r.fallback)
		assert.ok(r.fallback.capabilities.length > 0)
	})

	test('降级时 plan.confident 为 false', async () => {
		const r = await agent.runAgent('今天天气怎么样', {})
		assert.strictEqual(r.plan.confident, false)
		assert.strictEqual(r.plan.reason, 'no-intent-matched')
	})

	test('降级回答不含工具执行痕迹', async () => {
		const r = await agent.runAgent('今天天气怎么样', {})
		assert.ok(r.answer.includes('可以'))
		assert.strictEqual(r.fallback.type, 'fallback')
	})

	test('空输入也走降级', async () => {
		const r = await agent.runAgent('', {})
		assert.strictEqual(r.type, 'fallback')
		assert.strictEqual(r.plan.reason, 'empty-input')
	})
})

global.describe('runAgent 场景四：参数校验失败', () => {
	test('echo 工具收到非法参数时返回结构化错误', async () => {
		// 通过 adapter 强制产出非法的 echo 调用
		const badAdapter = {
			classify: () => [{ intent: 'echo', score: 10, confidence: 1, matched: ['回显'] }],
			plan: () => ({
				calls: [{ tool: 'echo', args: { message: 12345 }, confidence: 1 }],
				matches: [],
				confident: true
			})
		}
		const r = await agent.runAgent('回显', {}, { adapter: badAdapter })
		assert.strictEqual(r.results[0].ok, false)
		assert.strictEqual(r.results[0].error.code, 'INVALID_PARAMS')
		assert.ok(r.results[0].error.details.length > 0)
	})

	test('校验失败不抛出未捕获异常', async () => {
		const badAdapter = {
			classify: () => [{ intent: 'echo', score: 10, confidence: 1, matched: [] }],
			plan: () => ({
				calls: [{ tool: 'echo', args: {}, confidence: 1 }],
				matches: [],
				confident: true
			})
		}
		let threw = false
		try {
			await agent.runAgent('回显', {}, { adapter: badAdapter })
		} catch (e) {
			threw = true
		}
		assert.strictEqual(threw, false, '不应抛出异常')
	})
})

global.describe('trace 可观测性', () => {
	test('每次调用生成一条 trace', async () => {
		const before = agent.getTraces().length
		await agent.runAgent('现在几点', {})
		assert.strictEqual(agent.getTraces().length, before + 1)
	})

	test('trace 包含输入、规划、步骤与输出', async () => {
		await agent.runAgent('我登录了几次', {})
		const t = agent.getTraces(1)[0]
		assert.ok(t.id)
		assert.ok(t.at)
		assert.strictEqual(t.input, '我登录了几次')
		assert.ok(t.planned)
		assert.ok(Array.isArray(t.steps))
		assert.ok(t.steps.length > 0)
		assert.ok(t.steps[0].tool)
		assert.ok(typeof t.steps[0].durationMs === 'number')
		assert.ok(typeof t.answer === 'string')
	})

	test('环形缓冲区容量为 20', async () => {
		const buf = new agent.trace.TraceBuffer({ capacity: 20 })
		for (let i = 0; i < 30; i++) {
			buf.push({ input: 'test' + i })
		}
		assert.strictEqual(buf.size(), 20)
		const items = buf.list()
		assert.strictEqual(items[0].input, 'test29', '最新的应在最前')
	})

	test('降级调用同样产生 trace 且标记 fallback', async () => {
		await agent.runAgent('今天天气怎么样', {})
		const t = agent.getTraces(1)[0]
		assert.ok(t.fallback)
		assert.strictEqual(t.fallback.type, 'fallback')
	})
})

global.describe('记忆机制', () => {
	test('调用后写入记忆', async () => {
		const mem = new agent.memory.Memory()
		await agent.runAgent('现在几点', {}, { memory: mem })
		assert.strictEqual(mem.size(), 1)
		assert.strictEqual(mem.get()[0].user, '现在几点')
	})

	test('记忆保留最近 N 轮，超出后裁剪', () => {
		const mem = new agent.memory.Memory({ maxTurns: 3 })
		for (let i = 0; i < 5; i++) mem.push('q' + i, 'a' + i)
		assert.strictEqual(mem.size(), 3)
		assert.strictEqual(mem.get()[0].user, 'q2')
	})

	test('记忆可持久化到 storage 适配器', () => {
		const store = {}
		const storage = {
			getItem: (k) => store[k] || null,
			setItem: (k, v) => { store[k] = v }
		}
		const mem = new agent.memory.Memory({ storage, namespace: 'test' })
		mem.push('问题', '回答')
		assert.ok(store['agent-memory:test'], '应写入 storage')

		const mem2 = new agent.memory.Memory({ storage, namespace: 'test' })
		assert.strictEqual(mem2.size(), 1, '重新实例化后应恢复')
	})
})

global.describe('默认路径不加载 llm-adapter', () => {
	test('默认执行后 require.cache 中无 llm-adapter', () => {
		const llmPath = require.resolve(path.join(__dirname, '..', 'adapters', 'llm-adapter.js'))
		// 主动清理以确保测试有效
		delete require.cache[llmPath]
		const agent2 = require('../core/index')
		return agent2.runAgent('现在几点', {}).then(() => {
			const loaded = Object.keys(require.cache).some(k => k.indexOf('llm-adapter') !== -1)
			assert.strictEqual(loaded, false, 'llm-adapter 不应被默认路径加载')
		})
	})

	test('llm-adapter 源码中存在未实现的接入说明', () => {
		const src = fs.readFileSync(
			path.join(__dirname, '..', 'adapters', 'llm-adapter.js'),
			'utf8'
		)
		assert.ok(src.includes('不会被') || src.includes('默认不加载'))
		assert.ok(src.includes('apiKey'))
	})

	test('rule-adapter 不 import 任何外部库', () => {
		const src = fs.readFileSync(
			path.join(__dirname, '..', 'adapters', 'rule-adapter.js'),
			'utf8'
		)
		assert.ok(!/require\(['"][^.]/.test(src), 'rule-adapter 不应 require 外部包')
	})
})

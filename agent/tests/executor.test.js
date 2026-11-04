'use strict'

/**
 * executor 单元测试（Sprint 2）
 *
 * 覆盖：正常执行、参数校验失败（返回结构化错误而非抛异常）、
 *       未注册工具、工具内部异常、多工具串行与结果聚合。
 */

const assert = require('assert')
const executor = require('../core/executor')
const registry = require('../tools/index')

global.describe('executor 工具调度', () => {
	test('正常执行返回 ok=true', async () => {
		const r = await executor.runTool('server-time', { format: 'iso' }, {})
		assert.strictEqual(r.ok, true)
		assert.ok(r.result.time)
		assert.ok(r.durationMs >= 0)
	})

	test('未注册的工具返回结构化错误', async () => {
		const r = await executor.runTool('not-exist-tool', {}, {})
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.error.code, 'TOOL_NOT_FOUND')
		assert.ok(r.error.message)
	})

	test('参数类型错误返回结构化错误，不抛异常', async () => {
		const r = await executor.runTool('echo', { message: 123 }, {})
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.error.code, 'INVALID_PARAMS')
		assert.ok(Array.isArray(r.error.details))
		assert.ok(r.error.details.length > 0)
	})

	test('缺少必填参数返回结构化错误', async () => {
		const r = await executor.runTool('echo', {}, {})
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.error.code, 'INVALID_PARAMS')
		assert.ok(r.error.details.some(d => d.field === 'message'))
	})

	test('超出长度的参数被拒绝', async () => {
		const r = await executor.runTool('echo', { message: 'x'.repeat(500) }, {})
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.error.code, 'INVALID_PARAMS')
	})

	test('枚举外的参数被拒绝', async () => {
		const r = await executor.runTool('server-time', { format: 'unknown' }, {})
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.error.code, 'INVALID_PARAMS')
	})

	test('工具内部异常被捕获为结构化错误', async () => {
		registry.register({
			name: '__test_boom',
			description: '必定抛异常的工具',
			parameters: { type: 'object', properties: {}, required: [] },
			handler: async () => {
				throw new Error('内部炸了')
			}
		})
		const r = await executor.runTool('__test_boom', {}, {})
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.error.code, 'TOOL_EXECUTION_ERROR')
		assert.strictEqual(r.error.message, '内部炸了')
	})

	test('多工具串行执行，顺序保持', async () => {
		const r = await executor.run([
			{ tool: 'server-time', args: {} },
			{ tool: 'echo', args: { message: 'hi' } }
		], {})
		assert.strictEqual(r.ok, true)
		assert.strictEqual(r.results.length, 2)
		assert.strictEqual(r.results[0].tool, 'server-time')
		assert.strictEqual(r.results[1].tool, 'echo')
	})

	test('部分工具失败时 ok=false，但其余结果仍返回', async () => {
		const r = await executor.run([
			{ tool: 'server-time', args: {} },
			{ tool: 'echo', args: { message: 999 } }
		], {})
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.results.length, 2)
		assert.strictEqual(r.results[0].ok, true)
		assert.strictEqual(r.results[1].ok, false)
	})

	test('聚合函数把多个结果合并为一段文本', () => {
		const answer = executor.aggregate([
			{ tool: 'a', ok: true, result: { message: '第一段' } },
			{ tool: 'b', ok: true, result: { message: '第二段' } }
		])
		assert.ok(answer.includes('第一段'))
		assert.ok(answer.includes('第二段'))
	})

	test('全部失败时聚合结果说明失败原因', () => {
		const answer = executor.aggregate([
			{ tool: 'a', ok: false, error: { code: 'X', message: '出错了' } }
		])
		assert.ok(answer.includes('出错了'))
	})
})

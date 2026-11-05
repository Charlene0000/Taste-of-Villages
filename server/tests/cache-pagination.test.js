#!/usr/bin/env node
'use strict'

/**
 * 缓存层与分页单元测试（Sprint 5.4）
 *
 * 零依赖实现，无需启动服务器，直接 require 被测模块断言行为。
 * 覆盖：
 *   ① 缓存命中 / 未命中 / TTL 过期
 *   ② 标签失效（只失效受影响条目）
 *   ③ 并发去重（同一 key 只执行一次 loader）
 *   ④ LRU 上限淘汰
 *   ⑤ 分页参数解析（向后兼容：未传参 → 全量）
 *   ⑥ 分页切片与 hasMore 计算
 */

const assert = require('assert')
const path = require('path')

const cache = require(path.join(__dirname, '..', 'src', 'utils', 'cache.js'))
const { parsePagination, paginateArray, buildPagedResponse } = require(path.join(__dirname, '..', 'src', 'utils', 'pagination.js'))

const results = []

function test (name, fn) {
	return Promise.resolve()
		.then(fn)
		.then(() => {
			results.push({ name, ok: true })
			console.log('  ✅ ' + name)
		})
		.catch(e => {
			results.push({ name, ok: false, error: e.message })
			console.log('  ❌ ' + name + '\n     ' + e.message)
		})
}

/** 让出事件循环，等待 TTL 到期 */
function sleep (ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function run () {
	console.log('\n缓存层与分页单元测试')
	console.log('='.repeat(62))

	// ---------- 缓存：基本读写 ----------
	await test('缓存未命中返回 undefined', () => {
		cache.clear()
		assert.strictEqual(cache.get('nonexistent'), undefined)
	})

	await test('写入后可命中', () => {
		cache.clear()
		cache.set('k1', { a: 1 })
		assert.deepStrictEqual(cache.get('k1'), { a: 1 })
	})

	await test('TTL 到期后自动失效', async () => {
		cache.clear()
		cache.set('ttl', 'v', { ttl: 40 })
		assert.strictEqual(cache.get('ttl'), 'v')
		await sleep(70)
		assert.strictEqual(cache.get('ttl'), undefined, '过期后不应命中')
	})

	await test('统计信息记录命中与未命中', () => {
		cache.clear()
		cache.resetStats()
		cache.set('s', 1)
		cache.get('s')
		cache.get('missing')
		const stats = cache.getStats()
		assert.strictEqual(stats.hits, 1)
		assert.strictEqual(stats.misses, 1)
		assert.strictEqual(stats.hitRate, 50)
	})

	// ---------- 缓存：标签失效 ----------
	await test('按标签失效只清受影响条目', () => {
		cache.clear()
		cache.set('v:1', 'village', { tags: ['village'] })
		cache.set('f:1', 'food', { tags: ['food'] })
		cache.set('s:1', 'shop', { tags: ['shop'] })

		const count = cache.invalidate('village')
		assert.strictEqual(count, 1, '应只失效 1 条')
		assert.strictEqual(cache.get('v:1'), undefined, '村庄缓存应被清掉')
		assert.strictEqual(cache.get('f:1'), 'food', '美食缓存不受影响')
		assert.strictEqual(cache.get('s:1'), 'shop', '商品缓存不受影响')
	})

	await test('多标签一次性失效', () => {
		cache.clear()
		cache.set('a', 1, { tags: ['x'] })
		cache.set('b', 2, { tags: ['y'] })
		cache.set('c', 3, { tags: ['z'] })
		const count = cache.invalidate('x', 'y')
		assert.strictEqual(count, 2)
		assert.strictEqual(cache.get('c'), 3)
	})

	await test('重复写入同一 key 不残留旧标签', () => {
		cache.clear()
		cache.set('dup', 1, { tags: ['old'] })
		cache.set('dup', 2, { tags: ['new'] })
		cache.invalidate('old')
		assert.strictEqual(cache.get('dup'), 2, '旧标签不应误伤新值')
	})

	// ---------- 缓存：并发去重 ----------
	await test('并发同 key 请求只执行一次 loader', async () => {
		cache.clear()
		let calls = 0
		const loader = async () => {
			calls++
			await sleep(30)
			return 'computed'
		}
		const results = await Promise.all([
			cache.wrap('conc', loader, { ttl: 1000 }),
			cache.wrap('conc', loader, { ttl: 1000 }),
			cache.wrap('conc', loader, { ttl: 1000 })
		])
		assert.strictEqual(calls, 1, `loader 应只执行 1 次，实际 ${calls}`)
		results.forEach(r => assert.strictEqual(r, 'computed'))
	})

	await test('wrap 命中时不再调用 loader', async () => {
		cache.clear()
		let calls = 0
		const loader = async () => { calls++; return 'v' }
		await cache.wrap('w1', loader, { ttl: 1000 })
		await cache.wrap('w1', loader, { ttl: 1000 })
		assert.strictEqual(calls, 1)
	})

	await test('loader 抛错时不写缓存（下次可重试）', async () => {
		cache.clear()
		let calls = 0
		const failing = async () => { calls++; throw new Error('boom') }
		await assert.rejects(() => cache.wrap('err', failing, { ttl: 1000 }))
		assert.strictEqual(cache.get('err'), undefined, '失败不应留下缓存')
		await assert.rejects(() => cache.wrap('err', failing, { ttl: 1000 }))
		assert.strictEqual(calls, 2, '失败后应允许重试')
	})

	// ---------- 缓存：LRU 上限 ----------
	await test('超出上限时淘汰最旧条目', () => {
		cache.clear()
		cache.setMaxEntries(3)
		cache.set('e1', 1)
		cache.set('e2', 2)
		cache.set('e3', 3)
		cache.set('e4', 4)
		assert.strictEqual(cache.keys().length, 3, '条目数应受上限约束')
		assert.strictEqual(cache.get('e1'), undefined, '最旧条目应被淘汰')
		assert.strictEqual(cache.get('e4'), 4)
		cache.setMaxEntries(cache.DEFAULT_MAX_ENTRIES)
	})

	// ---------- 分页：参数解析 ----------
	await test('未传分页参数 → 不启用分页（向后兼容）', () => {
		const p = parsePagination({})
		assert.strictEqual(p.paginated, false)
		assert.strictEqual(p.offset, 0)
	})

	await test('传入 page → 启用分页并计算 offset', () => {
		const p = parsePagination({ page: '3', pageSize: '20' })
		assert.strictEqual(p.paginated, true)
		assert.strictEqual(p.page, 3)
		assert.strictEqual(p.pageSize, 20)
		assert.strictEqual(p.offset, 40)
	})

	await test('pageSize 超上限时被截断', () => {
		const p = parsePagination({ page: '1', pageSize: '99999' })
		assert.strictEqual(p.pageSize, 100, '应被截断到 MAX_PAGE_SIZE')
	})

	await test('非法参数回退到默认值', () => {
		const p = parsePagination({ page: 'abc', pageSize: '-5' })
		assert.strictEqual(p.paginated, false, '非法值不应意外启用分页')
	})

	// ---------- 分页：切片与响应 ----------
	await test('paginateArray 正确切片', () => {
		const rows = Array.from({ length: 25 }, (_, i) => i + 1)
		const p = parsePagination({ page: '2', pageSize: '10' })
		const r = paginateArray(rows, p)
		assert.strictEqual(r.rows.length, 10)
		assert.strictEqual(r.rows[0], 11)
		assert.strictEqual(r.total, 25)
		assert.strictEqual(r.hasMore, true)
	})

	await test('最后一页 hasMore 为 false', () => {
		const rows = Array.from({ length: 25 }, (_, i) => i + 1)
		const p = parsePagination({ page: '3', pageSize: '10' })
		const r = paginateArray(rows, p)
		assert.strictEqual(r.rows.length, 5)
		assert.strictEqual(r.hasMore, false)
	})

	await test('buildPagedResponse 保留 data 为数组并附 page 元信息', () => {
		const rows = [1, 2, 3]
		const p = parsePagination({ page: '1', pageSize: '3' })
		const res = buildPagedResponse(rows, p, 10)
		assert.strictEqual(res.code, 200)
		assert.ok(Array.isArray(res.data), 'data 必须仍是数组（旧前端零改动）')
		assert.strictEqual(res.data.length, 3)
		assert.strictEqual(res.page.total, 10)
		assert.strictEqual(res.page.hasMore, true)
	})

	await test('未启用分页时返回全量且 hasMore=false', () => {
		const rows = [1, 2, 3, 4, 5]
		const p = parsePagination({})
		const res = buildPagedResponse(rows, p, 5)
		assert.strictEqual(res.data.length, 5)
		assert.strictEqual(res.page.hasMore, false)
	})

	// ---------- 汇总 ----------
	console.log('\n' + '='.repeat(62))
	const passed = results.filter(r => r.ok).length
	const failed = results.filter(r => !r.ok)
	console.log(`结果: ${passed}/${results.length} 通过`)
	if (failed.length) {
		console.log('\n失败项:')
		failed.forEach(f => console.log('  ❌ ' + f.name + '\n     ' + f.error))
		process.exitCode = 1
	} else {
		console.log('缓存与分页单元测试全部通过 ✅')
	}
}

run().catch(e => {
	console.error('测试运行异常:', e)
	process.exitCode = 1
})

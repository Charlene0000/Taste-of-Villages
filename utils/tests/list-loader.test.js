#!/usr/bin/env node
'use strict'

/**
 * 长列表增量加载 mixin 测试（Sprint 5.4）
 *
 * 零依赖实现，不依赖 Vue 运行时 ——
 * 把 mixin 的 data/methods 抽出来，用一个最小化的 this 上下文驱动。
 *
 * 覆盖：
 *   ① 首页覆盖、后续页追加
 *   ② 分页元信息同步（page / hasMore / total）
 *   ③ 后端未启用分页时退化为一次性加载
 *   ④ hasMore 为 false 时不再触发追加
 *   ⑤ 并发保护（加载中重复调用被忽略）
 *   ⑥ 触底加载与刷新重置
 *   ⑦ mapItem 映射与错误处理
 */

const assert = require('assert')
const path = require('path')

const { listLoaderMixin } = require(path.join(__dirname, '..', '..', 'utils', 'list-loader.js'))

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

/**
 * 构造一个最小化的组件实例（模拟 Vue 的 data/methods 绑定）
 */
function createInstance (mixinOptions, initialData = {}) {
	const mixin = listLoaderMixin(mixinOptions)
	const ctx = Object.assign({}, initialData)

	// 绑定 data
	Object.keys(mixin.data()).forEach(key => {
		ctx[key] = mixin.data()[key]
	})

	// 绑定 methods
	Object.keys(mixin.methods).forEach(key => {
		ctx[key] = mixin.methods[key].bind(ctx)
	})

	return ctx
}

/** 构造一个分页响应 */
function paged (rows, meta) {
	return { code: 200, data: rows, page: meta }
}

async function run () {
	console.log('\n长列表增量加载 mixin 测试')
	console.log('='.repeat(62))

	// ---------- ① 首页覆盖 / 后续追加 ----------
	await test('首页加载填充列表', async () => {
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async (page) => paged(
				[{ id: page * 2 - 1 }, { id: page * 2 }],
				{ page, pageSize: 2, total: 4, hasMore: page < 2 }
			)
		})
		await ctx.loadItemsPage(1, true)
		assert.strictEqual(ctx.items.length, 2)
		assert.strictEqual(ctx.items[0].id, 1)
	})

	await test('第二页追加到已有列表之后', async () => {
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async (page) => paged(
				[{ id: page * 2 - 1 }, { id: page * 2 }],
				{ page, pageSize: 2, total: 4, hasMore: page < 2 }
			)
		})
		await ctx.loadItemsPage(1, true)
		await ctx.loadItemsPage(2, false)
		assert.strictEqual(ctx.items.length, 4)
		assert.strictEqual(ctx.items[3].id, 4, '第二页应接在第一页之后')
	})

	// ---------- ② 分页元信息 ----------
	await test('分页元信息同步到组件状态', async () => {
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async (page) => paged([], { page, pageSize: 2, total: 10, hasMore: true })
		})
		await ctx.loadItemsPage(1, true)
		assert.strictEqual(ctx.itemsPage, 1)
		assert.strictEqual(ctx.itemsHasMore, true)
		assert.strictEqual(ctx.itemsTotal, 10)
	})

	await test('hasMore 为 false 时不再触发追加请求', async () => {
		let calls = 0
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async (page) => {
				calls++
				return paged([{ id: 1 }], { page, pageSize: 2, total: 1, hasMore: false })
			}
		})
		await ctx.loadItemsPage(1, true)
		assert.strictEqual(calls, 1)
		await ctx.loadMoreItems()
		assert.strictEqual(calls, 1, 'hasMore=false 时不应再发请求')
	})

	// ---------- ③ 未启用分页的后端 ----------
	await test('后端未返回 page 字段 → 退化为一次性加载', async () => {
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async () => ({ code: 200, data: [{ id: 1 }, { id: 2 }] })
		})
		await ctx.loadItemsPage(1, true)
		assert.strictEqual(ctx.items.length, 2)
		assert.strictEqual(ctx.itemsHasMore, false, '无分页信息时应视为已加载完')
		assert.strictEqual(ctx.itemsTotal, 2)
	})

	// ---------- ④ 并发保护 ----------
	await test('加载中重复调用被忽略（并发保护）', async () => {
		let calls = 0
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async (page) => {
				calls++
				await new Promise(r => setTimeout(r, 30))
				return paged([{ id: page }], { page, pageSize: 2, total: 10, hasMore: true })
			}
		})
		const p1 = ctx.loadItemsPage(1, true)
		const p2 = ctx.loadItemsPage(2, false)
		await Promise.all([p1, p2])
		assert.strictEqual(calls, 1, `并发时应只发 1 次请求，实际 ${calls}`)
	})

	// ---------- ⑤ 触底与刷新 ----------
	await test('loadMore 加载下一页并推进页码', async () => {
		const seen = []
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async (page) => {
				seen.push(page)
				return paged([{ id: page }], { page, pageSize: 2, total: 5, hasMore: page < 3 })
			}
		})
		await ctx.loadItemsPage(1, true)
		await ctx.loadMoreItems()
		assert.deepStrictEqual(seen, [1, 2])
		assert.strictEqual(ctx.itemsPage, 2)
		assert.strictEqual(ctx.items.length, 2)
	})

	await test('reload 重置到第一页并覆盖列表', async () => {
		const seen = []
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async (page) => {
				seen.push(page)
				return paged([{ id: page }], { page, pageSize: 2, total: 5, hasMore: true })
			}
		})
		await ctx.loadItemsPage(1, true)
		await ctx.loadItemsPage(2, false)
		await ctx.reloadItems()
		assert.deepStrictEqual(seen, [1, 2, 1], 'reload 应重新拉第一页')
		assert.strictEqual(ctx.items.length, 1, 'reload 应覆盖而非追加')
		assert.strictEqual(ctx.itemsPage, 1)
	})

	// ---------- ⑥ mapItem 与错误 ----------
	await test('mapItem 对每条数据做映射', async () => {
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async () => paged([{ n: 1 }, { n: 2 }], { page: 1, pageSize: 2, total: 2, hasMore: false }),
			mapItem: (row) => ({ doubled: row.n * 2 })
		})
		await ctx.loadItemsPage(1, true)
		assert.deepStrictEqual(ctx.items, [{ doubled: 2 }, { doubled: 4 }])
	})

	await test('请求抛错时记录错误信息且不崩溃', async () => {
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async () => { throw new Error('网络断了') }
		})
		await ctx.loadItemsPage(1, true)
		assert.strictEqual(ctx.itemsError, '网络断了')
		assert.strictEqual(ctx.itemsLoading, false, '异常后必须复位加载态')
	})

	await test('业务码非 200 时记录错误信息', async () => {
		const ctx = createInstance({
			listKey: 'items',
			pageSize: 2,
			fetcher: async () => ({ code: 400, errMsg: '参数错误' })
		})
		await ctx.loadItemsPage(1, true)
		assert.strictEqual(ctx.itemsError, '参数错误')
	})

	await test('缺少 fetcher 时立即报错', () => {
		assert.throws(() => listLoaderMixin({}), /fetcher/)
	})

	// ---------- ⑦ 命名空间隔离 ----------
	await test('方法名按 listKey 隔离（可共存多实例）', () => {
		const m1 = listLoaderMixin({ listKey: 'photosList', fetcher: async () => ({}) })
		const m2 = listLoaderMixin({ listKey: 'myItems', fetcher: async () => ({}) })
		assert.ok(m1.methods.loadPhotosListPage, '应生成 loadPhotosListPage')
		assert.ok(m1.methods.loadMorePhotosList, '应生成 loadMorePhotosList')
		assert.ok(m1.methods.reloadPhotosList, '应生成 reloadPhotosList')
		assert.ok(m2.methods.loadMyItemsPage, '应生成 loadMyItemsPage')
		assert.ok(!m2.methods.loadPhotosListPage, '不应出现别的列表的方法名')
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
		console.log('长列表加载 mixin 测试全部通过 ✅')
	}
}

run().catch(e => {
	console.error('测试运行异常:', e)
	process.exitCode = 1
})

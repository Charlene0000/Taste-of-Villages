'use strict'

/**
 * 轻量级数据缓存层（自研）
 *
 * 为什么不引 Redis
 * ---------------
 * 本项目的定位是「零配置、零外部依赖、零成本即可跑通」。
 * 引入 Redis 会破坏这一硬指标（需要额外进程、额外端口、额外运维）。
 *
 * 但完全不做缓存也不可接受：基础数据（村庄 / 美食 / 商品 / 题库）在
 * SQLite 落地后是**读多写极少**的静态数据，每次请求都打 DB 是纯粹的浪费。
 *
 * 因此实现一个进程内缓存：
 *   - TTL 自动过期（避免脏数据长期驻留）
 *   - 标签失效（tag-based invalidation，写操作只失效受影响的标签）
 *   - 命中统计（可观测：命中率、命中/未命中次数）
 *   - 并发去重（同一 key 的并发请求只真正执行一次 loader）
 *
 * 何时应该换成 Redis
 * -----------------
 * 当出现以下任一情况时，本层的内存语义就不再够用：
 *   1. 多实例部署（缓存需要跨进程共享）
 *   2. 缓存数据量超出进程内存承受范围
 *   3. 需要持久化缓存（重启不能丢）
 * 届时把 `get/set/del` 三个方法替换为 Redis 实现即可，
 * 调用方无需改动 —— 这是本层刻意保持窄接口的原因。
 */

const DEFAULT_TTL = 60 * 1000 // 60s
const DEFAULT_MAX_ENTRIES = 200

/**
 * @typedef {Object} CacheEntry
 * @property {any} value        缓存值
 * @property {number} expireAt   过期时间戳（ms）
 * @property {string[]} tags     所属标签
 * @property {number} createdAt  写入时间戳
 */

/** key → CacheEntry */
const store = new Map()
/** tag → Set<key> */
const tagIndex = new Map()

/** 统计信息 */
const stats = {
	hits: 0,
	misses: 0,
	sets: 0,
	evictions: 0,
	invalidations: 0
}

/** key → Promise（用于并发去重） */
const inflight = new Map()

/** 全局配置（可在测试中覆盖） */
let maxEntries = DEFAULT_MAX_ENTRIES

/**
 * 设置缓存条目上限
 * @param {number} n
 */
function setMaxEntries (n) {
	maxEntries = Math.max(1, parseInt(n, 10) || DEFAULT_MAX_ENTRIES)
	evictIfNeeded()
}

/**
 * 淘汰超出上限的条目（LRU：最先写入的先淘汰）
 */
function evictIfNeeded () {
	while (store.size > maxEntries) {
		const oldestKey = store.keys().next().value
		if (oldestKey === undefined) break
		removeEntry(oldestKey)
		stats.evictions++
	}
}

/**
 * 删除单个条目并清理标签索引
 * @param {string} key
 */
function removeEntry (key) {
	const entry = store.get(key)
	if (!entry) return false
	store.delete(key)
	entry.tags.forEach(tag => {
		const set = tagIndex.get(tag)
		if (!set) return
		set.delete(key)
		if (set.size === 0) tagIndex.delete(tag)
	})
	return true
}

/**
 * 读取缓存
 * @param {string} key
 * @returns {any|undefined} 命中返回值，未命中返回 undefined
 */
function get (key) {
	const entry = store.get(key)
	if (!entry) {
		stats.misses++
		return undefined
	}
	if (entry.expireAt <= Date.now()) {
		removeEntry(key)
		stats.misses++
		return undefined
	}
	stats.hits++
	return entry.value
}

/**
 * 写入缓存
 * @param {string} key
 * @param {any} value
 * @param {Object} [options]
 * @param {number} [options.ttl]      存活毫秒数
 * @param {string[]} [options.tags]   关联标签，用于批量失效
 */
function set (key, value, options = {}) {
	const ttl = Math.max(1, parseInt(options.ttl, 10) || DEFAULT_TTL)
	const tags = Array.isArray(options.tags) ? options.tags.filter(Boolean) : []

	// 同一 key 重复写入时，先清掉旧标签索引，避免残留
	if (store.has(key)) removeEntry(key)

	store.set(key, {
		value,
		expireAt: Date.now() + ttl,
		tags,
		createdAt: Date.now()
	})
	stats.sets++

	tags.forEach(tag => {
		if (!tagIndex.has(tag)) tagIndex.set(tag, new Set())
		tagIndex.get(tag).add(key)
	})

	evictIfNeeded()
	return value
}

/**
 * 按 key 删除
 * @param {string} key
 * @returns {boolean} 是否确实删除了
 */
function del (key) {
	const removed = removeEntry(key)
	if (removed) stats.invalidations++
	return removed
}

/**
 * 按标签批量失效
 *
 * 用于「写操作只失效受影响数据」的场景：
 * 例如保存照片后只需要失效 user-photos 标签，而不是清空整个缓存。
 *
 * @param {...string} tags
 * @returns {number} 失效的条目数
 */
function invalidate (...tags) {
	const flat = tags.flat().filter(Boolean)
	let count = 0
	flat.forEach(tag => {
		const set = tagIndex.get(tag)
		if (!set) return
		// 复制一份，避免遍历中修改集合
		Array.from(set).forEach(key => {
			if (removeEntry(key)) count++
		})
		tagIndex.delete(tag)
	})
	stats.invalidations += count
	return count
}

/**
 * 清空缓存
 */
function clear () {
	const size = store.size
	store.clear()
	tagIndex.clear()
	stats.invalidations += size
	return size
}

/**
 * 带缓存的加载器
 *
 * 命中直接返回；未命中则执行 loader 并写入缓存。
 * 同一 key 的并发调用会共享同一个 Promise（并发去重），
 * 避免「缓存击穿」——大量请求同时打在一个刚失效的 key 上。
 *
 * @param {string} key
 * @param {() => Promise<any>|any} loader
 * @param {Object} [options] 同 set 的 options
 * @returns {Promise<any>}
 */
async function wrap (key, loader, options = {}) {
	const cached = get(key)
	if (cached !== undefined) return cached

	// 并发去重：已有进行中的加载则复用
	const pending = inflight.get(key)
	if (pending) return pending

	const promise = (async () => {
		try {
			const value = await loader()
			// loader 抛错时不写缓存，让下次请求重试
			if (value !== undefined) set(key, value, options)
			return value
		} finally {
			inflight.delete(key)
		}
	})()

	inflight.set(key, promise)
	return promise
}

/**
 * 读取统计信息
 */
function getStats () {
	const total = stats.hits + stats.misses
	return {
		...stats,
		entries: store.size,
		tags: tagIndex.size,
		hitRate: total === 0 ? 0 : Math.round((stats.hits / total) * 10000) / 100
	}
}

/**
 * 重置统计（测试用）
 */
function resetStats () {
	stats.hits = 0
	stats.misses = 0
	stats.sets = 0
	stats.evictions = 0
	stats.invalidations = 0
}

/**
 * 列出当前所有 key（调试 / 健康检查用）
 */
function keys () {
	return Array.from(store.keys())
}

module.exports = {
	get,
	set,
	del,
	invalidate,
	clear,
	wrap,
	getStats,
	resetStats,
	keys,
	setMaxEntries,
	DEFAULT_TTL,
	DEFAULT_MAX_ENTRIES
}

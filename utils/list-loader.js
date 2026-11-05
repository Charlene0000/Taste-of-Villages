/**
 * 长列表增量加载 mixin（自研）
 *
 * 解决的问题
 * ----------
 * 用户态列表（相册、订单、手账）会随使用时长无限增长。
 * 早期实现一次性拉全量再渲染，代价有三：
 *   ① 响应体随数据量线性膨胀 → 网络延迟上升
 *   ② 一次性创建大量 DOM 节点 → 首屏渲染卡顿、真机内存飙升
 *   ③ 弱网下用户盯着白屏等待全部数据
 *
 * 做法：分页拉取 + 触底增量加载（滚动到底部再拉下一页）。
 * 首屏只渲染 PAGE_SIZE 条，滚动时才追加，DOM 节点数与已浏览深度成正比，
 * 而不是与总数据量成正比。
 *
 * 使用方式
 * --------
 *   import { listLoaderMixin } from '@/utils/list-loader.js'
 *
 *   export default {
 *     mixins: [listLoaderMixin({ fetcher: (page, pageSize) => businessApi.getUserPhotos({ page, pageSize }) })],
 *     ...
 *   }
 *
 *   // 模板里
 *   <view v-for="(item, index) in list" :key="item.id"> ... </view>
 *   <view v-if="listLoadingMore">加载中...</view>
 *   <view v-else-if="!listHasMore && list.length">没有更多了</view>
 *
 * 方法名按 listKey 生成命名空间：
 *   load<Cap>Page(page, reset) · loadMore<Cap>() · reload<Cap>()
 * 因此同一组件可混入多个实例而互不覆盖。
 *
 * 兼容性
 * ------
 * 未传分页参数的旧接口依然可用 —— fetcher 返回的响应没有 `page` 字段时，
 * mixin 退化为「一次性加载 + 不再追加」的老行为。
 */

/** 默认每页条数 */
export const DEFAULT_PAGE_SIZE = 12

/**
 * 创建长列表加载 mixin
 *
 * @param {Object} options
 * @param {Function} options.fetcher  (page, pageSize) => Promise<响应体>
 *        响应体需满足：{ code:200, data:Array, page:{ page, pageSize, total, hasMore } }
 * @param {number} [options.pageSize] 每页条数，默认 12
 * @param {string} [options.listKey]   列表数据挂载到哪个字段，默认 'list'
 * @param {boolean} [options.immediate] 是否在 created 阶段自动加载第一页，默认 true
 * @param {Function} [options.onLoaded] 每页加载完成后的回调 (list, meta) => void
 * @param {Function} [options.mapItem]  单条数据映射 (row) => row
 * @returns {Object} Vue mixin
 */
export function listLoaderMixin (options = {}) {
	const {
		fetcher,
		pageSize = DEFAULT_PAGE_SIZE,
		listKey = 'list',
		immediate = true,
		onLoaded = null,
		mapItem = null
	} = options

	if (typeof fetcher !== 'function') {
		throw new Error('[list-loader] 必须提供 fetcher 函数')
	}

	// 方法名按列表命名空间生成（如 loadPhotosListPage / loadMorePhotosList / reloadPhotosList），
	// 这样同一个组件可以混入多个 listLoaderMixin 而互不覆盖。
	const cap = listKey.charAt(0).toUpperCase() + listKey.slice(1)

	return {
		data () {
			return {
				// 分页状态
				[`${listKey}Page`]: 1,
				[`${listKey}HasMore`]: true,
				[`${listKey}Total`]: 0,
				[`${listKey}LoadingMore`]: false,
				// 首屏加载中（与「加载更多」区分，避免整页闪烁）
				[`${listKey}Loading`]: true,
				[`${listKey}Error`]: ''
			}
		},

		created () {
			if (immediate) this[`load${cap}Page`](1, true)
		},

		methods: {
			/**
			 * 加载指定页
			 *
			 * @param {number} [page] 页码，默认当前页 + 1
			 * @param {boolean} [reset] 是否重置列表（首页刷新时传 true）
			 */
			async [`load${cap}Page`] (page, reset = false) {
				const targetPage = page || (this[`${listKey}Page`] + 1)

				// 并发保护：加载中直接返回，避免触底事件连续触发导致重复请求
				if (this[`${listKey}LoadingMore`]) return
				if (!reset && !this[`${listKey}HasMore`]) return

				this[`${listKey}LoadingMore`] = true
				if (reset) this[`${listKey}Loading`] = true
				this[`${listKey}Error`] = ''

				try {
					const res = await fetcher(targetPage, pageSize)

					if (!res || res.code !== 200) {
						this[`${listKey}Error`] = (res && (res.errMsg || res.message)) || '加载失败'
						return
					}

					const rows = Array.isArray(res.data) ? res.data : []
					const items = mapItem ? rows.map(mapItem) : rows

					// 首页覆盖，后续页追加
					if (reset || targetPage === 1) {
						this[listKey] = items
					} else {
						this[listKey] = this[listKey].concat(items)
					}

					// 分页元信息 —— 后端未启用分页时 page 字段缺失，
					// 此时退化为「一次性加载完毕」，不再触发追加。
					const meta = res.page || null
					if (meta) {
						this[`${listKey}Page`] = meta.page || targetPage
						this[`${listKey}HasMore`] = !!meta.hasMore
						this[`${listKey}Total`] = meta.total || 0
					} else {
						this[`${listKey}Page`] = targetPage
						this[`${listKey}HasMore`] = false
						this[`${listKey}Total`] = this[listKey].length
					}

					if (typeof onLoaded === 'function') {
						onLoaded.call(this, this[listKey], meta)
					}
				} catch (e) {
					console.error('[list-loader] 加载失败:', e && e.message)
					this[`${listKey}Error`] = (e && e.message) || '网络异常'
				} finally {
					this[`${listKey}LoadingMore`] = false
					this[`${listKey}Loading`] = false
				}
			},

			/** 触底加载下一页 */
			[`loadMore${cap}`] () {
				if (!this[`${listKey}HasMore`]) return
				if (this[`${listKey}LoadingMore`]) return
				this[`load${cap}Page`](this[`${listKey}Page`] + 1, false)
			},

			/** 刷新（回到第一页） */
			[`reload${cap}`] () {
				this[`${listKey}Page`] = 1
				this[`${listKey}HasMore`] = true
				this[`${listKey}Total`] = 0
				return this[`load${cap}Page`](1, true)
			}
		}
	}
}

export default listLoaderMixin

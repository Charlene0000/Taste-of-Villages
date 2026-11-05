'use strict'

/**
 * 分页参数解析与切片（自研）
 *
 * 设计原则：**向后兼容**
 *   - 未传 page / pageSize 时，返回全量（与优化前行为完全一致）
 *   - 这样前端可以逐页接入，任意时刻回退到旧版本都不会白屏
 *
 * 为什么要分页
 * -----------
 * 用户照片 / 打卡记录 / 订单属于「只增不减」的用户态数据，
 * 全量返回会让响应体随使用时长线性膨胀，最终拖垮渲染与网络。
 * 分页把单次负载从 O(n) 收敛为 O(pageSize)。
 */

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 20
/** 每页条数上限（防止恶意传 pageSize=999999 拖垮服务端） */
const MAX_PAGE_SIZE = 100

/**
 * 解析分页参数
 *
 * @param {Object} [query] req.query
 * @param {Object} [options]
 * @param {number} [options.defaultSize] 未传参时的默认条数
 * @param {number} [options.maxSize]      每页条数上限
 * @returns {{page:number, pageSize:number, offset:number, hasMore:boolean, paginated:boolean}}
 */
function parsePagination (query = {}, options = {}) {
	const defaultSize = options.defaultSize || DEFAULT_PAGE_SIZE
	const maxSize = options.maxSize || MAX_PAGE_SIZE

	const rawPage = parseInt(query.page, 10)
	const rawSize = parseInt(query.pageSize, 10)

	const hasPage = Number.isFinite(rawPage) && rawPage > 0
	const hasSize = Number.isFinite(rawSize) && rawSize > 0

	// 两个都没传 → 未启用分页，返回全量
	if (!hasPage && !hasSize) {
		return {
			page: 1,
			pageSize: defaultSize,
			offset: 0,
			hasMore: false,
			paginated: false
		}
	}

	const page = hasPage ? rawPage : 1
	const pageSize = Math.min(maxSize, hasSize ? rawSize : defaultSize)
	const offset = (page - 1) * pageSize

	return {
		page,
		pageSize,
		offset,
		hasMore: false, // 由调用方结合 total 填充
		paginated: true
	}
}

/**
 * 对内存数组分页
 *
 * @param {Array} rows
 * @param {ReturnType<typeof parsePagination>} pagination
 * @returns {{rows: Array, total: number, page: number, pageSize: number, hasMore: boolean}}
 */
function paginateArray (rows, pagination) {
	const list = Array.isArray(rows) ? rows : []
	const total = list.length

	if (!pagination.paginated) {
		return {
			rows: list,
			total,
			page: 1,
			pageSize: total,
			hasMore: false
		}
	}

	const sliced = list.slice(pagination.offset, pagination.offset + pagination.pageSize)
	return {
		rows: sliced,
		total,
		page: pagination.page,
		pageSize: pagination.pageSize,
		hasMore: pagination.offset + sliced.length < total
	}
}

/**
 * 组装分页响应体
 *
 * 保持 `data` 字段形状不变（仍然是数组），
 * 分页元信息单独放在 `page` 字段 —— 前端老代码零改动即可继续工作。
 *
 * @param {Array} rows
 * @param {ReturnType<typeof parsePagination>} pagination
 * @param {number} total 全量总数（数据库 count 查询结果）
 * @returns {{code:number, data:Array, page:Object}}
 */
function buildPagedResponse (rows, pagination, total) {
	const list = Array.isArray(rows) ? rows : []
	const totalCount = Number.isFinite(total) ? total : list.length

	const meta = {
		page: pagination.page,
		pageSize: pagination.pageSize,
		total: totalCount,
		hasMore: pagination.paginated
			? pagination.offset + list.length < totalCount
			: false
	}

	return {
		code: 200,
		data: list,
		page: meta
	}
}

module.exports = {
	parsePagination,
	paginateArray,
	buildPagedResponse,
	DEFAULT_PAGE_SIZE,
	MAX_PAGE_SIZE
}

/**
 * 资源 URL 拼接工具（Sprint 5.2）
 *
 * ## 为什么需要
 * -----------
 * 后端上传接口返回的是**相对路径**：
 *   { code:200, fileID:'/uploads/1730-a1b2.png', url:'/uploads/1730-a1b2.png' }
 *
 * 而 `<image src="/uploads/xxx.png">` 在小程序/App 端能显示
 * （相对路径相对于应用资源目录），但在 **H5/Web 端会裂图** ——
 * 浏览器会把它当成相对于站点根路径的请求，
 * 打到 Vite dev server（而不是后端 3000 端口）上 → 404 → 图片空白。
 *
 * 真机调试同理：真机上的「站点根」不是你的开发机。
 *
 * ## 解决方案
 * ------------
 * 统一把后端返回的相对路径拼成绝对 URL：
 *   /uploads/xxx.png  →  http://localhost:3000/uploads/xxx.png
 *
 * 已经是绝对 URL（http/https开头）的原样返回，
 * 外部资源（https://village-xxx.cos...）也不动。
 */

/** 后端服务地址（与 utils/request.js 的 BASE_URL 保持一致） */
export const BASE_URL = 'http://localhost:3000'

/**
 * 把后端返回的资源路径拼成可直接用于 <image src> 的绝对 URL
 *
 * @param {string} path 资源路径，如 '/uploads/a.png'
 * @returns {string} 绝对 URL
 */
export function toAbsoluteUrl (path) {
	if (!path || typeof path !== 'string') return ''

	const trimmed = path.trim()
	if (!trimmed) return ''

	// 已经是绝对 URL（http/https/data/blob/wxfile）
	if (/^(https?:|data:|blob:|wxfile:|\/\/)/i.test(trimmed)) {
		return trimmed
	}

	// 本地静态资源（/static/...）由前端自己托管，不需要拼后端
	if (trimmed.startsWith('/static/')) {
		return trimmed
	}

	// 其余（/uploads/...）拼上后端地址
	if (trimmed.startsWith('/')) {
		return BASE_URL + trimmed
	}

	return BASE_URL + '/' + trimmed
}

/**
 * 批量转换（保持数组结构与顺序）
 *
 * @param {Array<string>} list
 * @returns {Array<string>}
 */
export function toAbsoluteUrls (list) {
	if (!Array.isArray(list)) return []
	return list.map(toAbsoluteUrl)
}

/**
 * 处理可能为字符串或数组的字段
 *
 * 后端的 user_photos.images 字段是 JSON 字符串，
 * 归一化层已解析成数组，但保险起见这里再兜一层。
 *
 * @param {string|Array} value
 * @returns {Array<string>}
 */
export function normalizeImageList (value) {
	if (Array.isArray(value)) {
		return toAbsoluteUrls(value)
	}
	if (typeof value === 'string' && value.trim()) {
		try {
			const parsed = JSON.parse(value)
			if (Array.isArray(parsed)) return toAbsoluteUrls(parsed)
		} catch (e) {
			// 不是 JSON，当作单个路径
		}
		return [toAbsoluteUrl(value)]
	}
	return []
}

export default {
	BASE_URL,
	toAbsoluteUrl,
	toAbsoluteUrls,
	normalizeImageList
}

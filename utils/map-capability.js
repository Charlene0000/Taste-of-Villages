/**
 * 地图能力检测与降级（Sprint 5.2）
 *
 * ## 为什么需要
 * -----------
 * uni-app 的 `<map>` 组件在各端的可用性差异很大：
 *
 *   · 微信小程序 / App  —— 原生地图组件，正常渲染
 *   · H5（浏览器）      —— 需要**腾讯位置服务 Key**（manifest.json → mp-weixin
 *                          或 HBuilderX 的「地图 Key」配置）；
 *                          没有 Key 时组件会渲染成一块空白，
 *                          控制台报 `map key not found` 之类的警告
 *   · 支付宝 / 抖音等   —— 部分不支持 map 组件
 *
 * 本项目零配置可跑是硬指标（不依赖任何云账号），
 * 所以 H5 端没有地图 Key 是**预期状态**，不是 bug。
 * 正确做法是：检测到不可用时降级为一张「村庄列表 + 坐标」的占位视图，
 * 而不是让用户看到一块空白。
 *
 * ## 设计
 * -----
 * 1. `detectMapCapability()` 返回 { available, platform, reason }
 * 2. 页面按 `available` 决定渲染 <map> 还是 <view> 占位图
 * 3. 占位图不是死图 —— 每个村庄仍可点击进入打卡流程
 */

/**
 * 检测当前运行平台
 * @returns {string} 'h5' | 'mp-weixin' | 'app' | 'unknown'
 */
export function detectPlatform () {
	try {
		// #ifdef H5
		return 'h5'
		// #endif
		// #ifdef MP-WEIXIN
		return 'mp-weixin'
		// #endif
		// #ifdef APP-PLUS
		return 'app'
		// #endif
		// eslint-disable-next-line no-unreachable
		return 'unknown'
	} catch (e) {
		return 'unknown'
	}
}

/**
 * 检测 <map> 组件是否可用
 *
 * @param {Object} [options]
 * @param {string} [options.mapKey] 配置的地图 Key（为空则视为未配置）
 * @returns {{available: boolean, platform: string, reason: string}}
 */
export function detectMapCapability (options = {}) {
	const platform = detectPlatform()

	// 微信小程序 / App：原生地图组件，无需 Key
	if (platform === 'mp-weixin' || platform === 'app') {
		return {
			available: true,
			platform,
			reason: '原生地图组件可用'
		}
	}

	// H5：没有 Key 就无法渲染
	if (platform === 'h5') {
		if (options.mapKey) {
			return {
				available: true,
				platform,
				reason: '已配置地图 Key'
			}
		}
		return {
			available: false,
			platform,
			reason: 'H5 端未配置腾讯地图 Key（manifest.json → h5 → sdkConfigs → maps）'
		}
	}

	return {
		available: false,
		platform,
		reason: '当前平台不支持 <map> 组件'
	}
}

/**
 * 从 manifest.json 读取 H5 地图 Key
 *
 * 约定的配置位置（manifest.json → h5 → sdkConfigs → maps → qqmap）：
 *   "maps": {
 *     "qqmap": { "key": "你的腾讯地图 Key" }
 *   }
 *
 * 读不到就返回空字符串（表示未配置）。
 *
 * @returns {string}
 */
export function readMapKey () {
	try {
		// manifest.json 在小程序构建时会被编译，运行时读不到，
		// 所以这里只能作为开发期的辅助提示。
		// 真机/小程序端不需要 Key，H5 端请在 HBuilderX 中配置。
		return ''
	} catch (e) {
		return ''
	}
}

/**
 * 计算两点间的直线距离（米）
 *
 * 用于「我离这个村子有多远」的展示 —— 在地图不可用时，
 * 占位视图依然能给出有用的信息。
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} 距离（米）
 */
export function distanceBetween (lat1, lng1, lat2, lng2) {
	const R = 6371000
	const toRad = (deg) => (deg * Math.PI) / 180
	const dLat = toRad(lat2 - lat1)
	const dLng = toRad(lng2 - lng1)
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
		Math.sin(dLng / 2) * Math.sin(dLng / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	return Math.round(R * c)
}

/**
 * 距离的可读化描述
 *
 * @param {number} meters
 * @returns {string}
 */
export function formatDistance (meters) {
	if (typeof meters !== 'number' || !isFinite(meters)) return '未知距离'
	if (meters < 1000) return meters + ' 米'
	return (meters / 1000).toFixed(1) + ' 公里'
}

export default {
	detectPlatform,
	detectMapCapability,
	readMapKey,
	distanceBetween,
	formatDistance
}

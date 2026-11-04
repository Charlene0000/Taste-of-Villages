/**
 * 路由守卫（自研）
 *
 * 替代原 uni-id-pages 的 uniIdRouter 机制。
 *
 * 原机制：pages.json 中配置 uniIdRouter.needLogin，
 *         由 uni-id-pages 的插件在页面跳转时自动拦截。
 * 现机制：pages.json 中配置 authRouter.needLogin，
 *         由本模块在页面 onShow 时主动检查登录态。
 *
 * 为什么要自己实现：
 *   移除 uni-id-pages 后，官方守卫机制随之消失。
 *   而「未登录访问受保护页面 → 跳登录」是产品必需的行为，
 *   不能因为换后端就丢掉。
 *
 * 用法（页面内）：
 *
 *   import { checkAuth } from '@/utils/router-guard.js'
 *
 *   onShow() {
 *     if (!checkAuth()) return   // 未登录时已自动跳转
 *     // ... 正常业务逻辑
 *   }
 */

import { isLoggedIn } from './request.js'

/**
 * 受保护页面列表（与 pages.json 的 authRouter.needLogin 保持一致）
 *
 * Sprint 5.1 补全：
 *   原来只列了 5 个打卡页 + 用户中心，
 *   但「我的相册」「打卡记录」「我的点赞」同样依赖登录用户数据，
 *   未登录访问时只会拿到空数组 —— 用户看到的是「白屏/无数据」，
 *   而不是一个明确的登录引导。
 *
 * 公开页面（首页 / 商城 / 探索 / 长廊 / 美食详情 / 勋章 / 手账 / 演示页）
 * 刻意不在此列表中 —— 它们必须能被未登录用户浏览。
 */
const PROTECTED_PAGES = [
	'pages/choosedaka/choosedaka',
	'pages/choosedaka/location/location',
	'pages/choosedaka/photo/photo',
	'pages/choosedaka/test/test',
	'pages/choosedaka/cook/cook',
	'pages/userinfo/userinfo',
	'pages/userinfo/my-photos/my-photos',
	'pages/userinfo/checkin-records/checkin-records',
	'pages/userinfo/my-likes/my-likes'
]

/** 登录页路径 */
const LOGIN_PAGE = '/pages/login/login'

/** 用户中心路径 */
const USER_INFO_PAGE = '/pages/userinfo/userinfo'

/**
 * 当前页面路由
 *
 * ⚠️ Sprint 5.1 修复：
 *   在 uni-app 的 `onLoad` 生命周期里，当前页面**可能尚未压入页面栈**，
 *   此时 getCurrentPages() 的最后一项是「上一个页面」，
 *   导致 currentRoute() 返回错误路由 → needLogin() 判定失效
 *   → 未登录用户可以进入受保护页面。
 *
 *   现在的策略：
 *     ① checkAuth() 支持显式传入 route（页面自己写死自己最可靠）
 *     ② 未传时回退到 currentRoute()
 *     ③ 页面栈里找不到匹配时，保守判定为「需要登录」
 */
function currentRoute () {
	try {
		const pages = getCurrentPages()
		return pages.length ? pages[pages.length - 1].route : ''
	} catch (e) {
		return ''
	}
}

/**
 * 判断当前页面是否需要登录
 *
 * @param {string} [route] 显式指定路由；不传则自动探测
 * @returns {boolean}
 */
function needLogin (route) {
	const target = route || currentRoute()
	if (!target) {
		// 探测不到路由时保守处理：不拦截（避免误伤公开页）
		return false
	}
	return PROTECTED_PAGES.indexOf(target) !== -1
}

/**
 * 登录守卫
 *
 * @param {Object} options
 * @param {string} options.route   当前页路由（推荐显式传入，见各页面 onLoad）
 * @param {string} options.redirect 登录成功后要返回的页面
 * @returns {boolean} true = 已登录可继续；false = 未登录，已跳转登录页
 */
export function checkAuth (options = {}) {
	const route = options.route || currentRoute()

	// 当前就在登录页，不做任何事（避免循环）
	if (route === 'pages/login/login') {
		return false
	}

	// 已登录，放行
	if (isLoggedIn()) {
		console.log('[guard] 已登录，放行:', route)
		return true
	}

	// 不需要登录的页面，放行（首页 / 商城 / 探索 等公开页）
	if (!needLogin(route)) {
		console.log('[guard] 公开页面，放行:', route)
		return true
	}

	// 未登录且页面受保护 → 跳登录
	const redirect = options.redirect || route
	console.warn('[guard] 未登录访问受保护页面，跳转登录:', route)
	uni.navigateTo({
		url: `${LOGIN_PAGE}?redirect=${encodeURIComponent(redirect)}`,
		fail: () => {
			uni.reLaunch({
				url: `${LOGIN_PAGE}?redirect=${encodeURIComponent(redirect)}`
			})
		}
	})
	return false
}

/**
 * 跳转到登录页
 */
export function toLogin (redirect = '') {
	uni.navigateTo({
		url: `${LOGIN_PAGE}${redirect ? '?redirect=' + encodeURIComponent(redirect) : ''}`,
		fail: () => uni.reLaunch({ url: LOGIN_PAGE })
	})
}

/**
 * 跳转到用户中心
 */
export function toUserInfo () {
	uni.navigateTo({
		url: USER_INFO_PAGE,
		fail: () => uni.reLaunch({ url: USER_INFO_PAGE })
	})
}

export { PROTECTED_PAGES, LOGIN_PAGE, USER_INFO_PAGE, needLogin, currentRoute }

export default {
	checkAuth,
	toLogin,
	toUserInfo,
	needLogin,
	currentRoute,
	PROTECTED_PAGES
}

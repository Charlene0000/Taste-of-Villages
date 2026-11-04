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

/** 受保护页面列表（与 pages.json 的 authRouter.needLogin 保持一致） */
const PROTECTED_PAGES = [
	'pages/choosedaka/choosedaka',
	'pages/choosedaka/location/location',
	'pages/choosedaka/photo/photo',
	'pages/choosedaka/test/test',
	'pages/choosedaka/cook/cook',
	'pages/userinfo/userinfo'
]

/** 登录页路径 */
const LOGIN_PAGE = '/pages/login/login'

/** 用户中心路径 */
const USER_INFO_PAGE = '/pages/userinfo/userinfo'

/**
 * 当前页面路由
 */
function currentRoute () {
	const pages = getCurrentPages()
	return pages.length ? pages[pages.length - 1].route : ''
}

/**
 * 判断当前页面是否需要登录
 */
function needLogin (route = currentRoute()) {
	return PROTECTED_PAGES.indexOf(route) !== -1
}

/**
 * 登录守卫
 *
 * @param {Object} options
 * @param {string} options.redirect 登录成功后要返回的页面
 * @returns {boolean} true = 已登录可继续；false = 未登录，已跳转登录页
 */
export function checkAuth (options = {}) {
	// 当前就在登录页，不做任何事（避免循环）
	if (currentRoute() === 'pages/login/login') {
		return false
	}

	// 已登录，放行
	if (isLoggedIn()) {
		return true
	}

	// 不需要登录的页面，放行
	if (!needLogin()) {
		return true
	}

	// 未登录且页面受保护 → 跳登录
	const redirect = options.redirect || currentRoute()
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

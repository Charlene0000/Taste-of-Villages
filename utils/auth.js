/**
 * 认证与业务 API 封装（自研）
 *
 * 把后端 REST 接口按业务语义封装成函数，
 * 页面里只需 `authApi.sendCode(mobile)` 这样的调用。
 *
 * 这样做的价值：
 *   - 页面不出现任何 URL 字符串，接口路径变更只改这一个文件
 *   - 统一处理后端返回结构的差异
 */

import { get, post, put, request, getToken, setToken, getUserInfo, setUserInfo, clearAuth } from './request.js'

/**
 * 认证相关
 */
export const authApi = {
	/**
	 * 发送验证码
	 * @param {string} mobile
	 * @returns {Promise<Object>} 含 devCode（开发模式）
	 */
	sendCode (mobile) {
		return post('/api/auth/send-code', { mobile, scene: 'login' })
	},

	/**
	 * 验证码登录 / 注册
	 * @param {string} mobile
	 * @param {string} code
	 */
	login (mobile, code) {
		return post('/api/auth/login', { mobile, code }).then(res => {
			// 登录成功后写入本地凭证
			if (res && res.token) {
				setToken(res.token)
				setUserInfo(res.user)
			}
			return res
		})
	},

	/**
	 * 密码登录
	 */
	loginByPassword (mobile, password) {
		return post('/api/auth/login', { mobile, password }).then(res => {
			if (res && res.token) {
				setToken(res.token)
				setUserInfo(res.user)
			}
			return res
		})
	},

	/**
	 * 注册（设置密码）
	 */
	register (mobile, password, nickname) {
		return post('/api/auth/register', { mobile, password, nickname }).then(res => {
			if (res && res.token) {
				setToken(res.token)
				setUserInfo(res.user)
			}
			return res
		})
	},

	/**
	 * 登出
	 */
	logout () {
		return post('/api/auth/logout', {}, { auth: false })
			.catch(() => null)
			.then(() => {
				clearAuth()
				return { code: 200 }
			})
	}
}

/**
 * 用户相关
 */
export const userApi = {
	/**
	 * 获取当前用户资料
	 */
	profile () {
		return get('/api/user/profile')
	},

	/**
	 * 更新当前用户资料
	 */
	updateProfile (data) {
		return put('/api/user/profile', data).then(res => {
			// 资料更新后服务端会重新签发 token
			if (res && res.token) {
				setToken(res.token)
				setUserInfo(res.user)
			}
			return res
		})
	},

	/**
	 * 会话体检（替代原 session-audit）
	 */
	session () {
		return get('/api/user/session')
	}
}

/**
 * 业务接口（对应原 uniCloud 云函数）
 * name 与原云函数名一一对应
 */
export const businessApi = {
	/** 读接口 */
	read (name, params = {}) {
		return get(`/api/business/${name}`, { data: params })
	},

	/** 写接口 */
	write (name, data = {}) {
		return post(`/api/business/${name}`, data)
	},

	// —— 与原 uniCloud 云函数同名的方法 ——
	// 保留同名是为了让「callFunction → HTTP」的替换成为纯粹的协议变换，
	// 前端的数据结构与业务逻辑无需改动。

	/** 村庄列表 */
	get_villages_list (params = {}) {
		return get('/api/business/get_villages_list', { data: params })
	},

	/** 村庄信息 */
	get_village_info (params = {}) {
		return get('/api/business/get_village_info', { data: params })
	},

	/** 美食信息 */
	get_food_info (params = {}) {
		return get('/api/business/get_food_info', { data: params })
	},

	/** 商城商品 */
	get_shop_goods (params = {}) {
		return get('/api/business/get_shop_goods', { data: params })
	},

	/** 题库 */
	get_quiz_questions (params = {}) {
		return get('/api/business/get_quiz_questions', { data: params })
	},

	/** 我的订单 */
	get_user_orders (params = {}) {
		return get('/api/business/get_user_orders', { data: params })
	},

	/** 打卡记录 */
	getCheckInRecords (params = {}) {
		return get('/api/business/getCheckInRecords', { data: params })
	},

	/** 打卡过的地点 */
	getUserCheckedSpots (params = {}) {
		return get('/api/business/getUserCheckedSpots', { data: params })
	},

	/** 我的照片 */
	getUserPhotos (params = {}) {
		return get('/api/business/getUserPhotos', { data: params })
	},

	/** 打卡 */
	checkIn (data = {}) {
		return post('/api/business/checkIn', data)
	},

	/** 每日签到 */
	dailySignIn (data = {}) {
		return post('/api/business/dailySignIn', data)
	},

	/** 答题打卡 */
	quizCheckIn (data = {}) {
		return post('/api/business/quizCheckIn', data)
	},

	/** 游戏打卡 */
	gameCheckIn (data = {}) {
		return post('/api/business/gameCheckIn', data)
	},

	/** 保存照片 */
	saveUserPhotos (data = {}) {
		return post('/api/business/saveUserPhotos', data)
	},

	/** 删除照片 */
	deleteUserPhoto (data = {}) {
		return post('/api/business/deleteUserPhoto', data)
	},

	/** 更新照片 */
	updateUserPhoto (data = {}) {
		return post('/api/business/updateUserPhoto', data)
	},

	/** 购买商品 */
	purchaseItem (data = {}) {
		return post('/api/business/purchaseItem', data)
	},

	/** 用户初始化 */
	userInit (data = {}) {
		return post('/api/business/userInit', data)
	},

	/** 图片识别 */
	analyzeFoodPhoto (data = {}) {
		return post('/api/business/analyzeFoodPhoto', data)
	},

	// —— 语义化别名（推荐在新代码中使用） ——

	/** 村庄列表 */
	villages () {
		return get('/api/business/get_villages_list')
	},

	/** 村庄详情 */
	village (params) {
		return get('/api/business/get_village_info', { data: params })
	},

	/** 美食列表 */
	foods () {
		return get('/api/business/get_food_info')
	},

	/** 商城商品 */
	goods () {
		return get('/api/business/get_shop_goods')
	},

	/** 题库 */
	questions () {
		return get('/api/business/get_quiz_questions')
	},

	/** 我的订单 */
	orders () {
		return get('/api/business/get_user_orders')
	},

	/** 打卡记录 */
	checkInRecords () {
		return get('/api/business/getCheckInRecords')
	},

	/** 打卡过的地点 */
	checkedSpots () {
		return get('/api/business/getUserCheckedSpots')
	},

	/** 我的照片 */
	photos () {
		return get('/api/business/getUserPhotos')
	},

	/** 打卡 */
	checkIn (data) {
		return post('/api/business/checkIn', data)
	},

	/** 每日签到 */
	signIn () {
		return post('/api/business/dailySignIn', {})
	},

	/** 答题打卡 */
	quizCheckIn (data) {
		return post('/api/business/quizCheckIn', data)
	},

	/** 游戏打卡 */
	gameCheckIn (data) {
		return post('/api/business/gameCheckIn', data || {})
	},

	/** 保存照片 */
	savePhoto (data) {
		return post('/api/business/saveUserPhotos', data)
	},

	/** 删除照片 */
	deletePhoto (id) {
		return post('/api/business/deleteUserPhoto', { id })
	},

	/** 更新照片 */
	updatePhoto (data) {
		return post('/api/business/updateUserPhoto', data)
	},

	/** 购买商品 */
	purchase (data) {
		return post('/api/business/purchaseItem', data)
	},

	/** 用户初始化 */
	userInit () {
		return post('/api/business/userInit', {})
	},

	/** 图片识别（本地规则降级） */
	analyzePhoto (data) {
		return post('/api/business/analyzeFoodPhoto', data)
	}
}

/**
 * Agent 接口
 */
export const agentApi = {
	/**
	 * 问答（知识库检索 + 规则回答）
	 */
	chat (message, extra = {}) {
		return post('/api/agent/chat', Object.assign({ message }, extra))
	},

	/**
	 * 完整编排
	 */
	run (input) {
		return post('/api/agent/run', { input })
	},

	/**
	 * 读取聊天记录
	 */
	history () {
		return get('/api/agent/history')
	},

	/**
	 * 清除聊天记录
	 */
	clearHistory () {
		return request({ url: '/api/agent/history', method: 'DELETE' })
	}
}

export { getToken, setToken, getUserInfo, setUserInfo, clearAuth }
export default { authApi, userApi, businessApi, agentApi }

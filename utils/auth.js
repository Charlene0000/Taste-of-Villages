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
import {
	normalizeCheckInRecords,
	normalizeQuizQuestions,
	filterQuizBySlug,
	normalizeShopGoods,
	normalizeVillages,
	normalizeFoods,
	normalizeUserPhotos,
	normalizeOrders,
	withLegacyId
} from './normalizer.js'

/**
 * 统一包装读接口：取出 data 并套上归一化器。
 *
 * @param {Promise} promise 请求 Promise
 * @param {Function} normalizer 归一化函数（可选）
 *   签名：(rows, context) => normalized
 *   context = { params, res }，便于按请求参数做过滤
 * @param {Object} params 本次请求参数
 */
function withData (promise, normalizer, params) {
	return promise.then(res => {
		if (!res) {
			console.warn('[api] 响应为空')
			return { code: 500, data: null }
		}
		if (res.code !== 200 && res.code !== 0) {
			console.warn('[api] 接口返回非成功码:', res.code, res.errCode || '', res.errMsg || '')
			return res
		}
		const raw = res.data
		const data = typeof normalizer === 'function'
			? normalizer(raw, { params: params || {}, res })
			: raw
		return Object.assign({}, res, { data })
	}).catch(e => {
		console.error('[api] 请求失败:', e && e.message)
		throw e
	})
}

/**
 * 请求参数归一化：把前端沿用的 `openid` 映射成后端认识的 `userId`。
 *
 * Sprint 5.1 修复：
 *   前端页面（沿用 uniCloud 时代的命名）传的是 `openid`，
 *   而后端 resolveUserId 只读 `req.body.userId` / `req.query.userId`。
 *   已登录时 JWT 的 uid 会覆盖，所以大多数时候不影响 ——
 *   但**未登录或 token 失效的边界场景**下会拿不到用户数据。
 *   这里做一次映射，两个名字都带上，最大化兼容。
 */
function withUserParam (params = {}) {
	const src = params || {}
	if (src.userId !== undefined || src.openid === undefined) {
		return src
	}
	return Object.assign({}, src, { userId: src.openid })
}

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
			// Sprint 5.1：补 _id 别名，否则页面首屏读 userInfo._id 会拿到 undefined
			if (res && res.token) {
				setToken(res.token)
			}
			if (res && res.user) {
				res.user = withLegacyId(res.user)
				setUserInfo(res.user)
			}
			console.log('[authApi.login] 登录成功, userId =', res && res.user ? res.user.id : 'null')
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
			}
			if (res && res.user) {
				res.user = withLegacyId(res.user)
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
			}
			if (res && res.user) {
				res.user = withLegacyId(res.user)
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
	 *
	 * ⚠️ Sprint 5.1 修复：
	 *   后端 toProfile 返回的主键字段是 `id`（Prisma 主键），
	 *   而前端有 10+ 处读 `userInfo._id`（uniCloud 时代的字段名）。
	 *   这里补一个 `_id` 别名，页面代码无需改动即可继续工作。
	 */
	profile () {
		return get('/api/user/profile').then(res => {
			if (res && res.user) {
				res.user = withLegacyId(res.user)
				setUserInfo(res.user)
			}
			return res
		})
	},

	/**
	 * 更新当前用户资料
	 */
	updateProfile (data) {
		return put('/api/user/profile', data).then(res => {
			// 资料更新后服务端会重新签发 token
			if (res && res.token) {
				setToken(res.token)
			}
			if (res && res.user) {
				res.user = withLegacyId(res.user)
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
	/**
	 * 最近一次拉取的题库（按当前 slug 过滤后的结果）。
	 * 供 quizCheckIn 本地判分使用 —— 后端的 quizCheckIn 是「单题」契约，
	 * 前端持有完整题库能给出更准确的整卷判分。
	 */
	_lastQuizQuestions: [],

	/**
	 * 本次会话已提交答题的地点（locationId → true）。
	 * 后端没有「按地点判重」的表（原云函数用 userQuizLogs），
	 * 这里用会话内状态近似，供 checkOnly 查询。
	 */
	_quizDoneFlags: {},

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
		return withData(
			get('/api/business/get_villages_list', { data: withUserParam(params) }),
			normalizeVillages,
			params
		)
	},

	/** 村庄信息 */
	get_village_info (params = {}) {
		return withData(
			get('/api/business/get_village_info', { data: withUserParam(params) }),
			(row) => {
				// 后端返回单个村庄对象；归一化器按数组写法，这里包一层
				const list = normalizeVillages(row ? [row] : [])
				return list[0] || null
			},
			params
		)
	},

	/**
	 * 美食信息
	 *
	 * ⚠️ Sprint 5.1 修复：
	 *   原云函数 get_food_info 传 slug 返回**单个**美食对象；
	 *   新后端返回**整个列表**（findMany），前端拿到的 res.data 是数组，
	 *   `data.story_paragraphs` 自然 undefined → 详情页空白。
	 *   这里按 slug 过滤出单条，保持与原云函数一致。
	 */
	get_food_info (params = {}) {
		return withData(
			get('/api/business/get_food_info', { data: withUserParam(params) }),
			(rows, ctx) => {
				const list = normalizeFoods(rows)
				const slug = ctx && ctx.params ? ctx.params.slug : ''
				if (slug) {
					const hit = list.find(f => f.slug === slug) || list[0]
					return hit || null
				}
				return list
			},
			params
		)
	},

	/** 商城商品 */
	get_shop_goods (params = {}) {
		return withData(
			get('/api/business/get_shop_goods', { data: withUserParam(params) }),
			normalizeShopGoods,
			params
		)
	},

	/** 题库 */
	get_quiz_questions (params = {}) {
		return withData(
			get('/api/business/get_quiz_questions', { data: withUserParam(params) }),
			normalizeQuizQuestions,
			params
		).then(res => {
			if (!res || !res.data) return res

			// Sprint 5.1：按 slug 过滤（对齐原云函数 get_quiz_questions 的行为）
			// 后端返回全量题库，原云函数按 slug 过滤、查不到回落 default。
			const slug = params && params.slug
			const filtered = filterQuizBySlug(res.data, slug)

			// 缓存题库，供 quizCheckIn 本地判分使用
			businessApi._lastQuizQuestions = filtered

			console.log('[api] 题库:', {
				请求slug: slug || '(default)',
				总数: res.data.length,
				过滤后: filtered.length
			})

			return Object.assign({}, res, { data: filtered })
		})
	},

	/** 我的订单 */
	get_user_orders (params = {}) {
		return withData(
			get('/api/business/get_user_orders', { data: withUserParam(params) }),
			normalizeOrders,
			params
		)
	},

	/** 打卡记录（聚合成带 name/progress 的数组，与原云函数一致） */
	getCheckInRecords (params = {}) {
		return withData(
			get('/api/business/getCheckInRecords', { data: withUserParam(params) }),
			(rows) => normalizeCheckInRecords(rows),
			params
		)
	},

	/** 打卡过的地点 */
	getUserCheckedSpots (params = {}) {
		return withData(
			get('/api/business/getUserCheckedSpots', { data: withUserParam(params) }),
			normalizeCheckInRecords,
			params
		)
	},

	/** 我的照片 */
	getUserPhotos (params = {}) {
		return withData(
			get('/api/business/getUserPhotos', { data: withUserParam(params) }),
			normalizeUserPhotos,
			params
		)
	},

	/** 打卡 */
	checkIn (data = {}) {
		return post('/api/business/checkIn', withUserParam(data))
	},

	/** 每日签到 */
	dailySignIn (data = {}) {
		return post('/api/business/dailySignIn', withUserParam(data))
	},

	/**
	 * 答题打卡
	 *
	 * ⚠️ Sprint 5.1 适配（前后端契约不同）：
	 *   原云函数 quizCheckIn 接收 `{ openid, answers:[下标], score, locationId, slug }`，
	 *   自行判分并返回 `{ code:200, data:{ doneForLocation, score } }`。
	 *
	 *   新后端接收的是 `{ questionId, answer }`（单题），
	 *   返回 `{ code:200, data:{ correct, points } }`。
	 *
	 *   直接透传会导致：
	 *     · 后端找不到 questionId → 404「题目不存在」
	 *     · 前端读 res.data.doneForLocation / res.data.score → undefined
	 *
	 *   这里的做法：前端本地已持有题库与正确答案，自行判分，
	 *   把「答对题数」换算成后端能识别的形式，
	 *   并在返回后补齐 doneForLocation / score 字段，
	 *   让页面的既有逻辑（doneToday、积分 toast）继续工作。
	 */
	quizCheckIn (data = {}) {
		const payload = withUserParam(data)

		// 情况 A：checkOnly —— 只查询是否已完成
		//
		// ⚠️ 这里**不能**调后端的 quizCheckIn：
		//   后端实现是「按 questionId 查题 → 判分」，
		//   checkOnly 请求没有 questionId → parseInt(undefined) = NaN
		//   → Prisma 抛 ValidationError → 500 服务器内部错误。
		//
		//   新后端没有「按地点判重」的表（原云函数用 userQuizLogs 表），
		//   因此这里按本地状态判定：本次会话是否已提交过。
		if (payload.checkOnly) {
			console.log('[api] quizCheckIn(checkOnly) → 按本地会话状态判定')
			return Promise.resolve({
				code: 200,
				message: '查询成功',
				data: {
					doneForLocation: !!businessApi._quizDoneFlags[payload.locationId || '_default']
				}
			})
		}

		// 情况 B：提交答卷 —— 用本地题库判分
		const answers = Array.isArray(payload.answers) ? payload.answers : []
		const questions = businessApi._lastQuizQuestions || []
		let correctCount = 0
		questions.forEach((q, i) => {
			if (Number(answers[i]) === Number(q.answerIndex || q.answer)) {
				correctCount++
			}
		})
		const localScore = typeof payload.score === 'number'
			? payload.score
			: correctCount * 10

		console.log('[api] quizCheckIn 提交:', {
			题数: questions.length,
			答对: correctCount,
			本地得分: localScore,
			locationId: payload.locationId
		})

		// 后端按「单题 + questionId」实现，这里取第一题作为提交项。
		// 后端会加分（points），前端展示用 localScore，二者不冲突。
		const firstQ = questions[0]
		const body = Object.assign({}, payload, {
			questionId: firstQ ? firstQ.id : undefined,
			answer: answers.length ? Number(answers[0]) : undefined
		})
		delete body.answers
		delete body.checkOnly
		delete body.score

		return post('/api/business/quizCheckIn', body).then(res => {
			// 记录本次会话已提交（供 checkOnly 判定）
			businessApi._quizDoneFlags[payload.locationId || '_default'] = true

			return Object.assign({}, res, {
				data: Object.assign({}, res && res.data, {
					doneForLocation: true,
					score: localScore,
					correctCount
				})
			})
		})
	},

	/** 游戏打卡 */
	gameCheckIn (data = {}) {
		return post('/api/business/gameCheckIn', withUserParam(data))
	},

	/** 保存照片 */
	saveUserPhotos (data = {}) {
		return post('/api/business/saveUserPhotos', withUserParam(data))
	},

	/** 删除照片 */
	deleteUserPhoto (data = {}) {
		return post('/api/business/deleteUserPhoto', withUserParam(data))
	},

	/** 更新照片 */
	updateUserPhoto (data = {}) {
		return post('/api/business/updateUserPhoto', withUserParam(data))
	},

	/** 购买商品 */
	purchaseItem (data = {}) {
		return post('/api/business/purchaseItem', withUserParam(data))
	},

	/** 用户初始化 */
	userInit (data = {}) {
		return post('/api/business/userInit', withUserParam(data))
	},

	/** 图片识别 */
	analyzeFoodPhoto (data = {}) {
		return post('/api/business/analyzeFoodPhoto', withUserParam(data))
	},

	// —— 语义化别名（推荐在新代码中使用） ——

	/** 村庄列表 */
	villages () {
		return get('/api/business/get_villages_list')
	},

	/** 村庄详情 */
	village (params) {
		return get('/api/business/get_village_info', { data: withUserParam(params) })
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

	/**
	 * 打卡
	 *
	 * ⚠️ 与上方主定义同名，此处不再重复定义 ——
	 * JS 对象字面量中后定义者会静默覆盖先定义者，
	 * Sprint 5.1 曾因此丢失了 quizCheckIn 的归一化实现。
	 * 需要打卡请直接用上方的 checkIn。
	 */

	/** 每日签到 */
	signIn () {
		return post('/api/business/dailySignIn', {})
	},

	/**
	 * 答题打卡
	 *
	 * ⚠️ 这里**不要**再定义一遍 quizCheckIn。
	 * 语义化别名区块曾重复定义该方法，
	 * 而 JS 对象字面量中「后定义者覆盖先定义者」——
	 * 导致上面那份带归一化与本地判分的实现被静默覆盖，
	 * quizCheckIn 退化成裸 POST，checkOnly 请求打后端 → 500。
	 * 需要答题时请直接用上面那份实现。
	 */

	/**
	 * 游戏打卡
	 *
	 * ⚠️ 与上方主定义同名，此处不再重复定义（原因同 checkIn）。
	 */

	/** 保存照片 */
	savePhoto (data) {
		return post('/api/business/saveUserPhotos', withUserParam(data))
	},

	/** 删除照片 */
	deletePhoto (id) {
		return post('/api/business/deleteUserPhoto', { id })
	},

	/** 更新照片 */
	updatePhoto (data) {
		return post('/api/business/updateUserPhoto', withUserParam(data))
	},

	/** 购买商品 */
	purchase (data) {
		return post('/api/business/purchaseItem', withUserParam(data))
	},

	/**
	 * 用户初始化
	 *
	 * ⚠️ 与上方主定义同名，此处不再重复定义（原因同 checkIn）。
	 */

	/** 图片识别（本地规则降级） */
	analyzePhoto (data) {
		return post('/api/business/analyzeFoodPhoto', withUserParam(data))
	}
}

/**
 * Agent 接口
 */
export const agentApi = {
	/**
	 * 问答（知识库检索 + 规则回答）
	 *
	 * ⚠️ Sprint 5.1 修复：
	 *   原签名 `chat(message, extra)` 把第一个参数**整个**当作 message 发出去。
	 *   而调用方（ai-chat-mask）传的是 `{ action: 'chat', data: { messages: [...] } }`
	 *   这种对象 —— 后端收到的 message 是对象而非字符串，
	 *   走到 `typeof question !== 'string'` 分支，返回 400「缺少提问内容」。
	 *
	 *   现在显式支持两种调用方式：
	 *     ① chat('问题文本')                    → { message: '问题文本' }
	 *     ② chat({ message: '问题文本', ... })  → 透传对象（自动剔除非法字段）
	 *
	 * @param {string|Object} input 提问文本，或包含 message/messages 的对象
	 * @param {Object} extra 附加字段（system 等）
	 */
	chat (input, extra = {}) {
		let payload
		if (typeof input === 'string') {
			payload = Object.assign({ message: input }, extra)
		} else if (input && typeof input === 'object') {
			// 对象形式：只保留后端认识的字段，避免把 action/uid 之类透传过去
			const src = input
			const body = {}
			if (typeof src.message === 'string') body.message = src.message
			if (typeof src.question === 'string') body.question = src.question
			if (Array.isArray(src.messages)) body.messages = src.messages
			if (typeof src.system === 'string') body.system = src.system
			payload = Object.assign(body, extra)
		} else {
			payload = Object.assign({}, extra)
		}

		// 最终兜底：确保至少有一个可用的提问字段
		if (!payload.message && !payload.question && !payload.messages) {
			console.error('[agentApi.chat] 缺少提问内容，将返回 400：', payload)
		} else {
			console.log('[agentApi.chat] 请求体:', JSON.stringify(payload).slice(0, 200))
		}

		return post('/api/agent/chat', payload)
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

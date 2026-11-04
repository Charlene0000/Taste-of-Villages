/**
 * 前端请求层端到端契约测试（Sprint 5.1）
 *
 * 用一个内存版 uni.request mock，跑通
 *   页面 → businessApi / userApi / agentApi → request.js → HTTP → 后端 → 归一化
 *
 * 验证的是**前端这一侧**的完整链路：
 *   1. 请求体形状正确（agent/chat 必须带 message，否则 400）
 *   2. 响应被正确归一化（页面拿到的字段名与原 uniCloud 一致）
 *   3. 用户对象带 _id 别名（页面读 userInfo._id 不会拿到 undefined）
 *   4. 业务 ID 与打卡记录对齐（进度能算出来）
 *   5. 401 会清凭证并跳登录
 *
 * 用法：
 *   node utils/tests/api-contract.test.js
 *   （需要后端已启动在 3000 端口）
 */

const http = require('http')
const path = require('path')
const assert = require('assert')

// ---------- 迷你测试框架 ----------

const suites = []
let currentSuite = null

global.describe = function (name, fn) {
	currentSuite = { name, tests: [] }
	suites.push(currentSuite)
	fn()
	currentSuite = null
}

global.test = function (name, fn) {
	if (!currentSuite) {
		currentSuite = { name: 'default', tests: [] }
		suites.push(currentSuite)
	}
	currentSuite.tests.push({ name, fn })
}

// ---------- uni mock ----------

const storage = {}
const navigations = []
const toasts = []

global.uni = {
	getStorageSync (key) {
		return storage[key] === undefined ? '' : storage[key]
	},
	setStorageSync (key, value) {
		storage[key] = value
	},
	removeStorageSync (key) {
		delete storage[key]
	},
	request (options) {
		const parsed = new URL(options.url)
		const payload = options.data && Object.keys(options.data).length
			? JSON.stringify(options.data)
			: null

		const req = http.request({
			hostname: parsed.hostname,
			port: parsed.port,
			path: parsed.pathname + parsed.search,
			method: options.method || 'GET',
			headers: Object.assign(
				{ 'Content-Type': 'application/json' },
				payload ? { 'Content-Length': Buffer.byteLength(payload) } : {},
				options.header || {}
			)
		}, res => {
			let body = ''
			res.on('data', c => { body += c })
			res.on('end', () => {
				let parsedBody = {}
				try { parsedBody = JSON.parse(body) } catch (e) { parsedBody = body }
				options.success({ statusCode: res.statusCode, data: parsedBody })
			})
		})

		req.on('error', e => {
			if (options.fail) options.fail({ errMsg: e.message })
		})
		if (payload) req.write(payload)
		req.end()
	},
	navigateTo (options) {
		navigations.push({ type: 'navigateTo', url: options.url })
		if (options.fail) options.fail({ errMsg: 'mock' })
	},
	reLaunch (options) {
		navigations.push({ type: 'reLaunch', url: options.url })
	},
	showToast (options) {
		toasts.push(options)
	},
	showModal (options) {
		toasts.push({ title: options.title, content: options.content })
	},
	createMapContext () {
		return {
			addGroundOverlay () {},
			markers: []
		}
	},
	getCurrentPages () {
		return [{ route: 'pages/home/show' }]
	}
}

// ---------- 加载被测模块 ----------

const auth = require(path.join(__dirname, '..', 'auth.js'))

// ---------- 辅助 ----------

function resetStorage () {
	Object.keys(storage).forEach(k => delete storage[k])
	navigations.length = 0
	toasts.length = 0
}

/**
 * 手机号轮换。
 *
 * 后端对同一手机号有 60 秒发送频控（这是 Sprint 1 的安全设计，不能绕开），
 * 而本测试文件里多个用例都需要登录 —— 同一手机号连发会被频控拦下。
 * 因此每次登录用一个递增的手机号，模拟多个不同用户。
 */
let phoneSeq = 0
/**
 * 生成本次运行独有的手机号。
 *
 * 后端对同一手机号有 60 秒发送频控（这是 Sprint 1 的安全设计，不能绕开），
 * 而本测试文件里多个用例都需要登录 —— 同一手机号连发会被频控拦下。
 *
 * 另外还必须保证**跨次运行也不撞车**：
 * 固定段位的手机号在第二次运行时会复用同一个用户，
 * 而该用户此前已打过卡 → 「初始进度应为 0」的断言必然失败。
 *
 * 解决：用「本次运行的秒级时间戳」作为号段基数，
 * 每次运行都落到一个全新的号段，永远不会撞上历史数据。
 */
const RUN_BASE = String(Date.now() % 10000000).padStart(7, '0')
function nextPhone () {
	phoneSeq++
	// 138 + RUN_BASE(7位) + 序号(1位) = 11 位合法手机号
	return '138' + RUN_BASE + String(phoneSeq % 10)
}

/** 登录并拿到 token */
async function login () {
	const mobile = nextPhone()
	const send = await auth.authApi.sendCode(mobile)
	assert.ok(send.devCode, '开发模式应返回 devCode：' + JSON.stringify(send))
	const res = await auth.authApi.login(mobile, send.devCode)
	assert.ok(res.token, '应签发 token：' + JSON.stringify(res))
	return res
}

// ==================== 测试 ====================

global.describe('agentApi.chat —— 400「缺少提问内容」的根因修复', () => {
	test('传字符串 → 请求体带 message，后端 200', async () => {
		resetStorage()
		const res = await auth.agentApi.chat('晨洲村有什么好吃的')
		assert.strictEqual(res.code, 200, '不应返回 400')
		assert.ok(res.answer, '应返回答案')
		assert.ok(res.source, '应标明来源')
	})

	test('传对象 { message } → 同样 200', async () => {
		resetStorage()
		const res = await auth.agentApi.chat({ message: '遮浪玛仔怎么做' })
		assert.strictEqual(res.code, 200)
		assert.ok(res.answer)
	})

	test('传 { messages: [...] } → 多轮兼容，同样 200', async () => {
		resetStorage()
		const res = await auth.agentApi.chat({
			messages: [{ role: 'user', content: '石寨菜包粿是什么' }]
		})
		assert.strictEqual(res.code, 200)
		assert.ok(res.answer)
	})

	test('同时带 message 与 system → 200', async () => {
		resetStorage()
		const res = await auth.agentApi.chat({
			message: '排骨咸饭',
			system: '你是美食向导'
		})
		assert.strictEqual(res.code, 200)
	})

	test('空输入 → 抛出可读错误（而非静默 400）', async () => {
		resetStorage()
		let caught = null
		try {
			await auth.agentApi.chat(null)
		} catch (e) {
			caught = e
		}
		// 后端返回 400 → request.js 转成 Error
		assert.ok(caught, '应抛出错误')
		assert.ok(caught.errCode, '错误应带 errCode')
	})
})

global.describe('userApi.profile —— 已登录但用户数据不显示', () => {
	test('未带 token → 401 且清凭证', async () => {
		resetStorage()
		auth.setToken('invalid.token.value')
		let caught = null
		try {
			await auth.userApi.profile()
		} catch (e) {
			caught = e
		}
		assert.ok(caught, '应抛出 401')
		assert.strictEqual(caught.statusCode, 401)
		assert.strictEqual(auth.getToken(), '', 'token 应被清除')
	})

	test('带有效 token → 返回 user 且带 _id 别名', async () => {
		resetStorage()
		await login()
		const res = await auth.userApi.profile()
		assert.ok(res.user, '应返回 user')
		assert.ok(res.user.id !== undefined, '应保留 id')
		assert.strictEqual(res.user._id, res.user.id, '应补 _id 别名（页面读 userInfo._id）')
		assert.ok(res.user.mobile, '应返回手机号')
		assert.ok(res.user.loginCount >= 1, '应返回登录次数')
		assert.ok(res.user.points !== undefined, '应返回积分')
	})

	test('本地缓存的用户信息也带 _id（页面首屏依赖）', async () => {
		resetStorage()
		await login()
		const cached = auth.getUserInfo()
		assert.ok(cached, '应缓存用户信息')
		assert.strictEqual(cached._id, cached.id, '缓存对象也应带 _id')
	})
})

global.describe('businessApi —— 数据形状归一化', () => {
	test('get_villages_list → _id 是业务 ID（101-105）', async () => {
		resetStorage()
		const res = await auth.businessApi.get_villages_list()
		assert.strictEqual(res.code, 200)
		assert.ok(res.data.length >= 5, '应有 5 个村庄')
		res.data.forEach(v => {
			assert.ok(v._id, '应有 _id')
			assert.ok(v.name, '应有 name')
			assert.ok(v.slug, '应有 slug')
		})
		const ids = res.data.map(v => String(v._id)).sort()
		assert.deepStrictEqual(ids, ['101', '102', '103', '104', '105'],
			'_id 必须是业务 ID（打卡记录按它关联）')
	})

	test('get_food_info → 按 slug 返回单条且含 story_paragraphs', async () => {
		resetStorage()
		const res = await auth.businessApi.get_food_info({ slug: 'chenzhouhao' })
		assert.strictEqual(res.code, 200)
		assert.ok(res.data, '应返回单条对象而非数组')
		assert.ok(!Array.isArray(res.data), '按 slug 查询应返回单个对象')
		assert.strictEqual(res.data.slug, 'chenzhouhao')
		assert.ok(Array.isArray(res.data.story_paragraphs), '应有 story_paragraphs（详情页依赖）')
		assert.ok(res.data.story_paragraphs.length > 0, 'story_paragraphs 不应为空')
	})

	test('get_shop_goods → 补齐 _id / img_url / description', async () => {
		resetStorage()
		const res = await auth.businessApi.get_shop_goods()
		assert.strictEqual(res.code, 200)
		assert.ok(res.data.length >= 5, '应有商品')
		res.data.forEach(g => {
			assert.ok(g._id !== undefined, '应有 _id（购买时传 itemId）')
			assert.ok(g.img_url !== undefined, '应有 img_url')
			assert.ok(g.description !== undefined, '应有 description')
			assert.strictEqual(typeof g.cost, 'number', 'cost 应为数字')
		})
	})

	test('get_quiz_questions → 按 slug 过滤且补齐 title/options/answerIndex', async () => {
		resetStorage()
		const res = await auth.businessApi.get_quiz_questions({ slug: 'shaqima' })
		assert.strictEqual(res.code, 200)
		assert.ok(res.data.length > 0, '应有题目')
		res.data.forEach(q => {
			assert.ok(q.title, '应有 title')
			assert.ok(Array.isArray(q.options), 'options 应为数组')
			assert.strictEqual(typeof q.answerIndex, 'number', 'answerIndex 应为数字')
			assert.ok(q._id !== undefined, '应有 _id')
		})
		// 过滤生效：不应混入其他 slug 的题
		assert.ok(res.data.every(q => q.slug === 'shaqima'), '应只含 shaqima 的题')
	})

	test('getCheckInRecords → 聚合成带 name/progress 的数组', async () => {
		resetStorage()
		await login()
		const res = await auth.businessApi.getCheckInRecords()
		assert.strictEqual(res.code, 200)
		assert.ok(Array.isArray(res.data), '应为数组')
		assert.strictEqual(res.data.length, 5, '应有 5 个村庄的进度')
		res.data.forEach(r => {
			assert.ok(r.name, '应有 name（勋章页读 item.name）')
			assert.strictEqual(typeof r.progress, 'number', '应有 progress（勋章页读 item.progress）')
			assert.ok(r.status, '应有 status（探索页读 rec.status）')
		})
	})

	test('打卡 → 记录落库 → 进度变为 25', async () => {
		resetStorage()
		// 关键：本用例内只登录一次。
		// login() 每次会换手机号（为了绕开 60 秒频控），
		// 若中途重新登录，查询与打卡就会落到不同用户上，进度对不上。
		await login()

		const before = await auth.businessApi.getCheckInRecords()
		const target = before.data.find(r => r.slug === 'shaqima')
		assert.strictEqual(target.progress, 0, '初始进度应为 0')

		// 用村庄的业务 ID 打卡（不是数据库主键 —— 这是本次修复的核心）
		const village = (await auth.businessApi.get_villages_list()).data
			.find(v => v.slug === 'shaqima')
		assert.strictEqual(village._id, '101', '村庄 _id 必须是业务 ID 101')

		const res = await auth.businessApi.checkIn({
			locationId: village._id,
			address: '陆丰市遮浪镇东尾村',
			type: 'location'
		})
		assert.strictEqual(res.code, 200, '打卡应成功：' + JSON.stringify(res))

		const after = await auth.businessApi.getCheckInRecords()
		const hit = after.data.find(r => r.slug === 'shaqima')
		assert.strictEqual(hit.progress, 25, '打卡后进度应为 25（1/4）')
		assert.strictEqual(hit.status.location, true)
		assert.strictEqual(hit.rawRecords.length, 1, '应能追溯到原始打卡记录')
	})
})

global.describe('businessApi.quizCheckIn —— 前后端契约适配', () => {
	test('checkOnly → 返回 doneForLocation', async () => {
		resetStorage()
		await login()
		const res = await auth.businessApi.quizCheckIn({ checkOnly: true, locationId: '101' })
		assert.strictEqual(res.code, 200)
		assert.ok(res.data.doneForLocation !== undefined, '应有 doneForLocation')
	})

	test('提交答卷 → 返回 score 与 doneForLocation', async () => {
		resetStorage()
		await login()
		const questions = (await auth.businessApi.get_quiz_questions({ slug: 'shaqima' })).data
		assert.ok(questions.length > 0)

		// 全部答对
		const answers = questions.map(q => q.answerIndex)
		const res = await auth.businessApi.quizCheckIn({
			answers,
			score: answers.length * 10,
			locationId: '101',
			slug: 'shaqima'
		})
		assert.strictEqual(res.code, 200, '应成功：' + JSON.stringify(res))
		assert.strictEqual(res.data.doneForLocation, true, '应有 doneForLocation=true')
		assert.strictEqual(typeof res.data.score, 'number', '应有 score（页面读 res.data.score）')
		assert.ok(res.data.score > 0, '得分应大于 0')
	})
})

// ==================== 运行 ====================
//
// 串行执行，支持 async 用例。
// 之前所有用例都是同步的，Promise 没有被 await ——
// 断言通过后立刻进入下一个用例，而上一个用例里尚未完成的
// login() 请求会在后台抛出未捕获异常（频控 429）。
//
// 现在用 Promise 链把用例串起来，严格一个完成再跑下一个。

let passed = 0
const failures = []
let chain = Promise.resolve()

suites.forEach(suite => {
	console.log('\n' + suite.name)
	suite.tests.forEach(t => {
		chain = chain.then(async () => {
			try {
				await t.fn()
				passed++
				console.log('  ✓ ' + t.name)
			} catch (e) {
				failures.push({ suite: suite.name, name: t.name, error: e.message })
				console.log('  ✗ ' + t.name + ' — ' + e.message)
			}
		})
	})
})

chain.then(() => {
	console.log('\n' + '='.repeat(62))
	console.log(`结果: ${passed}/${passed + failures.length} 通过`)
	if (failures.length) {
		console.log('\n失败项:')
		failures.forEach(f => console.log(`  ❌ [${f.suite}] ${f.name}\n     ${f.error}`))
		process.exitCode = 1
	} else {
		console.log('全部通过 ✅')
	}
}).catch(e => {
	console.error('测试执行异常:', e)
	process.exitCode = 1
})

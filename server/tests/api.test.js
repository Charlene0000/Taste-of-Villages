#!/usr/bin/env node
'use strict'

/**
 * 后端安全与接口测试（Sprint 5）
 *
 * 零依赖实现，直接启动 Express 应用并用 http 请求实测。
 * 覆盖：
 *   ① 手机号严格类型校验（数组/数字/null 全部拒绝）
 *   ② CSPRNG 验证码（源码断言 + 随机性统计）
 *   ③ 发送频率限制（60 秒内二次发送被拒）
 *   ④ 错误次数锁定（连错 5 次后正确码也无效）
 *   ⑤ JWT 签发与鉴权（带 token 成功 / 不带 / 伪造 token 失败）
 *   ⑥ 用户资料查询与更新
 *   ⑦ Agent 接口（知识库命中 / 无关问题降级 / 编排四场景）
 *   ⑧ 业务接口
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')

const BASE = 'http://localhost:3000'

const results = []
function check (name, fn) {
	return Promise.resolve()
		.then(fn)
		.then(() => {
			results.push({ name, ok: true })
			console.log('  ✅ ' + name)
		})
		.catch(e => {
			results.push({ name, ok: false, error: e.message })
			console.log('  ❌ ' + name + '\n     ' + e.message)
		})
}

function req (method, url, body, headers = {}) {
	return new Promise((resolve, reject) => {
		const data = body ? JSON.stringify(body) : null
		const opts = {
			method,
			hostname: 'localhost',
			port: 3000,
			path: url,
			headers: Object.assign(
				data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
				headers
			)
		}
		const r = http.request(opts, (res) => {
			let raw = ''
			res.on('data', c => { raw += c })
			res.on('end', () => {
				let parsed = null
				try { parsed = JSON.parse(raw) } catch (e) { parsed = raw }
				resolve({ status: res.statusCode, body: parsed })
			})
		})
		r.on('error', reject)
		if (data) r.write(data)
		r.end()
	})
}

const assert = require('assert')

async function run () {
	console.log('后端接口与安全设计测试（Sprint 5）')
	console.log('='.repeat(62))

	// ---------- ① 手机号严格校验 ----------
	console.log('\n【① 手机号严格类型校验】')

	const badInputs = [
		[['13800138000'], 'array'],
		[13800138000, 'number'],
		[null, 'null'],
		[undefined, 'undefined'],
		[{}, 'object'],
		[true, 'boolean']
	]

	for (const [value, label] of badInputs) {
		await check(`拒绝 ${label} 类型入参`, async () => {
			const r = await req('POST', '/api/auth/send-code', { mobile: value })
			assert.strictEqual(r.status, 400)
			assert.strictEqual(r.body.errCode, 'auth-invalid-mobile-type')
		})
	}

	await check('拒绝格式错误的手机号', async () => {
		const r = await req('POST', '/api/auth/send-code', { mobile: '123' })
		assert.strictEqual(r.body.errCode, 'auth-invalid-mobile')
	})

	await check('拒绝非法号段 128 开头', async () => {
		const r = await req('POST', '/api/auth/send-code', { mobile: '12800138000' })
		assert.strictEqual(r.body.errCode, 'auth-invalid-mobile')
	})

	// ---------- ② CSPRNG ----------
	console.log('\n【② CSPRNG 验证码生成】')

	await check('源码不含 Math.random（注释除外）', async () => {
		const p = path.join(__dirname, '..', 'src', 'utils', 'security.js')
		const code = fs.readFileSync(p, 'utf8')
			.split('\n')
			.filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line))
			.join('\n')
		assert.ok(!/Math\s*\.\s*random/.test(code), '不应使用 Math.random')
		assert.ok(/randomInt/.test(code), '应使用 crypto.randomInt')
	})

	await check('1000 次生成唯一值 > 990', async () => {
		const security = require(path.join(__dirname, '..', 'src', 'utils', 'security.js'))
		const set = new Set()
		for (let i = 0; i < 1000; i++) set.add(security.generateVerifyCode(6))
		assert.ok(set.size > 990, '实际唯一值 ' + set.size)
	})

	await check('验证码为 6 位数字', async () => {
		const security = require(path.join(__dirname, '..', 'src', 'utils', 'security.js'))
		for (let i = 0; i < 50; i++) {
			assert.ok(/^\d{6}$/.test(security.generateVerifyCode(6)))
		}
	})

	// ---------- ③ 频控 ----------
	console.log('\n【③ 发送频率限制】')

	const freqMobile = '138' + String(Date.now()).slice(-8)

	await check('首次发送成功并返回 devCode', async () => {
		const r = await req('POST', '/api/auth/send-code', { mobile: freqMobile })
		assert.strictEqual(r.status, 200)
		assert.ok(r.body.devCode, '开发模式应返回 devCode')
		assert.ok(/^\d{6}$/.test(r.body.devCode))
	})

	await check('60 秒内二次发送被拒绝（429）', async () => {
		const r = await req('POST', '/api/auth/send-code', { mobile: freqMobile })
		assert.strictEqual(r.status, 429)
		assert.strictEqual(r.body.errCode, 'auth-sms-too-frequent')
		assert.ok(r.body.retryAfter > 0 && r.body.retryAfter <= 60)
	})

	// ---------- ④ 错误次数锁定 ----------
	console.log('\n【④ 错误次数锁定】')

	const lockMobile = '139' + String(Date.now()).slice(-8)
	let realCode = ''
	await check('获取验证码', async () => {
		const r = await req('POST', '/api/auth/send-code', { mobile: lockMobile })
		realCode = r.body.devCode
		assert.ok(realCode)
	})

	for (let i = 1; i <= 5; i++) {
		await check(`第 ${i} 次错误（剩余 ${5 - i} 次）`, async () => {
			const r = await req('POST', '/api/auth/login', { mobile: lockMobile, code: '000000' })
			assert.strictEqual(r.status, 400)
			assert.strictEqual(r.body.errCode, 'auth-code-mismatch')
			assert.strictEqual(r.body.remainingAttempts, 5 - i)
		})
	}

	await check('连错 5 次后即使提交正确码也无法登录', async () => {
		const r = await req('POST', '/api/auth/login', { mobile: lockMobile, code: realCode })
		assert.strictEqual(r.status, 400)
		assert.ok(
			['auth-code-locked', 'auth-code-invalid-or-expired'].includes(r.body.errCode),
			'实际: ' + r.body.errCode
		)
	})

	// ---------- ⑤ JWT ----------
	console.log('\n【⑤ JWT 签发与鉴权】')

	const jwtMobile = '137' + String(Date.now()).slice(-8)
	let token = ''

	await check('登录成功并签发 token', async () => {
		const codeRes = await req('POST', '/api/auth/send-code', { mobile: jwtMobile })
		const r = await req('POST', '/api/auth/login', { mobile: jwtMobile, code: codeRes.body.devCode })
		assert.strictEqual(r.status, 200)
		assert.ok(r.body.token, '应签发 token')
		assert.ok(r.body.token.split('.').length === 3, '应为 JWT 三段式')
		assert.strictEqual(r.body.isNewUser, true, '首次登录应自动注册')
		assert.strictEqual(r.body.user.loginCount, 1)
		token = r.body.token
	})

	await check('带 token 访问 profile 成功', async () => {
		const r = await req('GET', '/api/user/profile', null, { Authorization: 'Bearer ' + token })
		assert.strictEqual(r.status, 200)
		assert.strictEqual(r.body.user.mobile, jwtMobile)
		assert.strictEqual(r.body.user.loginCount, 1)
	})

	await check('不带 token 返回 401', async () => {
		const r = await req('GET', '/api/user/profile')
		assert.strictEqual(r.status, 401)
		assert.strictEqual(r.body.errCode, 'auth-token-missing')
	})

	await check('伪造 token 返回 401', async () => {
		const r = await req('GET', '/api/user/profile', null, { Authorization: 'Bearer fake.token.here' })
		assert.strictEqual(r.status, 401)
		assert.strictEqual(r.body.errCode, 'auth-token-invalid')
	})

	await check('会话体检返回剩余有效期', async () => {
		const r = await req('GET', '/api/user/session', null, { Authorization: 'Bearer ' + token })
		assert.strictEqual(r.status, 200)
		assert.strictEqual(r.body.valid, true)
		assert.ok(r.body.expiresIn > 0)
		assert.strictEqual(r.body.expiresSoon, false)
	})

	// ---------- ⑥ 用户资料 ----------
	console.log('\n【⑥ 用户资料查询与更新】')

	await check('更新昵称成功', async () => {
		const r = await req('PUT', '/api/user/profile', { nickname: 'CharLene' }, { Authorization: 'Bearer ' + token })
		assert.strictEqual(r.status, 200)
		assert.strictEqual(r.body.user.nickname, 'CharLene')
	})

	await check('不允许修改服务端维护的字段（loginCount）', async () => {
		const r = await req('PUT', '/api/user/profile', { loginCount: 999 }, { Authorization: 'Bearer ' + token })
		assert.strictEqual(r.status, 400)
		assert.strictEqual(r.body.errCode, 'user-nothing-to-update')
	})

	await check('更新后重新签发 token', async () => {
		const r = await req('PUT', '/api/user/profile', { nickname: 'CharLene2' }, { Authorization: 'Bearer ' + token })
		assert.ok(r.body.token, '应返回新 token')
	})

	// ---------- ⑦ Agent ----------
	console.log('\n【⑦ Agent 接口】')

	await check('知识库命中（零外部依赖）', async () => {
		const r = await req('POST', '/api/agent/chat', { message: '晨洲村有什么好吃的' })
		assert.strictEqual(r.status, 200)
		assert.strictEqual(r.body.source, 'knowledge-base')
		assert.ok(r.body.answer.length > 10)
	})

	await check('无关问题走降级（不胡编）', async () => {
		const r = await req('POST', '/api/agent/chat', { message: '今天天气怎么样' })
		assert.strictEqual(r.body.source, 'fallback')
		assert.strictEqual(r.body.degraded, true)
		assert.ok(r.body.capabilities && r.body.capabilities.length > 0)
	})

	await check('缺少提问内容返回 400', async () => {
		const r = await req('POST', '/api/agent/chat', {})
		assert.strictEqual(r.status, 400)
		assert.strictEqual(r.body.errCode, 'agent-missing-message')
	})

	const agentCases = [
		['我登录了几次', 1, 'tool-result'],
		['现在几点', 1, 'tool-result'],
		['我登录了几次现在几点', 2, 'tool-result'],
		['今天天气怎么样', 0, 'fallback']
	]

	for (const [input, expectedCount, expectedType] of agentCases) {
		await check(`编排「${input}」→ ${expectedType}（${expectedCount} 个工具）`, async () => {
			const r = await req('POST', '/api/agent/run', { input })
			assert.strictEqual(r.status, 200)
			assert.strictEqual(r.body.type, expectedType)
			assert.strictEqual(r.body.results.length, expectedCount)
		})
	}

	// ---------- ⑧ 业务接口 ----------
	console.log('\n【⑧ 业务接口】')

	await check('村庄列表接口可用', async () => {
		const r = await req('GET', '/api/business/get_villages_list')
		assert.strictEqual(r.status, 200)
		assert.ok(Array.isArray(r.body.data))
	})

	await check('未知业务接口返回 404', async () => {
		const r = await req('GET', '/api/business/not-exist')
		assert.strictEqual(r.status, 404)
		assert.strictEqual(r.body.errCode, 'business-not-found')
	})

	await check('未登录调用写接口返回业务错误', async () => {
		const r = await req('POST', '/api/business/checkIn', { locationId: '101' })
		assert.strictEqual(r.status, 200)
		assert.strictEqual(r.body.errCode, 'business-not-logged-in')
	})

	await check('健康检查接口可用', async () => {
		const r = await req('GET', '/api/health')
		assert.strictEqual(r.status, 200)
		assert.strictEqual(r.body.code, 200)
	})

	// ---------- ⑨ Sprint 5.2 · 本地品鉴引擎 ----------
	console.log('\n【⑨ 本地品鉴引擎（analyzeFoodPhoto）】')

	await check('返回前端期望的字段 isFood/score/comment/tags', async () => {
		const r = await req('POST', '/api/business/analyzeFoodPhoto', {
			fileID: '/uploads/test-1.jpg'
		})
		assert.strictEqual(r.status, 200)
		assert.strictEqual(r.body.code, 200)
		const d = r.body.data
		assert.strictEqual(d.isFood, true, 'isFood 应为 true')
		assert.strictEqual(typeof d.score, 'number', 'score 应为数字')
		assert.strictEqual(typeof d.comment, 'string', 'comment 应为字符串')
		assert.ok(Array.isArray(d.tags), 'tags 应为数组')
		assert.ok(d.comment.length > 20, 'comment 应有实质内容')
	})

	await check('评分落在 80-95 区间', async () => {
		for (let i = 0; i < 12; i++) {
			const r = await req('POST', '/api/business/analyzeFoodPhoto', {
				fileID: `/uploads/rand-${i}.jpg`
			})
			const s = r.body.data.score
			assert.ok(s >= 80 && s <= 95, `评分 ${s} 越界（应 80-95）`)
		}
	})

	await check('相同输入 → 完全相同的输出（确定性）', async () => {
		const a = await req('POST', '/api/business/analyzeFoodPhoto', { fileID: '/uploads/same.jpg' })
		const b = await req('POST', '/api/business/analyzeFoodPhoto', { fileID: '/uploads/same.jpg' })
		assert.strictEqual(a.body.data.score, b.body.data.score)
		assert.strictEqual(a.body.data.comment, b.body.data.comment)
	})

	await check('不同输入 → 不同输出（有变化感）', async () => {
		const a = await req('POST', '/api/business/analyzeFoodPhoto', { fileID: '/uploads/x1.jpg' })
		const b = await req('POST', '/api/business/analyzeFoodPhoto', { fileID: '/uploads/x2.jpg' })
		assert.notStrictEqual(
			a.body.data.score + a.body.data.comment,
			b.body.data.score + b.body.data.comment,
			'不同输入应产生不同结果'
		)
	})

	await check('显式传入菜名时被采用', async () => {
		const r = await req('POST', '/api/business/analyzeFoodPhoto', {
			fileID: '/uploads/any.jpg',
			name: '清蒸晨洲蚝'
		})
		assert.strictEqual(r.body.data.name, '清蒸晨洲蚝')
	})

	// ---------- ⑩ Sprint 5.2 · 上传路由顺序 ----------
	console.log('\n【⑩ 文件上传（路由顺序回归）】')

	await check('POST /api/business/upload 不被 :name 路由拦截', async () => {
		const r = await req('POST', '/api/business/upload', {})
		// 未带文件时 multer 会返回 400「未接收到文件」，
		// 而不是 404「未知的业务接口: upload」——
		// 后者说明 upload 路由被 :name 抢先匹配了。
		assert.notStrictEqual(r.status, 404, 'upload 路由被 :name 拦截了')
		assert.notStrictEqual(r.body.errCode, 'business-not-found',
			'upload 路由被 :name 拦截了')
	})

	await check('上传的静态资源可被访问（相对路径 → 绝对 URL）', async () => {
		// 构造一个最小 PNG
		const png = Buffer.from(
			'89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
			'0000000a49444154789c6300010000050001od0a2db40000000049454e44ae426082',
			'hex'
		)
		const tmp = path.join(os.tmpdir(), 'sprint52-upload-test.png')
		fs.writeFileSync(tmp, png)

		const boundary = '----sprint52boundary'
		const body = Buffer.concat([
			Buffer.from('--' + boundary + '\r\n'),
			Buffer.from('Content-Disposition: form-data; name="file"; filename="t.png"\r\n'),
			Buffer.from('Content-Type: image/png\r\n\r\n'),
			png,
			Buffer.from('\r\n--' + boundary + '--\r\n')
		])

		const res = await new Promise((resolve, reject) => {
			const req2 = http.request({
				hostname: 'localhost',
				port: 3000,
				path: '/api/business/upload',
				method: 'POST',
				headers: {
					'Content-Type': 'multipart/form-data; boundary=' + boundary,
					'Content-Length': body.length
				}
			}, r => {
				let d = ''
				r.on('data', c => { d += c })
				r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(d) }))
			})
			req2.on('error', reject)
			req2.write(body)
			req2.end()
		})

		assert.strictEqual(res.status, 200, '上传应成功')
		assert.ok(res.body.url, '应返回 url')
		assert.ok(res.body.url.startsWith('/uploads/'), 'url 应是 /uploads/ 开头的相对路径')

		// 相对路径拼上后端地址后应能取到文件
		const abs = 'http://localhost:3000' + res.body.url
		const getRes = await new Promise((resolve, reject) => {
			http.get(abs, r => {
				let n = 0
				r.on('data', c => { n += c.length })
				r.on('end', () => resolve({ status: r.statusCode, length: n }))
			}).on('error', reject)
		})
		assert.strictEqual(getRes.status, 200, '静态资源应可访问')
		assert.ok(getRes.length > 0, '文件不应为空')

		try { fs.unlinkSync(tmp) } catch (e) { /* 忽略 */ }
	})

	// ---------- ⑪ Sprint 5.2 · Agent 编排接入 ----------
	console.log('\n【⑪ Agent 编排接入（chat 未命中知识库时）】')

	await check('「几点了」走编排层返回真实时间', async () => {
		const r = await req('POST', '/api/agent/chat', { message: '几点了' })
		assert.strictEqual(r.status, 200)
		assert.strictEqual(r.body.source, 'agent-orchestration',
			'应走编排层而不是 fallback：' + r.body.source)
		assert.ok(/\d{4}/.test(r.body.answer), '应返回含年份的时间：' + r.body.answer)
	})

	await check('「我是谁」走编排层（未登录时给出明确说明）', async () => {
		const r = await req('POST', '/api/agent/chat', { message: '我是谁' })
		assert.strictEqual(r.status, 200)
		assert.strictEqual(r.body.source, 'agent-orchestration',
			'应走编排层：' + r.body.source)
		assert.ok(r.body.answer && r.body.answer.length > 0, '应有回答')
	})

	await check('美食问题仍优先走知识库', async () => {
		const r = await req('POST', '/api/agent/chat', { message: '晨洲村有什么好吃的' })
		assert.strictEqual(r.body.source, 'knowledge-base')
		assert.strictEqual(r.body.degraded, false)
	})

	await check('完全无关的问题仍走降级（不胡编）', async () => {
		const r = await req('POST', '/api/agent/chat', { message: '今天天气怎么样' })
		assert.strictEqual(r.body.source, 'fallback')
		assert.strictEqual(r.body.degraded, true)
	})

	// ---------- 汇总 ----------
	console.log('\n' + '='.repeat(62))
	const passed = results.filter(r => r.ok).length
	const failed = results.filter(r => !r.ok)
	console.log(`结果: ${passed}/${results.length} 通过`)
	if (failed.length) {
		console.log('\n失败项:')
		failed.forEach(f => console.log('  ❌ ' + f.name + '\n     ' + f.error))
		process.exitCode = 1
	} else {
		console.log('后端全部测试通过 ✅')
	}
}

run().catch(e => {
	console.error('测试运行异常:', e)
	process.exitCode = 1
})

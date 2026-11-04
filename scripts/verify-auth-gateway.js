#!/usr/bin/env node
'use strict'

/**
 * auth-gateway 本地验证脚本（Sprint 1）
 *
 * 目的：在不依赖真实 uniCloud 运行时的前提下，验证四道安全闸的行为。
 * 做法：用内存数据库 mock 掉 uniCloud 的 collection API，
 *       直接驱动 auth-gateway 的 handler 逻辑。
 *
 * 用法：node scripts/verify-auth-gateway.js
 * 退出码：0 = 全部通过；1 = 存在失败项
 */

const path = require('path')
const assert = require('assert')

const GATEWAY_DIR = path.join(__dirname, '..', 'uniCloud-aliyun', 'cloudfunctions', 'auth-gateway')

// ==================== uniCloud 内存 mock ====================

function createMockDb () {
	const store = new Map() // collectionName -> Map(id -> doc)

	function getColl (name) {
		if (!store.has(name)) store.set(name, new Map())
		return store.get(name)
	}

	function matchValue (docValue, cond) {
		if (cond && typeof cond === 'object' && cond.__gt !== undefined) {
			return typeof docValue === 'number' ? docValue > cond.__gt : false
		}
		return docValue === cond
	}

	const collection = (name) => {
		const coll = getColl(name)
		return {
			async add (doc) {
				const id = doc._id || `mock_${coll.size + 1}`
				coll.set(id, Object.assign({ _id: id }, doc))
				return { id }
			},
			doc (id) {
				return {
					async get () {
						const doc = coll.get(id)
						return { data: doc ? [doc] : [] }
					},
					async set (data) {
						coll.set(id, Object.assign({}, coll.get(id), data, { _id: id }))
						return { updated: 1 }
					},
					async update (data) {
						const cur = coll.get(id)
						if (cur) coll.set(id, Object.assign({}, cur, data))
						return { updated: cur ? 1 : 0 }
					},
					async remove () {
						coll.delete(id)
						return { deleted: 1 }
					}
				}
			},
			where (cond) {
				return {
					async get () {
						const data = []
						for (const doc of coll.values()) {
							const ok = Object.keys(cond).every(k => matchValue(doc[k], cond[k]))
							if (ok) data.push(doc)
						}
						return { data }
					},
					async update (data) {
						let n = 0
						for (const doc of coll.values()) {
							const ok = Object.keys(cond).every(k => matchValue(doc[k], cond[k]))
							if (ok) {
								coll.set(doc._id, Object.assign({}, doc, data))
								n++
							}
						}
						return { updated: n }
					}
				}
			}
		}
	}

	const db = {
		collection,
		command: {
			gt (v) {
				return { __gt: v }
			}
		},
		// 供测试读取内部状态
		__store: store
	}
	return db
}

const mockDb = createMockDb()
global.uniCloud = {
	database: () => mockDb,
	importObject: () => ({
		async sendSmsCode () {
			return { errCode: 0, mocked: true }
		},
		async loginBySms ({ mobile, code }) {
			// mock：模拟 uni-id-co 校验通过并签发 token
			return { errCode: 0, token: 'mock-token-for-' + mobile, tokenExpired: Date.now() + 7200000 }
		}
	})
}

// ==================== 加载被测代码 ====================

// auth-gateway 需要读取 app-config 的 dev 开关，这里注入一个模拟配置
const Module = require('module')
const origResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
	if (request === 'app-config' || request === '../common/app-config') {
		return path.join(__dirname, '__mock_app_config__.js')
	}
	return origResolve.call(this, request, ...args)
}
require('fs').writeFileSync(
	path.join(__dirname, '__mock_app_config__.js'),
	'module.exports = { getConfig: () => ({ dev: { simulateSms: true } }) }\n'
)

const handlers = require(path.join(GATEWAY_DIR, 'lib', 'handlers'))
const guards = require(path.join(GATEWAY_DIR, 'lib', 'guards'))

// ==================== 测试用例 ====================

const results = []
function check (name, fn) {
	try {
		fn()
		results.push({ name, ok: true })
		console.log('  ✅ ' + name)
	} catch (e) {
		results.push({ name, ok: false, error: e.message })
		console.log('  ❌ ' + name + '\n       ' + e.message)
	}
}

async function run () {
	console.log('Sprint 1 验证 —— auth-gateway 四道安全闸')
	console.log('='.repeat(62))

	const ctx = { clientInfo: { uniPlatform: 'mp-weixin', appId: '__UNI__616805C' } }
	const MOBILE = '13800138000'

	// ---------- ① 手机号严格类型校验 ----------
	console.log('\n【① 手机号严格类型校验】')

	check('数组入参被拒绝', () => {
		const r = guards.validateMobile(['13800138000'])
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.errCode, 'auth-invalid-mobile-type')
	})

	check('数字入参被拒绝', () => {
		const r = guards.validateMobile(13800138000)
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.errCode, 'auth-invalid-mobile-type')
	})

	check('null 入参被拒绝', () => {
		const r = guards.validateMobile(null)
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.errCode, 'auth-invalid-mobile-type')
	})

	check('undefined 入参被拒绝', () => {
		const r = guards.validateMobile(undefined)
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.errCode, 'auth-invalid-mobile-type')
	})

	check('非 11 位手机号被拒绝', () => {
		const r = guards.validateMobile('1380013800')
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.errCode, 'auth-invalid-mobile')
	})

	check('非法号段 128 开头被拒绝', () => {
		const r = guards.validateMobile('12800138000')
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.errCode, 'auth-invalid-mobile')
	})

	check('合法手机号通过', () => {
		const r = guards.validateMobile(MOBILE)
		assert.strictEqual(r.ok, true)
		assert.strictEqual(r.mobile, MOBILE)
	})

	check('sendSmsCode 传数组返回结构化错误（不抛异常）', async () => {
		const res = await handlers.handleSendSmsCode({ mobile: [MOBILE] }, ctx)
		assert.strictEqual(res.code, 400)
		assert.strictEqual(res.errCode, 'auth-invalid-mobile-type')
		assert.ok(res.errMsg, '应包含 errMsg')
	})

	// ---------- ② CSPRNG 验证码 ----------
	console.log('\n【② CSPRNG 验证码生成】')

	check('生成长度为 6', () => {
		const code = guards.generateVerifyCode(6)
		assert.strictEqual(code.length, 6)
	})

	check('全部为数字字符', () => {
		for (let i = 0; i < 200; i++) {
			assert.ok(/^\d{6}$/.test(guards.generateVerifyCode(6)))
		}
	})

	check('1000 次生成不出现同一结果（随机性有效）', () => {
		const set = new Set()
		for (let i = 0; i < 1000; i++) set.add(guards.generateVerifyCode(6))
		assert.ok(set.size > 990, '实际唯一值 ' + set.size + '/1000')
	})

	check('不是 Math.random 实现（源码级断言）', () => {
		const src = require('fs').readFileSync(path.join(GATEWAY_DIR, 'lib', 'guards.js'), 'utf8')
		// 剥离注释后再断言，避免把「注释中提到 Math.random」误判为使用
		const code = src
			.split('\n')
			.filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line))
			.join('\n')
		assert.ok(!/Math\s*\.\s*random/.test(code), 'guards.js 的代码中不应出现 Math.random')
		assert.ok(/randomInt/.test(code), '应使用 crypto.randomInt')
	})

	// ---------- ③ 发送频控 ----------
	console.log('\n【③ 发送频率限制】')

	const freshMobile = '13800138001'
	const send1 = await handlers.handleSendSmsCode({ mobile: freshMobile }, ctx)
	check('首次发送成功', () => {
		assert.strictEqual(send1.code, 200)
		assert.ok(send1.devCode, 'dev 模式应返回 devCode')
		assert.ok(/^\d{6}$/.test(send1.devCode))
	})

	const send2 = await handlers.handleSendSmsCode({ mobile: freshMobile }, ctx)
	check('60 秒内第二次发送被拒绝', () => {
		assert.strictEqual(send2.code, 400)
		assert.strictEqual(send2.errCode, 'auth-sms-too-frequent')
		assert.ok(send2.retryAfter > 0 && send2.retryAfter <= 60, 'retryAfter=' + send2.retryAfter)
	})

	check('不同手机号不受影响', async () => {
		const other = await handlers.handleSendSmsCode({ mobile: '13800138002' }, ctx)
		assert.strictEqual(other.code, 200)
	})

	check('单日上限 10 次生效', async () => {
		// 复用同一 mobile，伪造时间跨过 60 秒间隔，累计到 11 次
		const db = mockDb
		const rateColl = db.__store.get('auth-sms-rate-limit')
		const docId = 'login-by-sms_13800138003'
		let t = Date.now()
		for (let i = 0; i < 10; i++) {
			t += 61 * 1000
			rateColl.set(docId, { _id: docId, mobile: '13800138003', scene: 'login-by-sms', lastSendAt: t, day: guards.todayKey(t), dayCount: i + 1 })
		}
		const r = await guards.checkRateLimit(db, '13800138003', 'login-by-sms', t + 61 * 1000)
		assert.strictEqual(r.allowed, false)
		assert.strictEqual(r.errCode, 'auth-sms-daily-limit')
	})

	// ---------- ④ 错误次数锁定 ----------
	console.log('\n【④ 错误次数锁定】')

	const lockMobile = '13800138010'
	const sent = await handlers.handleSendSmsCode({ mobile: lockMobile }, ctx)
	const realCode = sent.devCode
	check('验证码发送成功', () => assert.ok(realCode))

	const wrong1 = await handlers.handleLoginBySms({ mobile: lockMobile, code: '000000' }, ctx)
	check('第 1 次错误：未锁定，剩余 4 次', () => {
		assert.strictEqual(wrong1.code, 400)
		assert.strictEqual(wrong1.errCode, 'auth-code-mismatch')
		assert.strictEqual(wrong1.remainingAttempts, 4)
	})

	for (let i = 2; i <= 4; i++) {
		const r = await handlers.handleLoginBySms({ mobile: lockMobile, code: '000000' }, ctx)
		check(`第 ${i} 次错误：剩余 ${5 - i} 次`, () => {
			assert.strictEqual(r.errCode, 'auth-code-mismatch')
			assert.strictEqual(r.remainingAttempts, 5 - i)
		})
	}

	const wrong5 = await handlers.handleLoginBySms({ mobile: lockMobile, code: '000000' }, ctx)
	check('第 5 次错误：验证码作废', () => {
		assert.strictEqual(wrong5.code, 400)
		assert.ok(wrong5.errCode === 'auth-code-locked' || wrong5.errCode === 'auth-code-mismatch')
		assert.strictEqual(wrong5.remainingAttempts, 0)
	})

	const afterLock = await handlers.handleLoginBySms({ mobile: lockMobile, code: realCode }, ctx)
	check('作废后即使提交正确验证码也无法登录', () => {
		assert.strictEqual(afterLock.code, 400)
		assert.ok(['auth-code-locked', 'auth-code-invalid-or-expired'].includes(afterLock.errCode))
	})

	// ---------- 正确验证码登录成功 ----------
	console.log('\n【⑤ 完整链路：正确验证码登录成功】')

	const okMobile = '13800138020'
	const okSent = await handlers.handleSendSmsCode({ mobile: okMobile }, ctx)
	const okCode = okSent.devCode

	const loginRes = await handlers.handleLoginBySms({ mobile: okMobile, code: okCode }, ctx)
	check('正确验证码登录成功并返回 token', () => {
		assert.strictEqual(loginRes.code, 200)
		assert.strictEqual(loginRes.message, '登录成功')
		assert.ok(loginRes.result && loginRes.result.token)
	})

	check('验证码格式非法（字母）被拒绝', async () => {
		const r = await guards.verifyCode(mockDb, '13800138030', 'login-by-sms', 'abcdef', Date.now())
		assert.strictEqual(r.ok, false)
		assert.strictEqual(r.errCode, 'auth-invalid-code-format')
	})

	check('未知 action 返回结构化错误', async () => {
		const gateway = require(path.join(GATEWAY_DIR, 'index.js'))
		const r = await gateway.main({ action: 'notExist' }, ctx)
		assert.strictEqual(r.code, 400)
		assert.strictEqual(r.errCode, 'auth-unknown-action')
	})

	// ==================== 汇总 ====================
	console.log('\n' + '='.repeat(62))
	const passed = results.filter(r => r.ok).length
	const failed = results.filter(r => !r.ok)
	console.log(`结果: ${passed}/${results.length} 通过`)
	if (failed.length) {
		console.log('\n失败项:')
		failed.forEach(f => console.log('  ❌ ' + f.name + '\n     ' + f.error))
		process.exitCode = 1
	} else {
		console.log('Sprint 1 验证全部通过 ✅')
	}

	// 清理 mock 文件
	try {
		require('fs').unlinkSync(path.join(__dirname, '__mock_app_config__.js'))
	} catch (e) {}
}

run().catch(e => {
	console.error('验证脚本异常:', e)
	process.exitCode = 1
})

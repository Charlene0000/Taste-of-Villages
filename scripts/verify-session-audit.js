#!/usr/bin/env node
'use strict'

/**
 * session-audit 本地验证脚本（Sprint 1）
 *
 * 验证：token 有效性判定、剩余有效期计算、即将过期标记、
 *       设备数统计、IP 掩码、异常 token 处理。
 *
 * 用法：node scripts/verify-session-audit.js
 */

const path = require('path')
const assert = require('assert')
const crypto = require('crypto')

const AUDIT_DIR = path.join(__dirname, '..', 'uniCloud-aliyun', 'cloudfunctions', 'session-audit')

// ==================== uniCloud 内存 mock ====================

const users = new Map()
users.set('uid_001', {
	_id: 'uid_001',
	token: ['t1', 't2', 't3'],
	last_login_ip: '183.63.97.118'
})

global.uniCloud = {
	database: () => ({
		collection: () => ({
			doc: (id) => ({
				async get () {
					const u = users.get(id)
					return { data: u ? [u] : [] }
				}
			})
		})
	})
}

const audit = require(path.join(AUDIT_DIR, 'index.js'))

/** 构造一个合法的 JWT 形态 token（payload 部分为 base64url JSON） */
function makeToken (payload) {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
	const sig = crypto.createHmac('sha256', 'secret').update(header + '.' + body).digest('base64url')
	return header + '.' + body + '.' + sig
}

// ==================== 测试 ====================

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
	console.log('Sprint 1 验证 —— session-audit 会话健康检查')
	console.log('='.repeat(62))

	const now = Math.floor(Date.now() / 1000)

	// ---------- token 有效性 ----------
	console.log('\n【① token 有效性判定】')

	const validToken = makeToken({ uid: 'uid_001', exp: now + 3600 })
	const r1 = await audit.main({ token: validToken })
	check('有效 token：valid=true', () => {
		assert.strictEqual(r1.code, 200)
		assert.strictEqual(r1.valid, true)
	})

	check('有效 token：返回剩余有效期', () => {
		assert.ok(r1.expiresIn > 3500 && r1.expiresIn <= 3600, 'expiresIn=' + r1.expiresIn)
	})

	check('有效 token：未到阈值不标记 expiresSoon', () => {
		assert.strictEqual(r1.expiresSoon, false)
	})

	const soonToken = makeToken({ uid: 'uid_001', exp: now + 300 })
	const r2 = await audit.main({ token: soonToken })
	check('剩余 300 秒：标记 expiresSoon=true', () => {
		assert.strictEqual(r2.valid, true)
		assert.strictEqual(r2.expiresSoon, true)
		assert.strictEqual(r2.expiresIn, 300)
	})

	const expiredToken = makeToken({ uid: 'uid_001', exp: now - 10 })
	const r3 = await audit.main({ token: expiredToken })
	check('已过期 token：valid=false', () => {
		assert.strictEqual(r3.valid, false)
		assert.strictEqual(r3.expiresIn, 0)
		assert.strictEqual(r3.reason, 'session-token-expired')
	})

	const r4 = await audit.main({})
	check('缺少 token：valid=false 且不抛异常', () => {
		assert.strictEqual(r4.valid, false)
		assert.strictEqual(r4.reason, 'session-token-missing')
	})

	const r5 = await audit.main({ token: 'not-a-jwt' })
	check('格式错误 token：valid=false 且不抛异常', () => {
		assert.strictEqual(r5.valid, false)
		assert.strictEqual(r5.reason, 'session-token-malformed')
	})

	const r6 = await audit.main({ token: 'a.b' })
	check('段数不对的 token：valid=false', () => {
		assert.strictEqual(r6.valid, false)
	})

	const r7 = await audit.main({ token: 'a.!!!notbase64!!!.c' })
	check('payload 不可解析的 token：valid=false', () => {
		assert.strictEqual(r7.valid, false)
		assert.strictEqual(r7.reason, 'session-token-malformed')
	})

	// ---------- 设备数与登录地 ----------
	console.log('\n【② 设备数与最近登录地】')

	check('deviceCount 基于 token 数组长度', () => {
		assert.strictEqual(r1.deviceCount, 3)
	})

	check('lastLoginIpMasked 保留前两段', () => {
		assert.strictEqual(r1.lastLoginIpMasked, '183.63.*.*')
	})

	check('用户不存在时 deviceCount 为 null', async () => {
		const orphan = makeToken({ uid: 'uid_999', exp: now + 3600 })
		const r = await audit.main({ token: orphan })
		assert.strictEqual(r.valid, true)
		assert.strictEqual(r.deviceCount, null)
		assert.strictEqual(r.lastLoginIpMasked, null)
	})

	// ---------- IP 掩码纯函数 ----------
	console.log('\n【③ IP 掩码纯函数】')

	check('IPv4 正常掩码', () => {
		assert.strictEqual(audit.maskIp('192.168.1.100'), '192.168.*.*')
	})

	check('非 IPv4 格式降级处理', () => {
		const m = audit.maskIp('2001:db8::1')
		assert.ok(typeof m === 'string' && m.includes('*'))
	})

	check('空值返回 null', () => {
		assert.strictEqual(audit.maskIp(''), null)
		assert.strictEqual(audit.maskIp(null), null)
		assert.strictEqual(audit.maskIp(undefined), null)
	})

	// ---------- 边界：不做地理解析与威胁检测 ----------
	console.log('\n【④ 边界确认】')

	check('不返回地理位置字段', () => {
		assert.strictEqual(r1.location, undefined)
		assert.strictEqual(r1.geo, undefined)
		assert.strictEqual(r1.city, undefined)
	})

	check('不返回威胁检测字段', () => {
		assert.strictEqual(r1.risk, undefined)
		assert.strictEqual(r1.threat, undefined)
		assert.strictEqual(r1.anomaly, undefined)
	})

	check('纯读：不修改用户记录', async () => {
		const before = JSON.stringify(users.get('uid_001'))
		await audit.main({ token: validToken })
		assert.strictEqual(JSON.stringify(users.get('uid_001')), before)
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
		console.log('Sprint 1 session-audit 验证全部通过 ✅')
	}
}

run().catch(e => {
	console.error('验证脚本异常:', e)
	process.exitCode = 1
})

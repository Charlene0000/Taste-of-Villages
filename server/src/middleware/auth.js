'use strict'

/**
 * JWT 鉴权中间件（自研）
 *
 * 替代原 uni-id-co 的 checkToken 机制。
 *
 * 设计要点：
 *   - 从 Authorization: Bearer <token> 解析 token
 *   - 校验签名与有效期
 *   - 把 payload 挂到 req.user，供后续中间件与路由使用
 *   - 失败时返回 401 + 结构化错误码，与前端的 request.js 拦截逻辑对应
 */

const jwt = require('jsonwebtoken')
const { config } = require('../config')

/**
 * 从请求头中提取 token
 */
function extractToken (req) {
	const header = req.headers.authorization || req.headers.Authorization
	if (!header) return ''
	if (typeof header !== 'string') return ''
	// 支持 "Bearer xxx" 与裸 token 两种形式
	if (header.startsWith('Bearer ')) return header.slice(7).trim()
	return header.trim()
}

/**
 * 签发 token
 * @param {Object} payload 业务载荷
 * @returns {string}
 */
function sign (payload) {
	return jwt.sign(payload, config.jwtSecret, {
		expiresIn: config.jwtExpiresIn
	})
}

/**
 * 解析 token（不抛异常，失败返回 null）
 * @param {string} token
 * @returns {Object|null}
 */
function decode (token) {
	try {
		return jwt.verify(token, config.jwtSecret)
	} catch (e) {
		return null
	}
}

/**
 * 鉴权中间件 —— 强制要求有效 token
 */
function requireAuth (req, res, next) {
	const token = extractToken(req)
	if (!token) {
		return res.status(401).json({
			code: 401,
			errCode: 'auth-token-missing',
			errMsg: '缺少登录凭证'
		})
	}

	const payload = decode(token)
	if (!payload) {
		return res.status(401).json({
			code: 401,
			errCode: 'auth-token-invalid',
			errMsg: '登录凭证无效或已过期'
		})
	}

	req.user = payload
	req.token = token
	next()
}

/**
 * 可选鉴权中间件 —— 有 token 就解析，没有也放行
 * 用于「游客可访问但登录用户有额外信息」的接口
 */
function optionalAuth (req, res, next) {
	const token = extractToken(req)
	if (token) {
		const payload = decode(token)
		if (payload) {
			req.user = payload
			req.token = token
		}
	}
	next()
}

module.exports = {
	requireAuth,
	optionalAuth,
	sign,
	decode,
	extractToken
}

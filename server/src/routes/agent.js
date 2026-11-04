'use strict'

/**
 * Agent 路由
 *
 * 提供两个接口：
 *   POST /api/agent/chat   —— 知识库检索 + 规则回答（零外部依赖）
 *   POST /api/agent/run    —— 完整编排（planner + executor + fallback）
 *
 * 这是 Sprint 5 中「AI Agent 接口本地化」的落点：
 * 原先依赖 uniCloud 的 ai-agent 云函数，现由本地 Express 服务承载。
 */

const express = require('express')
const agentService = require('../services/agent')
const { optionalAuth } = require('../middleware/auth')

const router = express.Router()

/**
 * POST /api/agent/chat
 * 问答接口 —— 供 AI 弹窗（饼饼）使用
 */
router.post('/chat', optionalAuth, async (req, res) => {
	try {
		const { message, messages, system } = req.body || {}

		// 兼容前端旧格式：传 messages 数组，取最后一条 user 消息
		let question = message
		if (!question && Array.isArray(messages)) {
			const lastUser = [...messages].reverse().find(m => m.role === 'user')
			question = lastUser ? lastUser.content : ''
		}

		if (!question || typeof question !== 'string' || !question.trim()) {
			return res.status(400).json({
				code: 400,
				errCode: 'agent-missing-message',
				errMsg: '缺少提问内容'
			})
		}

		// Sprint 5.2：把当前登录用户查出来传给服务层
		// 「我是谁」这类问题需要用户上下文（手机号/昵称/登录次数），
		// 之前没传，所以工具拿到的永远是空用户 → 回答「当前未获取到用户信息」。
		let user = null
		if (req.user && req.user.uid) {
			try {
				const { getPrisma } = require('../db')
				const prisma = getPrisma()
				user = await prisma.user.findUnique({ where: { id: req.user.uid } })
			} catch (e) {
				console.error('[agent] 读取用户失败:', e.message)
			}
		}

		const result = await agentService.answer(question.trim(), {
			system,
			history: Array.isArray(messages)
				? messages.filter(m => m.role === 'user' || m.role === 'assistant')
				: null,
			user,
			userId: req.user ? req.user.uid : null
		})

		// 保存聊天记录
		await agentService.saveChatHistory(
			req.user ? req.user.uid : null,
			question.trim(),
			result.answer
		)

		return res.json({
			code: 200,
			message: '请求成功',
			source: result.source,
			degraded: !!result.degraded,
			answer: result.answer,
			capabilities: result.capabilities || null,
			durationMs: result.durationMs,
			// 兼容旧前端期望的 OpenAI 风格结构
			result: {
				id: `kb_${Date.now()}`,
				object: 'chat.completion',
				created: Math.floor(Date.now() / 1000),
				model: 'local-' + result.source,
				choices: [{
					index: 0,
					message: { role: 'assistant', content: result.answer },
					finish_reason: 'stop'
				}]
			}
		})
	} catch (e) {
		console.error('[agent] chat 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'agent-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

/**
 * POST /api/agent/run
 * 完整编排接口 —— 供 Agent 演示页使用
 */
router.post('/run', optionalAuth, async (req, res) => {
	try {
		const { input } = req.body || {}
		if (!input || typeof input !== 'string' || !input.trim()) {
			return res.status(400).json({
				code: 400,
				errCode: 'agent-missing-input',
				errMsg: '缺少输入内容'
			})
		}

		// 构造用户上下文（服务端可直接查库，比前端版本更完整）
		let user = null
		if (req.user && req.user.uid) {
			const { getPrisma } = require('../db')
			const prisma = getPrisma()
			user = await prisma.user.findUnique({ where: { id: req.user.uid } })
		}

		const result = await agentService.runAgent(input.trim(), {
			user,
			userId: req.user ? req.user.uid : null
		})

		return res.json(result)
	} catch (e) {
		console.error('[agent] run 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'agent-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

/**
 * GET /api/agent/history
 * 读取当前用户的聊天记录
 */
router.get('/history', optionalAuth, async (req, res) => {
	try {
		const history = await agentService.getChatHistory(
			req.user ? req.user.uid : null
		)
		return res.json({
			code: 200,
			data: history
		})
	} catch (e) {
		console.error('[agent] history 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'agent-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

/**
 * DELETE /api/agent/history
 * 清除当前用户的聊天记录
 */
router.delete('/history', optionalAuth, async (req, res) => {
	try {
		const { getPrisma } = require('../db')
		const userId = req.user ? req.user.uid : null
		if (userId) {
			const prisma = getPrisma()
			await prisma.chatHistory.deleteMany({ where: { userId } })
		}
		return res.json({ code: 200, message: '聊天记录已清空' })
	} catch (e) {
		console.error('[agent] clear history 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'agent-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

module.exports = router

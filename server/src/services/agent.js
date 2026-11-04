'use strict'

/**
 * AI Agent 服务（自研）
 *
 * 本模块是 Sprint 2 中 `agent/` 编排层的服务端实现。
 *
 * 为什么要搬到服务端
 * ----------------
 * Sprint 2 时 Agent 编排层放在前端，原因是「HBuilderX 上传云函数只打包
 * cloudfunctions/<name>/，云函数无法 require 项目根的 agent/」。
 * 现在后端是独立的 Node 服务，**可以直接 require 共享的 agent 模块**，
 * 于是把编排层移到了服务端：
 *
 *   - 编排逻辑与知识库、用户数据同处一地，能直接查数据库
 *   - 多用户场景下 trace / memory 天然按用户隔离（前端是单例，天然共享）
 *   - 前端只负责渲染，不持有业务状态
 *
 * 与前端 Agent 的关系
 * ------------------
 * 前端 `agent/` 目录保留，作为**可独立运行的纯 JS 编排核心**，
 * 供浏览器端演示与单元测试使用；服务端复用同一套 planner / executor / fallback。
 *
 * 零外部依赖
 * ----------
 * 默认路径不调用任何外部 API：
 *   - 知识库检索（本地 knowledge.json）
 *   - 规则回答（本地关键词）
 * 未配置 DeepSeek 时，接口返回明确的 degraded 标记而非报错。
 */

const fs = require('fs')
const path = require('path')

const { getPrisma } = require('../db')
const { config, isServiceEnabled } = require('../config')

// 复用前端的 Agent 编排核心（纯 JS，零外部依赖）
// server/src/services/agent.js → 上溯三层到项目根
const AGENT_ROOT = path.join(__dirname, '..', '..', '..', 'agent')
const planner = require(path.join(AGENT_ROOT, 'core', 'planner'))
const executor = require(path.join(AGENT_ROOT, 'core', 'executor'))
const fallback = require(path.join(AGENT_ROOT, 'core', 'fallback'))
const ruleAdapter = require(path.join(AGENT_ROOT, 'adapters', 'rule-adapter'))
const toolsIndex = require(path.join(AGENT_ROOT, 'tools', 'index'))

// 注册服务端工具
toolsIndex.registerAll([
	require(path.join(AGENT_ROOT, 'tools', 'user-stats')),
	require(path.join(AGENT_ROOT, 'tools', 'server-time')),
	require(path.join(AGENT_ROOT, 'tools', 'echo'))
])

const KNOWLEDGE_PATH = path.join(__dirname, '..', '..', 'data', 'knowledge.json')

/**
 * 加载知识库
 * @returns {Array<{question: string, answer: string}>}
 */
let knowledgeCache = null
function loadKnowledgeBase () {
	if (knowledgeCache) return knowledgeCache
	try {
		const raw = fs.readFileSync(KNOWLEDGE_PATH, 'utf8')
		const sanitized = raw.replace(/^\s*\/\/.*$/gm, '')
		const knowledge = JSON.parse(sanitized)
		const base = Array.isArray(knowledge.knowledge_base) ? knowledge.knowledge_base : []
		knowledgeCache = base.flat(Infinity).filter(item => item && typeof item === 'object')
	} catch (e) {
		console.error('[agent] 读取知识库失败:', e.message)
		knowledgeCache = []
	}
	return knowledgeCache
}

/**
 * 知识库检索
 *
 * 匹配策略（沿用 Sprint 2 修复后的版本）：
 *   精确匹配（3） > 包含匹配（2） > 关键词命中（1）
 * 原实现用 Infinity 当哨兵，导致关键词加权路径实质失效，此处已修正。
 *
 * @param {string} question
 * @returns {string} 命中的答案，未命中返回空串
 */
function searchKnowledge (question) {
	if (!question) return ''
	const knowledgeBase = loadKnowledgeBase()
	if (!knowledgeBase.length) return ''

	const lowerQuestion = question.toLowerCase().trim()
	if (!lowerQuestion) return ''

	let bestMatch = ''
	let bestLevel = 0
	let bestScore = 0

	for (const item of knowledgeBase) {
		if (!item.question || !item.answer) continue

		const variants = item.question.split('||').map(q => q.toLowerCase().trim()).filter(Boolean)

		for (const variant of variants) {
			// 精确匹配
			if (lowerQuestion === variant) {
				bestMatch = item.answer
				bestLevel = 3
				bestScore = 0
				continue
			}
			// 包含匹配
			if (lowerQuestion.includes(variant) || variant.includes(lowerQuestion)) {
				if (bestLevel < 3) {
					bestMatch = item.answer
					bestLevel = 2
				}
				continue
			}
			// 关键词命中
			const qKeywords = [...new Set(lowerQuestion.split(/\s+|，|。|？|！|、|：|；/))].filter(k => k.length > 0)
			const kKeywords = [...new Set(variant.split(/\s+|，|。|？|！|、|：|；/))].filter(k => k.length > 0)
			if (!qKeywords.length || !kKeywords.length) continue

			let matchCount = 0
			for (const kw of kKeywords) {
				if (qKeywords.includes(kw)) matchCount++
			}
			if (matchCount > 0 && bestLevel < 2 && matchCount > bestScore) {
				bestScore = matchCount
				bestLevel = 1
				bestMatch = item.answer
			}
		}
	}

	return bestMatch
}

/**
 * 生成回答
 *
 * 优先级（Sprint 5.2 调整）：
 *   1. 知识库命中 → 直接返回（零外部依赖，最快最准）
 *   2. **Agent 编排层** → planner 识别意图 → executor 调工具
 *      （新增：处理「我是谁」「几点了」这类需要实时数据的问题）
 *   3. DeepSeek 已配置 → 调用 LLM
 *   4. 都没命中 → 返回能力清单（降级，不胡编）
 *
 * ## 为什么加第 2 步
 * ----------------
 * Sprint 5.1 之前，知识库未命中就直接降级。
 * 于是「我是谁」「几点了」「我登录了几次」全部返回兜底话术 ——
 * 因为这些问题的答案**不在知识库里，而在运行时数据里**。
 *
 * 编排层（planner + executor）正是为此设计的：
 *   user-stats  → 查当前用户（手机号/昵称/登录次数）
 *   server-time → 查服务器时间
 *
 * 注意：这不改变「零外部依赖」的性质 ——
 * 编排层与工具全部是本地 JS 与本地数据库查询。
 *
 * @param {string} question
 * @param {Object} context
 * @returns {Promise<Object>}
 */
async function answer (question, context = {}) {
	const startedAt = Date.now()

	// ① 知识库优先
	const knowledgeContent = searchKnowledge(question)
	if (knowledgeContent) {
		return {
			code: 200,
			source: 'knowledge-base',
			answer: knowledgeContent,
			durationMs: Date.now() - startedAt
		}
	}

	// ② Agent 编排层（Sprint 5.2 新增）
	//    知识库没有的、但运行时能算出来的，交给 planner + executor。
	try {
		const orchestrated = await runAgent(question, {
			user: context.user || null,
			userId: context.userId || null
		})

		if (orchestrated && orchestrated.type === 'tool-result' && orchestrated.answer) {
			return {
				code: 200,
				source: 'agent-orchestration',
				answer: orchestrated.answer,
				plan: orchestrated.plan,
				results: orchestrated.results,
				durationMs: Date.now() - startedAt
			}
		}
	} catch (e) {
		// 编排失败不影响主流程，继续往下走
		console.error('[agent] 编排层执行失败:', e.message)
	}

	// ③ LLM（可选）
	if (isServiceEnabled('deepseek')) {
		try {
			const reply = await callDeepSeek(question, context)
			return {
				code: 200,
				source: 'llm',
				answer: reply,
				durationMs: Date.now() - startedAt
			}
		} catch (e) {
			console.error('[agent] LLM 调用失败，降级:', e.message)
		}
	}

	// ④ 降级：能力清单
	const fb = fallback.reply({ reason: 'no-intent-matched' })
	return {
		code: 200,
		source: 'fallback',
		degraded: true,
		answer: fb.answer,
		capabilities: fb.capabilities,
		durationMs: Date.now() - startedAt
	}
}

/**
 * 调用 DeepSeek（仅在已配置时才会走到这里）
 */
async function callDeepSeek (question, context = {}) {
	const svc = config.services.deepseek
	const messages = []

	if (context.system) {
		messages.push({ role: 'system', content: context.system })
	}
	if (context.history && Array.isArray(context.history)) {
		messages.push(...context.history.slice(-10))
	}
	messages.push({ role: 'user', content: question })

	const response = await fetch(svc.apiUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${svc.apiKey}`
		},
		body: JSON.stringify({
			model: 'deepseek-chat',
			messages,
			stream: false,
			temperature: 0
		})
	})

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`)
	}
	const data = await response.json()
	const choice = data && data.choices && data.choices[0]
	if (!choice || !choice.message) {
		throw new Error('返回格式错误')
	}
	return choice.message.content || ''
}

/**
 * 运行一次 Agent 编排（复用前端同款 planner / executor）
 *
 * @param {string} input
 * @param {Object} context { user, userId }
 * @returns {Promise<Object>}
 */
async function runAgent (input, context = {}) {
	const startedAt = Date.now()
	const memory = context.memory || null

	// 第一阶段 + 第二阶段：规划
	const plan = planner.plan(input, { adapter: ruleAdapter })

	let execution = null
	let fb = null
	let type = 'tool-result'

	if (!plan.confident) {
		type = 'fallback'
		fb = fallback.reply({ matches: plan.matches, reason: plan.reason })
	} else {
		execution = await executor.run(plan.calls, context)
	}

	const result = {
		code: 200,
		type,
		answer: execution ? execution.answer : fb.answer,
		plan: {
			confident: plan.confident,
			reason: plan.reason || null,
			bestConfidence: plan.bestConfidence,
			matches: plan.matches,
			calls: plan.calls
		},
		results: execution ? execution.results : [],
		fallback: fb,
		durationMs: Date.now() - startedAt
	}

	if (memory && typeof memory.push === 'function') {
		try {
			memory.push(input, result.answer)
		} catch (e) {
			// 记忆写入失败不影响主流程
		}
	}

	return result
}

/**
 * 保存聊天记录（每用户保留最近一条，与原实现一致）
 */
async function saveChatHistory (userId, question, answerText) {
	if (!userId) return
	try {
		const prisma = getPrisma()
		await prisma.chatHistory.upsert({
			where: { userId },
			update: { lastQuestion: question, lastAnswer: answerText },
			create: { userId, lastQuestion: question, lastAnswer: answerText }
		})
	} catch (e) {
		console.error('[agent] 保存聊天记录失败:', e.message)
	}
}

/**
 * 读取聊天记录
 */
async function getChatHistory (userId) {
	if (!userId) return null
	try {
		const prisma = getPrisma()
		return await prisma.chatHistory.findUnique({ where: { userId } })
	} catch (e) {
		console.error('[agent] 读取聊天记录失败:', e.message)
		return null
	}
}

module.exports = {
	loadKnowledgeBase,
	searchKnowledge,
	answer,
	runAgent,
	saveChatHistory,
	getChatHistory
}

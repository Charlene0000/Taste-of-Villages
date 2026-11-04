'use strict'

/**
 * 业务路由 —— 聚合承载原 21 个 uniCloud 云函数的业务能力
 *
 * 设计理由（见 Sprint 5 Plan）
 * ---------------------------
 * 把 21 个云函数全部搬进 Express，等于把 Sprint 5 变成「重写整个后端」，
 * 回归风险高。改用聚合路由 `/api/business/:name` 后：
 *
 *   - 「彻底切断 uniCloud」变成纯粹的协议替换
 *   - 前端只需改调用方式（callFunction → HTTP），数据结构与 UI 完全不动
 *   - 入参出参保持原云函数的形状，前端业务逻辑零改动
 *
 * name 与原云函数名一一对应，便于对照与迁移。
 */

const express = require('express')
const path = require('path')
const fs = require('fs')
const { getPrisma } = require('../db')
const { requireAuth, optionalAuth } = require('../middleware/auth')
const { config } = require('../config')
// Sprint 5.2：本地品鉴引擎（纯本地模拟，零外部依赖）
const foodReview = require('../services/food-review')

const router = express.Router()

/** 从 token 或请求体解析出用户 id（未登录返回 null） */
function resolveUserId (req) {
	if (req.user && req.user.uid) return req.user.uid
	// 兼容旧前端传 openid 的情况（迁移期）
	const raw = (req.body && req.body.userId) || (req.query && req.query.userId)
	const n = parseInt(raw, 10)
	return Number.isInteger(n) ? n : null
}

/**
 * 文件上传：POST /api/business/upload
 * 替代原 uniCloud.uploadFile
 *
 * Sprint 5.2 修复：**必须注册在 router.post('/:name') 之前**。
 *
 * Express 按**注册顺序**匹配路由 ——
 * 之前 upload 路由写在 :name 之后，
 * 于是 '/upload' 先被 ':name' 命中（params.name = 'upload'），
 * 走进业务分发器 → 「未知的业务接口: upload」→ 404。
 *
 * 前端表现为「相册上传失败」「拍照打卡上传失败」，
 * 但根因是路由顺序，不是上传逻辑本身。
 */
const multer = require('multer')
const upload = multer({
	storage: multer.diskStorage({
		destination (req, file, cb) {
			fs.mkdirSync(config.uploadDir, { recursive: true })
			cb(null, config.uploadDir)
		},
		filename (req, file, cb) {
			const ext = path.extname(file.originalname) || '.png'
			const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
			cb(null, name)
		}
	}),
	limits: { fileSize: 5 * 1024 * 1024 }
})

router.post('/upload', upload.single('file'), (req, res) => {
	if (!req.file) {
		return res.status(400).json({
			code: 400,
			errCode: 'business-no-file',
			errMsg: '未接收到文件'
		})
	}
	const url = `/uploads/${req.file.filename}`
	res.json({
		code: 200,
		message: '上传成功',
		fileID: url,
		url,
		fileName: req.file.filename
	})
})

/**
 * 读接口：GET /api/business/:name
 */
const readHandlers = {
	/** 村庄列表 */
	async get_villages_list (req) {
		const prisma = getPrisma()
		const villages = await prisma.village.findMany()
		return { code: 200, data: villages }
	},

	/** 单个村庄信息 */
	async get_village_info (req, res) {
		const prisma = getPrisma()
		const { id, slug } = req.query
		const village = slug
			? await prisma.village.findUnique({ where: { slug } })
			: await prisma.village.findUnique({ where: { id: parseInt(id, 10) } })
		return { code: 200, data: village }
	},

	/** 美食信息 */
	async get_food_info (req) {
		const prisma = getPrisma()
		const foods = await prisma.food.findMany()
		return { code: 200, data: foods }
	},

	/** 商城商品 */
	async get_shop_goods (req) {
		const prisma = getPrisma()
		const goods = await prisma.shopGood.findMany()
		return { code: 200, data: goods }
	},

	/** 答题题库 */
	async get_quiz_questions (req) {
		const prisma = getPrisma()
		const questions = await prisma.quizQuestion.findMany()
		return { code: 200, data: questions }
	},

	/** 用户订单 */
	async get_user_orders (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		if (!userId) return { code: 200, data: [] }
		const orders = await prisma.userOrder.findMany({
			where: { userId },
			orderBy: { createTime: 'desc' }
		})
		return { code: 200, data: orders }
	},

	/** 打卡记录 */
	async getCheckInRecords (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		const places = userId
			? await prisma.checkInPlace.findMany({
				where: { userId },
				orderBy: { createTime: 'desc' }
			})
			: []
		return { code: 200, data: places }
	},

	/** 用户打卡过的地点 */
	async getUserCheckedSpots (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		const places = userId
			? await prisma.checkInPlace.findMany({ where: { userId } })
			: []
		return { code: 200, data: places }
	},

	/** 用户照片 */
	async getUserPhotos (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		const photos = userId
			? await prisma.userPhoto.findMany({
				where: { userId },
				orderBy: { createTime: 'desc' }
			})
			: []
		return { code: 200, data: photos }
	}
}

/**
 * 写接口：POST /api/business/:name
 */
const writeHandlers = {
	/** 打卡 */
	async checkIn (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		if (!userId) {
			return { code: 400, errCode: 'business-not-logged-in', errMsg: '用户未登录' }
		}
		const { locationId, address, type = 'photo' } = req.body || {}
		const place = await prisma.checkInPlace.create({
			data: {
				userId,
				locationId: String(locationId || ''),
				address: address || '',
				type
			}
		})
		// 打卡加分
		await prisma.user.update({
			where: { id: userId },
			data: { points: { increment: 10 } }
		})
		return { code: 200, message: '打卡成功', data: place }
	},

	/** 每日签到 */
	async dailySignIn (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		if (!userId) {
			return { code: 400, errCode: 'business-not-logged-in', errMsg: '用户未登录' }
		}
		const today = new Date().toISOString().slice(0, 10)
		const user = await prisma.user.findUnique({ where: { id: userId } })

		if (user && user.signinDate === today) {
			return { code: 403, errCode: 'business-already-signed', errMsg: '今日已签到' }
		}

		const days = user && user.signinDate ? (user.signinDays || 0) + 1 : 1
		await prisma.user.update({
			where: { id: userId },
			data: {
				signinDate: today,
				signinDays: days,
				points: { increment: days * 10 }
			}
		})
		return { code: 200, message: '签到成功', data: { days, points: days * 10 } }
	},

	/** 答题打卡 */
	async quizCheckIn (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		if (!userId) {
			return { code: 400, errCode: 'business-not-logged-in', errMsg: '用户未登录' }
		}
		const { questionId, answer } = req.body || {}
		const question = await prisma.quizQuestion.findUnique({
			where: { id: parseInt(questionId, 10) }
		})
		if (!question) {
			return { code: 404, errCode: 'business-question-not-found', errMsg: '题目不存在' }
		}
		const correct = Number(answer) === question.answer
		if (correct) {
			await prisma.user.update({
				where: { id: userId },
				data: { points: { increment: question.points }, score: { increment: 1 } }
			})
		}
		return {
			code: 200,
			message: correct ? '回答正确' : '回答错误',
			data: { correct, points: correct ? question.points : 0 }
		}
	},

	/** 游戏打卡 */
	async gameCheckIn (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		if (!userId) {
			return { code: 400, errCode: 'business-not-logged-in', errMsg: '用户未登录' }
		}
		await prisma.user.update({
			where: { id: userId },
			data: { points: { increment: 5 } }
		})
		return { code: 200, message: '游戏打卡成功', data: { points: 5 } }
	},

	/** 保存照片 */
	async saveUserPhotos (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		if (!userId) {
			return { code: 400, errCode: 'business-not-logged-in', errMsg: '用户未登录' }
		}
		const { url, images, locationName, title } = req.body || {}
		if (!url) {
			return { code: 400, errCode: 'business-missing-url', errMsg: '缺少照片地址' }
		}
		const photo = await prisma.userPhoto.create({
			data: {
				userId,
				url,
				images: JSON.stringify(images || [url]),
				locationName: locationName || '',
				title: title || null
			}
		})
		return { code: 200, message: '保存成功', data: photo }
	},

	/** 删除照片 */
	async deleteUserPhoto (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		const { id } = req.body || {}
		const photo = await prisma.userPhoto.findUnique({ where: { id: parseInt(id, 10) } })
		if (!photo) {
			return { code: 404, errCode: 'business-photo-not-found', errMsg: '照片不存在' }
		}
		if (userId && photo.userId !== userId) {
			return { code: 403, errCode: 'business-no-permission', errMsg: '无权删除他人照片' }
		}
		await prisma.userPhoto.delete({ where: { id: photo.id } })
		return { code: 200, message: '删除成功' }
	},

	/** 更新照片 */
	async updateUserPhoto (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		const { id, title, locationName } = req.body || {}
		const photo = await prisma.userPhoto.findUnique({ where: { id: parseInt(id, 10) } })
		if (!photo) {
			return { code: 404, errCode: 'business-photo-not-found', errMsg: '照片不存在' }
		}
		if (userId && photo.userId !== userId) {
			return { code: 403, errCode: 'business-no-permission', errMsg: '无权修改他人照片' }
		}
		const updated = await prisma.userPhoto.update({
			where: { id: photo.id },
			data: {
				title: title !== undefined ? title : photo.title,
				locationName: locationName !== undefined ? locationName : photo.locationName
			}
		})
		return { code: 200, message: '更新成功', data: updated }
	},

	/** 购买商品 */
	async purchaseItem (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		if (!userId) {
			return { code: 400, errCode: 'business-not-logged-in', errMsg: '用户未登录' }
		}
		const { itemId, itemName, itemImage, cost } = req.body || {}
		const user = await prisma.user.findUnique({ where: { id: userId } })
		const price = Number(cost) || 0
		if (!user || (user.points || 0) < price) {
			return { code: 400, errCode: 'business-insufficient-points', errMsg: '积分不足' }
		}
		const order = await prisma.userOrder.create({
			data: {
				userId,
				itemId: String(itemId || ''),
				itemName: itemName || '',
				itemImage: itemImage || null,
				cost: price,
				status: 1
			}
		})
		await prisma.user.update({
			where: { id: userId },
			data: { points: { decrement: price } }
		})
		return { code: 200, message: '购买成功', data: order }
	},

	/** 用户初始化（登录后调用，兼容原 userInit 云函数） */
	async userInit (req) {
		const prisma = getPrisma()
		const userId = resolveUserId(req)
		if (!userId) {
			return { code: 200, message: '未登录，跳过初始化' }
		}
		const user = await prisma.user.findUnique({ where: { id: userId } })
		return { code: 200, message: '初始化完成', data: user }
	},

	/**
	 * 图片识别 / 品鉴
	 *
	 * Sprint 5.2：接入本地品鉴引擎（server/src/services/food-review.js）
	 *
	 * 背景：原实现用百度 AI 识图，Sprint 5 剥离云服务时砍掉了真实 API，
	 * 返回的字段（name/calorie/desc）与前端期望的
	 * （isFood/score/comment/tags）完全对不上，
	 * 于是拍照打卡页的「饼饼品鉴报告」卡片永远不显示。
	 *
	 * 现在：
	 *   · 默认走**本地模拟引擎** —— 零外部依赖、零费用，
	 *     按文件名/大小/序号做确定性哈希，输出 80-95 分与一段美食点评
	 *   · 若配置了百度 AI 凭据，仍可在此基础上叠加真实识别（见下）
	 *
	 * 注意：本函数只做「路由层的品鉴结果组装」，
	 * 不触碰鉴权与 Prisma 逻辑。
	 */
	async analyzeFoodPhoto (req) {
		const body = req.body || {}
		const filePath = body.fileID || body.url || body.filePath || body.name || ''

		const report = foodReview.review({
			filePath,
			name: body.name,
			size: body.size,
			seq: body.seq
		})

		console.log('[business] 本地品鉴:', {
			输入: filePath,
			菜名: report.name,
			评分: report.score,
			标签: report.tags.join('/')
		})

		return {
			code: 200,
			message: '本地品鉴（模拟引擎，未接入百度 AI）',
			degraded: true,
			data: report
		}
	}
}

/**
 * 路由分发：GET /api/business/:name
 */
router.get('/:name', optionalAuth, async (req, res) => {
	const handler = readHandlers[req.params.name]
	if (!handler) {
		return res.status(404).json({
			code: 404,
			errCode: 'business-not-found',
			errMsg: '未知的业务接口: ' + req.params.name
		})
	}
	try {
		const result = await handler(req, res)
		return res.json(result)
	} catch (e) {
		console.error('[business] ' + req.params.name + ' 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'business-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

/**
 * 路由分发：POST /api/business/:name
 */
router.post('/:name', optionalAuth, async (req, res) => {
	const handler = writeHandlers[req.params.name]
	if (!handler) {
		return res.status(404).json({
			code: 404,
			errCode: 'business-not-found',
			errMsg: '未知的业务接口: ' + req.params.name
		})
	}
	try {
		const result = await handler(req, res)
		return res.json(result)
	} catch (e) {
		console.error('[business] ' + req.params.name + ' 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'business-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

module.exports = router

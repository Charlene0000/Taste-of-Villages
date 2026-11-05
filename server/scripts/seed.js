'use strict'

/**
 * 种子数据导入脚本
 *
 * ## 为什么需要它
 * -------------
 * Sprint 5 用 Prisma 重建了数据库，但**没有把原 uniCloud 的种子数据迁移过来**。
 * 后果：`npx prisma db push` 之后所有业务表都是空的 ——
 * 商城无商品、题库无题目、美食详情无内容、探索页无村庄列表。
 * 全新 clone 的使用者会看到一整片空白，且不知道问题在哪。
 *
 * ## 数据来源
 * ---------
 * `server/data/seed.json` —— 由本仓库的原始 uniCloud 种子数据整理而来
 * （init_food_data / shop_goods / quiz_questions 三个集合），
 * 脱敏后入库，不含任何真实用户数据。
 *
 * ## 用法
 * -----
 *   cd server
 *   node scripts/seed.js          # 幂等：先清空再插入，可重复执行
 *   node scripts/seed.js --check  # 只校验 seed.json 格式，不写库
 */

const fs = require('fs')
const path = require('path')

const { getPrisma } = require('../src/db')
const cache = require('../src/utils/cache')

const SEED_PATH = path.join(__dirname, '..', 'data', 'seed.json')

/**
 * 校验 seed.json 结构
 */
function validateSeed (seed) {
	const errors = []
	if (!seed || typeof seed !== 'object') {
		errors.push('seed.json 根节点必须是对象')
		return errors
	}
	if (!Array.isArray(seed.villages)) errors.push('缺少 villages 数组')
	if (!Array.isArray(seed.foods)) errors.push('缺少 foods 数组')
	if (!Array.isArray(seed.shopGoods)) errors.push('缺少 shopGoods 数组')
	if (!Array.isArray(seed.quizQuestions)) errors.push('缺少 quizQuestions 数组')

	;(seed.villages || []).forEach((v, i) => {
		if (!v.slug) errors.push(`villages[${i}] 缺少 slug`)
		if (!v.name) errors.push(`villages[${i}] 缺少 name`)
	})
	;(seed.foods || []).forEach((f, i) => {
		if (!f.slug) errors.push(`foods[${i}] 缺少 slug`)
		if (!f.name) errors.push(`foods[${i}] 缺少 name`)
	})
	;(seed.shopGoods || []).forEach((g, i) => {
		if (!g.name) errors.push(`shopGoods[${i}] 缺少 name`)
	})
	;(seed.quizQuestions || []).forEach((q, i) => {
		if (!q.title) errors.push(`quizQuestions[${i}] 缺少 title`)
		if (!Array.isArray(q.options)) errors.push(`quizQuestions[${i}] 缺少 options 数组`)
		if (typeof q.answerIndex !== 'number') errors.push(`quizQuestions[${i}] 缺少 answerIndex`)
	})

	return errors
}

/**
 * 写入种子数据（幂等）
 */
async function seed () {
	const raw = fs.readFileSync(SEED_PATH, 'utf8')
	let seedData
	try {
		seedData = JSON.parse(raw)
	} catch (e) {
		console.error('❌ seed.json 解析失败:', e.message)
		process.exitCode = 1
		return
	}

	const errors = validateSeed(seedData)
	if (errors.length) {
		console.error('❌ seed.json 校验未通过:')
		errors.forEach(e => console.error('   - ' + e))
		process.exitCode = 1
		return
	}

	const prisma = getPrisma()

	// 幂等：先清空业务表（不动 users / verify_codes）
	await prisma.checkInPlace.deleteMany({})
	await prisma.userPhoto.deleteMany({})
	await prisma.userOrder.deleteMany({})
	await prisma.chatHistory.deleteMany({})
	await prisma.quizQuestion.deleteMany({})
	await prisma.shopGood.deleteMany({})
	await prisma.food.deleteMany({})
	await prisma.village.deleteMany({})

	// 村庄
	for (const v of seedData.villages) {
		await prisma.village.create({
			data: {
				name: v.name,
				slug: v.slug,
				latitude: v.latitude != null ? v.latitude : null,
				longitude: v.longitude != null ? v.longitude : null,
				intro: v.intro || '',
				image: v.image || ''
			}
		})
	}

	// 美食
	for (const f of seedData.foods) {
		await prisma.food.create({
			data: {
				name: f.name,
				village: f.village || '',
				image: f.image || '',
				desc: f.desc || '',
				recipe: f.recipe || ''
			}
		})
	}

	// 商城商品
	for (const g of seedData.shopGoods) {
		await prisma.shopGood.create({
			data: {
				name: g.name,
				image: g.image || '',
				cost: Number(g.cost) || 0,
				desc: g.desc || '',
				stock: Number(g.stock) || 0
			}
		})
	}

	// 题库
	for (const q of seedData.quizQuestions) {
		await prisma.quizQuestion.create({
			data: {
				question: q.title,
				options: JSON.stringify(q.options || []),
				answer: Number(q.answerIndex) || 0,
				points: Number(q.points) || 10
			}
		})
	}

	const counts = {
		村庄: await prisma.village.count(),
		美食: await prisma.food.count(),
		商品: await prisma.shopGood.count(),
		题目: await prisma.quizQuestion.count()
	}

	// 失效静态数据缓存 —— 种子数据变更后，运行中的实例必须能读到新数据
	//
	// 注意：seed 脚本是**独立进程**，与运行中的 server 不共享内存缓存，
	// 因此这里的失效只对「同进程内复用」的场景生效。
	// 运行中实例的缓存由 TTL（5 分钟）兜底自动过期，最终一致。
	cache.invalidate('village', 'food', 'shop', 'quiz')

	console.log('✅ 种子数据导入完成:')
	console.log(`   村庄 ${counts.村庄} 条 · 美食 ${counts.美食} 条 · 商品 ${counts.商品} 条 · 题目 ${counts.题目} 条`)

	await prisma.$disconnect()
}

async function check () {
	const raw = fs.readFileSync(SEED_PATH, 'utf8')
	let seedData
	try {
		seedData = JSON.parse(raw)
	} catch (e) {
		console.error('❌ seed.json 解析失败:', e.message)
		process.exitCode = 1
		return
	}
	const errors = validateSeed(seedData)
	if (errors.length) {
		console.error('❌ seed.json 校验未通过:')
		errors.forEach(e => console.error('   - ' + e))
		process.exitCode = 1
		return
	}
	console.log('✅ seed.json 校验通过:')
	console.log(`   村庄 ${seedData.villages.length} · 美食 ${seedData.foods.length} · ` +
		`商品 ${seedData.shopGoods.length} · 题目 ${seedData.quizQuestions.length}`)
}

const isCheck = process.argv.includes('--check')
const task = isCheck ? check() : seed()

task.catch(e => {
	console.error('❌ 执行失败:', e)
	process.exitCode = 1
})

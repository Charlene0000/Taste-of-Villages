/**
 * 数据归一化层单元测试（Sprint 5.1）
 *
 * 零依赖测试运行器，与 agent/tests、digital-avatar/tests 风格一致。
 *
 * 覆盖场景：
 *   1. 打卡记录 → 聚合出带 name/progress 的数组（对齐原云函数）
 *   2. 题库 → 补齐 title/options/answerIndex/_id
 *   3. 商品 → 补齐 _id/img_url/description
 *   4. 村庄 → _id 用业务 ID（101-105），不是数据库自增主键
 *   5. 照片 → images 字符串解析回数组
 *   6. 用户 → 补 _id 别名
 *   7. 边界：空数组 / null / 缺字段
 */

const assert = require('assert')
const N = require('../../utils/normalizer.js')

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

// ---------- 场景 1：打卡记录聚合 ----------

global.describe('normalizeCheckInRecords', () => {
	test('空数组返回 5 个村庄的零进度记录', () => {
		const out = N.normalizeCheckInRecords([])
		assert.strictEqual(out.length, 5)
		out.forEach(v => {
			assert.strictEqual(v.progress, 0)
			assert.ok(v.name, '村庄应有名字')
			assert.strictEqual(v.slug.length > 0, true)
		})
	})

	test('location 类型记录 → 该村庄 location=true, progress=25', () => {
		const out = N.normalizeCheckInRecords([
			{ id: 1, userId: 1, locationId: '101', type: 'location' }
		])
		const v = out.find(x => x.slug === 'shaqima')
		assert.ok(v, '应包含遮浪玛仔')
		assert.strictEqual(v.status.location, true)
		assert.strictEqual(v.status.photo, false)
		assert.strictEqual(v.progress, 25)
	})

	test('photo + make 记录 → progress=50', () => {
		const out = N.normalizeCheckInRecords([
			{ locationId: '102', type: 'photo' },
			{ locationId: '102', type: 'cook' }
		])
		const v = out.find(x => x.slug === 'caibaoguo')
		assert.strictEqual(v.status.photo, true)
		assert.strictEqual(v.status.make, true)
		assert.strictEqual(v.progress, 50)
	})

	test('无 type 的旧记录按 location 处理（原云函数口径）', () => {
		const out = N.normalizeCheckInRecords([{ locationId: '103' }])
		const v = out.find(x => x.slug === 'taohuaguo')
		assert.strictEqual(v.status.location, true)
	})

	test('locationId 为数字时也能匹配字符串配置', () => {
		const out = N.normalizeCheckInRecords([{ locationId: 104, type: 'photo' }])
		const v = out.find(x => x.slug === 'chenzhouhao')
		assert.strictEqual(v.status.photo, true)
	})

	test('quizDone 参数可标记答题维度', () => {
		const out = N.normalizeCheckInRecords(
			[{ locationId: '105', type: 'location' }],
			{ quizDone: { '105': true } }
		)
		const v = out.find(x => x.slug === 'paiguxianfan')
		assert.strictEqual(v.status.quiz, true)
		assert.strictEqual(v.progress, 50)
	})

	test('null 输入不崩溃', () => {
		const out = N.normalizeCheckInRecords(null)
		assert.strictEqual(out.length, 5)
	})
})

// ---------- 场景 2：题库 ----------

global.describe('normalizeQuizQuestions', () => {
	test('Prisma 行 → 原集合形状', () => {
		const out = N.normalizeQuizQuestions([
			{ id: 7, question: '遮浪玛仔是什么？', options: '["蚝","粿","饭"]', answer: 0, points: 10 }
		])
		assert.strictEqual(out.length, 1)
		assert.strictEqual(out[0].title, '遮浪玛仔是什么？')
		assert.strictEqual(out[0].answerIndex, 0)
		assert.deepStrictEqual(out[0].options, ['蚝', '粿', '饭'])
		assert.strictEqual(out[0]._id, 7)
	})

	test('options 已是数组时原样保留', () => {
		const out = N.normalizeQuizQuestions([
			{ id: 1, question: 'Q', options: ['a', 'b'], answer: 1 }
		])
		assert.deepStrictEqual(out[0].options, ['a', 'b'])
	})

	test('options 是非法 JSON 时降级为空数组', () => {
		const out = N.normalizeQuizQuestions([
			{ id: 1, question: 'Q', options: 'not-json', answer: 0 }
		])
		assert.deepStrictEqual(out[0].options, [])
	})

	test('缺 question 时 title 为空串而非 undefined', () => {
		const out = N.normalizeQuizQuestions([{ id: 1 }])
		assert.strictEqual(out[0].title, '')
		assert.strictEqual(out[0].question, '')
	})
})

// ---------- 场景 3：商城商品 ----------

global.describe('normalizeShopGoods', () => {
	test('Prisma 行 → 原 shop_goods 形状', () => {
		const out = N.normalizeShopGoods([
			{ id: 3, name: '特产沙琪玛', image: '/static/shaqima.png', cost: 500, desc: '限量', stock: 10 }
		])
		assert.strictEqual(out[0]._id, 3)
		assert.strictEqual(out[0].img_url, '/static/shaqima.png')
		assert.strictEqual(out[0].description, '限量')
		assert.strictEqual(out[0].cost, 500)
	})

	test('cost 为字符串时归零', () => {
		const out = N.normalizeShopGoods([{ id: 1, name: 'x', cost: 'abc' }])
		assert.strictEqual(out[0].cost, 0)
	})
})

// ---------- 场景 4：村庄业务 ID ----------

global.describe('normalizeVillages', () => {
	test('_id 映射为业务 ID（101-105），而非数据库主键', () => {
		const out = N.normalizeVillages([
			{ id: 1, name: '遮浪玛仔', slug: 'shaqima' },
			{ id: 2, name: '石寨菜包粿', slug: 'caibaoguo' }
		])
		assert.strictEqual(out[0]._id, '101')
		assert.strictEqual(out[1]._id, '102')
		assert.strictEqual(out[0].dbId, 1, '数据库主键应保留在 dbId')
	})

	test('未知 slug 回退到数据库主键', () => {
		const out = N.normalizeVillages([{ id: 9, name: '未知村', slug: 'unknown' }])
		assert.strictEqual(out[0]._id, '9')
	})

	test('业务 ID 与打卡记录能对上', () => {
		// 这是勋章页进度能正确显示的关键：
		// 页面拿到的 locationId 必须是 '101' 这类业务 ID
		const out = N.normalizeVillages([{ id: 1, name: '遮浪玛仔', slug: 'shaqima' }])
		const records = N.normalizeCheckInRecords([
			{ locationId: out[0]._id, type: 'location' }
		])
		const v = records.find(x => x.slug === 'shaqima')
		assert.strictEqual(v.progress, 25)
	})
})

// ---------- 场景 5：照片 ----------

global.describe('normalizeUserPhotos', () => {
	test('images JSON 字符串解析回数组', () => {
		const out = N.normalizeUserPhotos([
			{ id: 1, url: '/uploads/a.png', images: '["/uploads/a.png","/uploads/b.png"]' }
		])
		assert.strictEqual(out[0]._id, 1)
		assert.deepStrictEqual(out[0].images, ['/uploads/a.png', '/uploads/b.png'])
	})

	test('images 缺失时用 url 兜底', () => {
		const out = N.normalizeUserPhotos([{ id: 1, url: '/uploads/a.png' }])
		assert.deepStrictEqual(out[0].images, ['/uploads/a.png'])
	})

	test('images 是非法 JSON 时也用 url 兜底', () => {
		const out = N.normalizeUserPhotos([{ id: 1, url: '/uploads/a.png', images: 'xxx' }])
		assert.deepStrictEqual(out[0].images, ['/uploads/a.png'])
	})
})

// ---------- 场景 6：订单 ----------

global.describe('normalizeOrders', () => {
	test('Prisma 行 → 原 user_orders 形状', () => {
		const out = N.normalizeOrders([
			{ id: 5, itemId: '2', itemName: '贴纸', cost: 80, status: 1, createTime: '2026-01-01' }
		])
		assert.strictEqual(out[0]._id, 5)
		assert.strictEqual(out[0].itemName, '贴纸')
		assert.strictEqual(out[0].cost, 80)
	})
})

// ---------- 场景 7：用户 _id 别名 ----------

global.describe('withLegacyId', () => {
	test('补上 _id 别名', () => {
		const u = N.withLegacyId({ id: 3, nickname: 'CharLene' })
		assert.strictEqual(u._id, 3)
		assert.strictEqual(u.id, 3)
	})

	test('已有 _id 时不覆盖', () => {
		const u = N.withLegacyId({ id: 3, _id: 'abc' })
		assert.strictEqual(u._id, 'abc')
	})

	test('null / 非对象原样返回', () => {
		assert.strictEqual(N.withLegacyId(null), null)
		assert.strictEqual(N.withLegacyId(undefined), undefined)
	})
})

// ---------- 运行 ----------

let passed = 0
const failures = []

suites.forEach(suite => {
	console.log('\n' + suite.name)
	suite.tests.forEach(t => {
		try {
			t.fn()
			passed++
			console.log('  ✓ ' + t.name)
		} catch (e) {
			failures.push({ suite: suite.name, name: t.name, error: e.message })
			console.log('  ✗ ' + t.name + ' — ' + e.message)
		}
	})
})

console.log('\n' + '='.repeat(62))
console.log(`结果: ${passed}/${passed + failures.length} 通过`)
if (failures.length) {
	console.log('\n失败项:')
	failures.forEach(f => console.log(`  ❌ [${f.suite}] ${f.name}\n     ${f.error}`))
	process.exitCode = 1
} else {
	console.log('全部通过 ✅')
}

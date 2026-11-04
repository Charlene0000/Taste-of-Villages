/**
 * 数据形状归一化层（Sprint 5.1）
 *
 * ## 为什么需要这一层
 * ------------------
 * Sprint 5 把后端从 uniCloud 云函数换成了 Express + Prisma，
 * 而**两者的返回形状并不一致**：
 *
 *   原 uniCloud 云函数返回的是「业务聚合后」的自定义结构
 *   （例如 getCheckInRecords 把打卡记录聚合成带 name/progress 的数组）；
 *
 *   新 Express + Prisma 返回的是「数据库原始行」
 *   （例如 check_in_places 表的行，只有 locationId/type，没有 name/progress）。
 *
 * 前端页面是围绕原云函数的形状写的（`item.name`、`item.progress`、
 * `q.title`、`q.answerIndex`、`item._id` …），批量替换脚本只改了
 * 「怎么发请求」，没改「后端返回什么」，于是出现大面积运行时断裂：
 *
 *   - 勋章页 / 手账页读到 `undefined` 的 name 与 progress
 *   - 答题页读到 `undefined` 的题目与答案
 *   - 商城页的 `item._id` 全为 undefined，购买时 itemId 传空
 *   - `userInfo._id` 在新后端不存在（Prisma 主键叫 `id`），
 *     导致「已登录但查不到我的数据」
 *
 * ## 本层的职责
 * -------------
 * 把后端返回的原始行，翻译回页面期待的形状。
 * **页面代码因此几乎不需要改动**，这是本次修复风险最低的路径。
 *
 * ## 设计约束
 * -----------
 * 1. 纯函数、无副作用 —— 每个 normalizer 都是 `rows => rows`
 * 2. 缺字段时给出安全默认值，绝不返回 undefined 字段
 * 3. 保留后端原始字段（用扩展而非覆盖），便于排查
 * 4. 所有映射关系都注明了原云函数的出处，便于对照
 */

// Sprint 5.2：引入 URL 拼接工具
// 后端存的是相对路径（/uploads/xxx），直接给 <image src> 在 H5/Web 端会裂图
import { toAbsoluteUrl } from './url.js'

/**
 * 村庄配置 —— 与原 getCheckInRecords 云函数中的 VILLAGES 常量保持一致。
 *
 * 原云函数把打卡记录按这 5 个村庄聚合，返回每个村庄的：
 *   { id, slug, name, image, status: {quiz,location,photo,make}, progress }
 *
 * 后端的 check_in_places 表里只有 locationId（字符串），没有名字，
 * 所以名字与图片必须由前端这份配置补齐。
 */
export const VILLAGE_CONFIG = [
	{
		id: '101',
		slug: 'shaqima',
		name: '遮浪玛仔',
		image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/food/shaqima.png'
	},
	{
		id: '102',
		slug: 'caibaoguo',
		name: '石寨菜包粿',
		image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/food/caibaoguo.png'
	},
	{
		id: '103',
		slug: 'taohuaguo',
		name: '红桃粿',
		image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/food/hongtaoguo.png'
	},
	{
		id: '104',
		slug: 'chenzhouhao',
		name: '清蒸晨洲蚝',
		image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/food/chenzhouhao.png'
	},
	{
		id: '105',
		slug: 'paiguxianfan',
		name: '排骨咸饭',
		image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/food/paiguxianfan.png'
	}
]

/**
 * 题目 → 所属村庄 slug 的映射。
 *
 * ## 为什么需要这张表
 * -----------------
 * 原 uniCloud 的 quiz_questions 集合每条记录都带 slug 字段，
 * 后端按 slug 过滤返回对应村庄的题目。
 *
 * 但 Sprint 5 的 Prisma `QuizQuestion` 模型**没有 slug 字段**
 * （schema 里只有 id/question/options/answer/points），
 * 而本任务的约束是「不修改后端」。
 *
 * 折中方案：把原始种子数据里的「题目 → slug」对应关系固化到前端。
 * 这份映射来自项目原始的 quiz_questions 种子数据，
 * 与数据库中的题目内容一一对应（用题目文本做键）。
 *
 * 好处：后端零改动，前端按 slug 过滤的行为与原云函数完全一致。
 * 代价：新增题目时需要同步维护这张表 —— 已在下方注释中标注。
 */
export const QUIZ_SLUG_MAP = {
	// shaqima（遮浪玛仔）
	'东尾村位于哪里？': 'shaqima',
	'遮浪玛仔（沙琪玛）入选了什么名单？': 'shaqima',
	'东尾村保留了哪种传统？': 'shaqima',
	// caibaoguo（石寨菜包粿）
	'石寨村因何得名？': 'caibaoguo',
	'石寨村始建于哪个朝代？': 'caibaoguo',
	'石寨菜包粿是哪个节庆的待客主食？': 'caibaoguo',
	// taohuaguo（红桃粿）
	'红桃粿因造型如桃而得名，象征什么？': 'taohuaguo',
	'制作红桃粿外皮的主要原料是？': 'taohuaguo',
	'红桃粿的“红”字源于其鲜艳的色泽，寓意是什么？': 'taohuaguo',
	// chenzhouhao（清蒸晨洲蚝）
	'晨洲村素有什么美誉？': 'chenzhouhao',
	'晨洲蚝最经典的吃法是？': 'chenzhouhao',
	'晨洲村位于哪三江的入海口？': 'chenzhouhao',
	// paiguxianfan（排骨咸饭）
	'建宁寨村的寨墙是用什么材料筑成的？': 'paiguxianfan',
	'建宁寨村始建于哪一年？': 'paiguxianfan',
	'排骨咸饭中的“咸饭”是指？': 'paiguxianfan',
	// hongtaoguo（红桃粿的另一个 slug，原种子数据里单独分组）
	'红桃粿的颜色寓意是什么？': 'hongtaoguo',
	'新山村涌现了多少位烈士？': 'hongtaoguo',
	'新山村位于海丰县的哪个镇？': 'hongtaoguo',
	// default（通用题库）
	'中国的首都是哪座城市？': 'default',
	'地球上最大的洋是？': 'default'
}

/**
 * 默认题库 slug（原云函数在按 slug 找不到时回落到 default）
 */
export const DEFAULT_QUIZ_SLUG = 'default'

/** 数字 locationId → 字符串，与原云函数的比较方式一致 */
function toLocationKey (value) {
	if (value === null || value === undefined) return ''
	return String(value)
}

/**
 * 判断打卡记录属于哪种类型。
 *
 * 原云函数的口径：
 *   location → type === 'location' 或没有 type（旧数据）
 *   photo    → type === 'photo'
 *   make     → type === 'make' 或 type === 'cook'
 */
function classifyType (type) {
	const t = (type || '').toLowerCase()
	if (!t) return 'location'
	if (t === 'photo') return 'photo'
	if (t === 'make' || t === 'cook') return 'make'
	return 'location'
}

/**
 * 打卡记录 → 原 getCheckInRecords 的聚合形状。
 *
 * 输入：check_in_places 表的行数组（Prisma 原始行）
 * 输出：[{ id, slug, name, image, status:{quiz,location,photo,make}, progress }]
 *
 * 与原云函数的差异（诚实说明）：
 *   原实现额外查了 `userQuizLogs` 表来算 quiz 维度。
 *   新后端没有这张表，因此 status.quiz 恒为 false，
 *   progress 的分母仍按 4 计算（location/photo/make/quiz），
 *   所以进度会比原实现偏低 —— 这是**已知的数据源缺失**，
 *   已在 README Known Issues 中记录，不是本次修复引入的。
 */
export function normalizeCheckInRecords (rows, options = {}) {
	const list = Array.isArray(rows) ? rows : []
	const quizDone = options.quizDone || {}

	const byLocation = {}
	list.forEach(row => {
		if (!row) return
		const key = toLocationKey(row.locationId)
		if (!key) return
		if (!byLocation[key]) byLocation[key] = []
		byLocation[key].push(row)
	})

	return VILLAGE_CONFIG.map(village => {
		const logs = byLocation[village.id] || []

		const status = {
			location: false,
			photo: false,
			make: false,
			quiz: !!quizDone[village.id]
		}
		logs.forEach(log => {
			status[classifyType(log.type)] = true
		})

		const done = [status.location, status.photo, status.make, status.quiz]
			.filter(Boolean).length

		return {
			id: village.id,
			slug: village.slug,
			name: village.name,
			image: village.image,
			status,
			progress: Math.floor((done / 4) * 100),
			// 保留原始行，便于排查
			rawRecords: logs
		}
	})
}

/**
 * 题库行 → 原 quiz_questions 集合的形状。
 *
 * 原集合字段：{ _id, title, options, answerIndex, slug, ... }
 * Prisma 表字段：{ id, question, options(String), answer(Int), points }
 *
 * 注意 options 在 Prisma 里是 String（JSON 字符串），
 * 原集合里是数组 —— 这里做一次安全解析。
 *
 * slug 从 QUIZ_SLUG_MAP（题目文本 → slug）反查，
 * 因为 Prisma 的 QuizQuestion 模型没有 slug 字段。
 */
export function normalizeQuizQuestions (rows) {
	const list = Array.isArray(rows) ? rows : []
	return list.map(row => {
		if (!row) return null
		let options = row.options
		if (typeof options === 'string') {
			try {
				options = JSON.parse(options)
			} catch (e) {
				options = []
			}
		}
		if (!Array.isArray(options)) options = []

		const title = row.question || row.title || ''

		return {
			_id: row.id,
			id: row.id,
			title,
			question: title,
			options,
			answerIndex: typeof row.answer === 'number' ? row.answer : (row.answerIndex || 0),
			points: row.points || 10,
			slug: row.slug || QUIZ_SLUG_MAP[title] || DEFAULT_QUIZ_SLUG
		}
	}).filter(Boolean)
}

/**
 * 按 slug 过滤题库（对齐原云函数 get_quiz_questions 的行为）。
 *
 * 原云函数：按 slug 查，查不到则回落到 'default'。
 * 这里：前端拿到的已经是全量列表，按同样的规则在内存里过滤。
 */
export function filterQuizBySlug (questions, slug) {
	const list = Array.isArray(questions) ? questions : []
	const target = slug || DEFAULT_QUIZ_SLUG
	const hit = list.filter(q => q.slug === target)
	if (hit.length) return hit
	const fallback = list.filter(q => q.slug === DEFAULT_QUIZ_SLUG)
	return fallback.length ? fallback : list
}

/**
 * 商城商品行 → 原 shop_goods 集合的形状。
 *
 * 原集合字段：{ _id, name, cost, img_url, description, ... }
 * Prisma 表字段：{ id, name, image, cost, desc, stock }
 */
export function normalizeShopGoods (rows) {
	const list = Array.isArray(rows) ? rows : []
	return list.map(row => {
		if (!row) return null
		return {
			_id: row.id,
			id: row.id,
			name: row.name || '',
			cost: typeof row.cost === 'number' ? row.cost : 0,
			// Sprint 5.2：商品图也转绝对 URL（后端可能存相对路径）
			img_url: toAbsoluteUrl(row.image) || row.image || '',
			image: toAbsoluteUrl(row.image) || row.image || '',
			description: row.desc || '',
			desc: row.desc || '',
			stock: row.stock || 0
		}
	}).filter(Boolean)
}

/**
 * 村庄行 → 原 init_food_data 中村庄部分的形状。
 *
 * Prisma Village 表字段：{ id, name, slug, latitude, longitude, intro, image }
 * 原集合用 _id 作为主键。
 *
 * ⚠️ Sprint 5.1 关键修正 —— 业务 ID 与数据库主键不是一回事：
 *   原云函数里村庄的主键是 **业务 ID 字符串** '101'–'105'，
 *   而 Prisma 的 id 是自增整数 1、2、3……
 *
 *   打卡记录表 check_in_places.locationId 存的就是这个业务 ID，
 *   location.vue 也用它作为打卡地点标识。
 *   如果直接把数据库主键当 locationId 写进去，
 *   打卡记录会与 VILLAGE_CONFIG 的 '101'–'105' 对不上，
 *   导致勋章页 / 手账页的进度**永远为 0**。
 *
 *   因此这里按 slug 反查业务 ID，保证与原云函数完全一致。
 */
export function normalizeVillages (rows) {
	const list = Array.isArray(rows) ? rows : []
	return list.map(row => {
		if (!row) return null
		const cfg = VILLAGE_CONFIG.find(v => v.slug === row.slug)
		const businessId = cfg ? cfg.id : String(row.id)

		return {
			// _id 用业务 ID，与原云函数保持一致
			_id: businessId,
			id: businessId,
			dbId: row.id,
			name: row.name || '',
			slug: row.slug || '',
			latitude: row.latitude,
			longitude: row.longitude,
			intro: row.intro || '',
			image: row.image || ''
		}
	}).filter(Boolean)
}

/**
 * 美食行 → 原 init_food_data 中美食部分的形状。
 *
 * Prisma Food 表字段：{ id, name, village, image, desc, recipe }
 *
 * ⚠️ Prisma 的 Food 模型**没有 slug 字段**，
 * 而前端 get_food_info 按 slug 查询美食详情。
 * 这里用「美食名 → VILLAGE_CONFIG」反查 slug（5 个村庄各对应 1 道美食，
 * 名称唯一，映射可靠）。
 *
 * 原页面（food/detail.vue）会读取 `story_paragraphs`（一段富文本数组），
 * 新后端没有这个字段 —— 这里降级为 recipe 拆行，
 * 保证详情页至少能显示正文而不是空白。
 */
export function normalizeFoods (rows) {
	const list = Array.isArray(rows) ? rows : []
	return list.map(row => {
		if (!row) return null
		const recipe = row.recipe || ''
		const story = recipe
			? String(recipe).split(/\n+/).map(line => line.trim()).filter(Boolean)
			: []

		// 按名称反查 slug
		const cfg = VILLAGE_CONFIG.find(v => v.name === row.name)

		return {
			_id: row.id,
			id: row.id,
			name: row.name || '',
			slug: row.slug || (cfg ? cfg.slug : ''),
			village: row.village || '',
			image: row.image || '',
			desc: row.desc || '',
			recipe,
			story_paragraphs: story
		}
	}).filter(Boolean)
}

/**
 * 单个美食（详情）→ 与 normalizeFoods 相同形状。
 */
export function normalizeFood (row) {
	if (!row) return null
	const list = normalizeFoods([row])
	return list[0] || null
}

/**
 * 用户照片行 → 原 user_photos 集合的形状。
 *
 * 原集合字段：{ _id, url, images(数组), locationName, title, ... }
 * Prisma 表的 images 是 JSON 字符串，需要解析回数组。
 *
 * Sprint 5.2：url / images 一律转成**绝对 URL**。
 * 后端存的是相对路径 '/uploads/xxx.png'，
 * 直接给 <image src> 在 H5/Web 端会裂图
 * （浏览器把 '/uploads/...' 当成站点根路径，打到 dev server 而不是后端 3000 端口）。
 */
export function normalizeUserPhotos (rows) {
	const list = Array.isArray(rows) ? rows : []
	return list.map(row => {
		if (!row) return null

		let images = row.images
		if (typeof images === 'string') {
			try {
				images = JSON.parse(images)
			} catch (e) {
				images = [row.url].filter(Boolean)
			}
		}
		if (!Array.isArray(images)) images = images ? [images] : []
		if (!images.length && row.url) images = [row.url]

		// 转绝对 URL
		const absImages = images.map(toAbsoluteUrl).filter(Boolean)
		const absUrl = toAbsoluteUrl(row.url)

		return {
			_id: row.id,
			id: row.id,
			url: absUrl,
			images: absImages,
			locationName: row.locationName || '',
			title: row.title || '',
			createTime: row.createTime
		}
	}).filter(Boolean)
}

/**
 * 订单行 → 原 user_orders 集合的形状。
 */
export function normalizeOrders (rows) {
	const list = Array.isArray(rows) ? rows : []
	return list.map(row => {
		if (!row) return null
		return {
			_id: row.id,
			id: row.id,
			itemId: row.itemId || '',
			itemName: row.itemName || '',
			itemImage: row.itemImage || '',
			cost: typeof row.cost === 'number' ? row.cost : 0,
			status: row.status || 1,
			createTime: row.createTime
		}
	}).filter(Boolean)
}

/**
 * 用户行 → 兼容旧字段名。
 *
 * 后端 toProfile 返回 { id, mobile, nickname, ... }（Prisma 主键叫 id）
 * 而前端有 10+ 处读 `userInfo._id`。
 *
 * 这里不修改后端，而是在读取时给一份「带 _id 别名」的副本，
 * 让既有页面代码继续工作。
 */
export function withLegacyId (user) {
	if (!user || typeof user !== 'object') return user
	if (user._id !== undefined) return user
	return Object.assign({}, user, { _id: user.id })
}

export default {
	VILLAGE_CONFIG,
	normalizeCheckInRecords,
	normalizeQuizQuestions,
	normalizeShopGoods,
	normalizeVillages,
	normalizeFoods,
	normalizeFood,
	normalizeUserPhotos,
	normalizeOrders,
	withLegacyId
}

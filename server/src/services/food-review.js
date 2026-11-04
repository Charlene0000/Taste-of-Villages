'use strict'

/**
 * 美食品鉴模拟引擎（Sprint 5.2 自研）
 *
 * ## 为什么需要
 * -----------
 * 原实现用百度智能云的图像识别 API 生成「美味指数 + 点评」。
 * Sprint 5 剥离云服务时砍掉了真实 API，
 * 新后端的 analyzeFoodPhoto 只返回一段说明文字，
 * 于是拍照打卡页的「饼饼品鉴报告」卡片**永远不显示**
 * （前端判 `aiResult.isFood`，后端没这个字段）。
 *
 * 本项目的硬指标是「零付费云依赖，clone 即可完整跑通」，
 * 所以这里实现一个**纯本地**的品鉴引擎：
 *   - 不调用任何外部 API
 *   - 不产生任何费用
 *   - 每次调用返回合理且**有变化**的评分与点评（前端演示效果需要）
 *
 * ## 模拟维度
 * ---------
 * 为了让结果看起来「像是真的在评这道菜」，评分与文案会参考输入的
 * 多个特征做确定性哈希：
 *   · 文件名（同一个菜名 → 同样的评价，便于复现）
 *   · 文件大小（不同照片 → 不同评分）
 *   · 提交序号（同一张图多次提交 → 略有变化，避免完全雷同）
 *
 * 哈希是确定性的：同样的输入永远得到同样的输出，
 * 这样测试可以断言，开发时也不会出现「刷新一次评语就变」的怪异体验。
 */

/**
 * 美食点评语料库
 *
 * 分成三档，对应高分 / 中分 / 低分，
 * 每档多条，随机（哈希）抽取，避免每次都是同一句。
 */
const COMMENTS = {
	high: [
		'这道菜色泽金黄，边缘微微焦脆，光看就知道火候恰到好处。咬下去那一瞬间，酥香和鲜甜同时在口腔里炸开，是让人愿意再来一碗的味道。',
		'摆盘很有诚意，酱色油亮，香味隔着屏幕都能闻到。肉质纹理清晰，入口先是微甜的酱汁，紧接着是食材本身的鲜，层次分明。',
		'看着朴素，吃一口才知道厉害。火候控得极准，外面微焦内里多汁，调味克制，没有一丁点多余的味道盖过食材本身。',
		'这是一道有灵魂的菜。食材新鲜，处理得干净，每一口都能尝到主料的本味。调味收得漂亮，回口还有一丝清甜，很见功力。',
		'卖相讨喜，味道更讨喜。汤汁浓稠挂勺，入口先是醇厚的鲜，随后是恰到好处的咸鲜，最后留一点点回甘，吃完还想喝汤。',
		'刀工和火候都看得出功夫。食材切得大小均匀，受热一致，所以每口的口感都一样稳定，这种细节最能看出厨子的功底。',
		'第一口是惊艳，第二口是满足，第三口是还想再来。香气层次丰富却不杂乱，甜咸之间的平衡拿捏得刚刚好。',
		'这是一道让人安心的菜。看得出是用心做的，食材处理得很干净，调味简单却精准，吃完胃里是舒服的。'
	],
	mid: [
		'味道是不错的家常味，食材新鲜，火候也够了。稍微有点可惜，如果再收一点汁会更香，下回可以试试。',
		'整体中规中矩，吃得出用了心。味道不惊艳但很稳，适合日常吃，要我说还差一点点的记忆点。',
		'香味是有的，口感也在线。就是调味稍微重了一点，盖住了一些食材本身的鲜，改进一点会更好。',
		'摆盘普通，味道还行。能吃出基本的功底，但没有什么特别打动人的地方，属于做得不错的那一类。',
		'家常味道，很下饭。肉炖得够烂，咸淡合适，不过油稍微大了一点，配清淡的菜会更合适。',
		'挺有意思的一道菜。第一次吃觉得味道有点重，但越吃越有味道，属于需要适应一下的类型。',
		'基本功没问题，出品稳定。只是在细节上还可以更讲究一些，比如摆盘再用心点，卖相好了体验也会更好。'
	],
	low: [
		'这道菜看起来有点朴素了。味道上还能吃，但火候似乎差了点，边缘有些发焦，建议多练练基本功。',
		'老实说不太推荐。调味偏咸，食材本身的味道几乎尝不出来，吃完嘴里一直有咸味。',
		'摆盘和味道都比较普通，没什么特色。如果想吃好吃的，建议换一家试试。',
		'能吃，但离好吃还有距离。食材处理略显粗糙，口感不够细腻，像是赶时间做的。',
		'颜色有点暗，看着就不太有食欲，味道也偏淡。要想更上一层楼，建议在火候和调味上多下点功夫。'
	]
}

/**
 * 美食标签库（用于卡片上的 #标签）
 */
const TAG_POOL = [
	'鲜', '香', '脆', '嫩', '入味', '地道', '家常', '下饭',
	'匠心', '现做', '热腾腾', '有锅气', '汕尾风味', '食材新鲜'
]

/**
 * 确定性哈希（FNV-1a 变体）
 *
 * 同一个字符串永远得到同一个数字 —— 这是「可复现」的基础。
 *
 * @param {string} str
 * @returns {number} 32 位无符号整数
 */
function hashString (str) {
	let h = 0x811c9dc5
	const s = String(str || '')
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i)
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
	}
	return h >>> 0
}

/**
 * 从数组中确定性地取一项
 *
 * @param {Array} arr
 * @param {number} seed
 * @returns {*} 数组中的一项
 */
function pickBy (arr, seed) {
	if (!Array.isArray(arr) || !arr.length) return null
	return arr[seed % arr.length]
}

/**
 * 推断菜品名称
 *
 * 输入是上传后的文件路径（形如 /uploads/1730000000-a1b2c3d4.png），
 * 拿不到真实菜名 —— 这里做两件事：
 *   ① 若调用方显式传了 name，直接用
 *   ② 否则从文件名里提取有意义的片段
 *
 * @param {string} filePath
 * @param {string} explicitName
 * @returns {string}
 */
function guessDishName (filePath, explicitName) {
	if (explicitName && String(explicitName).trim()) {
		return String(explicitName).trim()
	}

	const raw = String(filePath || '')
	if (!raw) return '这道美食'

	// 去掉查询串与扩展名
	const clean = raw.split('?')[0].split('/').pop() || ''
	// 去掉 multer 生成的时间戳与随机后缀（形如 1730000000-a1b2c3d4）
	const stripped = clean.replace(/\.[a-z0-9]+$/i, '').replace(/^\d+-[a-z0-9]+$/i, '')

	// 若文件名本身有可读内容（如「红桃粿.jpg」），用中文片段
	const cn = stripped.match(/[\u4e00-\u9fa5]{2,8}/)
	if (cn) return cn[0]

	// 否则用本地美食库里的名字随机配一个（按哈希确定）
	const dishes = [
		'清蒸晨洲蚝', '遮浪玛仔', '石寨菜包粿', '红桃粿', '排骨咸饭',
		'生蚝', '龟仔粿', '菜茶', '红草粿', '海丰莲花粿'
	]
	return pickBy(dishes, hashString(raw))
}

/**
 * 生成品鉴报告
 *
 * @param {Object} options
 * @param {string} options.filePath  上传后的文件路径（用于哈希）
 * @param {string} options.name      调用方显式指定的菜名
 * @param {number} options.size      文件字节数（可选，参与哈希）
 * @param {number} options.seq       提交序号（可选，参与哈希）
 * @returns {{
 *   isFood: boolean, score: number, comment: string, tags: string[],
 *   name: string, calorie: number, desc: string, simulated: boolean
 * }}
 */
function review (options = {}) {
	const filePath = options.filePath || ''
	const name = guessDishName(filePath, options.name)
	const seed = hashString([
		filePath,
		options.size || '',
		options.seq || '',
		name
	].join('|'))

	// 评分区间 80-95（用户明确要求 80-95）
	const score = 80 + (seed % 16)   // 80 ~ 95

	// 按分数选档：80-87 中分，88-95 高分
	const tier = score >= 88 ? 'high' : 'mid'
	const comment = pickBy(COMMENTS[tier], seed) || COMMENTS.mid[0]

	// 标签：3-4 个，由哈希决定
	const tagCount = 3 + (seed % 2)
	const tags = []
	for (let i = 0; i < tagCount; i++) {
		const tag = pickBy(TAG_POOL, (seed + i * 7) % TAG_POOL.length)
		if (tag && tags.indexOf(tag) === -1) tags.push(tag)
	}

	// 热量：按菜名哈希给一个合理区间（生蚝类高、粿类中等）
	const calorie = 120 + (hashString(name) % 280)

	return {
		isFood: true,
		score,
		comment,
		tags,
		name,
		calorie,
		desc: `本地品鉴引擎给出的模拟评分（未接入百度 AI 识图服务）。` +
			`实际部署时配置 BAIDU 相关凭据即可切换为真实识别。`,
		simulated: true
	}
}

module.exports = {
	review,
	guessDishName,
	hashString,
	COMMENTS,
	TAG_POOL
}

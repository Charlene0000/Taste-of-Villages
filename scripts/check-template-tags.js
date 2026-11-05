/**
 * Vue 模板标签闭合检查器（Sprint 5.3）
 *
 * ## 为什么需要
 * -----------
 * Sprint 5.2 用 Edit 工具批量修改 .vue 模板时，
 * 把 location.vue 的
 *     <view style="height: 100px;"></view>
 * 损坏成了
 *     <view style="height: 10        </view>
 *
 * 表现是 HBuilderX 编译期报错：
 *     tag <scroll-view> has no matching end tag
 *     Component template should contain exactly one root element
 *
 * 而当时的 `scripts/check-vue-syntax.js` **只检查 <script> 块**，
 * 完全没碰模板 —— 所以 207 项测试全绿却漏掉了这个致命错误。
 *
 * 本脚本补上模板这一层：解析 <template> 内的标签配对，
 * 检查开闭是否匹配、是否嵌套正确、根元素是否唯一。
 *
 * ## 实现
 * --------
 * 不用完整 HTML 解析器（零依赖），而是做一个轻量的标签栈扫描：
 *   · 跳过注释 <!-- -->
 *   · 跳过自闭合标签 <img /> <br /> 等
 *   · 跳过 void 元素
 *   · 遇到开标签入栈，闭标签出栈并比对名称
 *   · 扫描结束栈非空 → 有未闭合标签
 *   · 记录根元素数量 → 校验「只有一个根元素」
 *
 * 用法：
 *   node scripts/check-template-tags.js
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DIRS = ['pages', 'components']
const EXCLUDE = ['node_modules', 'unpackage', 'uni_modules', '.git']

/** 根级单文件组件（App.vue 等） */
const ROOT_FILES = ['App.vue']

/** 自闭合 / void 标签（不需要闭合） */
const VOID_TAGS = new Set([
	'img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col',
	'embed', 'param', 'source', 'track', 'wbr'
])

/** uni-app 内置组件（都是成对的，但单独列出便于阅读） */
const UNI_COMPONENTS = new Set([
	'view', 'text', 'image', 'scroll-view', 'swiper', 'swiper-item',
	'button', 'input', 'textarea', 'checkbox', 'radio', 'picker',
	'picker-view', 'picker-view-column', 'label', 'form', 'navigator',
	'rich-text', 'progress', 'slider', 'switch', 'video', 'audio',
	'camera', 'live-player', 'live-pusher', 'map', 'canvas',
	'uni-icons', 'uni-popup', 'uni-list', 'uni-forms', 'uni-easyinput',
	'uni-calendar', 'uni-badge', 'uni-card', 'uni-data-checkbox',
	'uni-load-more', 'uni-transition', 'uni-scss', 'block', 'slot',
	'cover-view', 'cover-image', 'movable-area', 'movable-view',
	'navigation-bar', 'open-data', 'official-account'
])

/**
 * 收集 .vue 文件
 */
function collectVueFiles (dir, out = []) {
	if (!fs.existsSync(dir)) return out
	fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
		if (EXCLUDE.includes(entry.name)) return
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) collectVueFiles(full, out)
		else if (entry.name.endsWith('.vue')) out.push(full)
	})
	return out
}

/**
 * 提取 <template> 内容（取第一个非空 template 块）
 */
function extractTemplate (src) {
	// <template> ... </template> 可能嵌套（template 标签内部还有 template）
	// 这里用简单扫描：找到第一个 <template> 后，匹配对应的 </template>
	const open = src.match(/<template[^>]*>/)
	if (!open) return null

	const startIdx = open.index + open[0].length
	const rest = src.slice(startIdx)

	// 统计嵌套深度，找到匹配的闭合标签
	let depth = 1
	let i = 0
	while (i < rest.length) {
		const nextOpen = rest.indexOf('<template', i)
		const nextClose = rest.indexOf('</template>', i)
		if (nextClose === -1) break
		if (nextOpen !== -1 && nextOpen < nextClose) {
			depth++
			i = nextOpen + 9
			continue
		}
		depth--
		if (depth === 0) {
			return rest.slice(0, nextClose)
		}
		i = nextClose + 11
	}
	return null
}

/**
 * 检查模板标签配对
 *
 * @param {string} template
 * @returns {Array<{type: string, message: string, line: number}>}
 */
function checkTags (template) {
	const problems = []

	// 去掉注释
	const clean = template.replace(/<!--[\s\S]*?-->/g, m => ' '.repeat(m.length))

	// 找出所有标签
	const tagRe = /<(\/?)([a-zA-Z][-a-zA-Z0-9_]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g
	const stack = []
	let m
	let rootCount = 0
	let rootClosed = false

	while ((m = tagRe.exec(clean))) {
		const isClose = m[1] === '/'
		const tagName = m[2]
		const attrs = m[3] || ''
		const selfClose = m[4] === '/'
		const line = clean.slice(0, m.index).split('\n').length

		// 跳过 void 标签与自闭合标签
		if (VOID_TAGS.has(tagName.toLowerCase()) || selfClose) {
			continue
		}

		if (!isClose) {
			// 开标签
			//
			// v-if / v-else / v-else-if 是**兄弟关系**，
			// v-else 元素不是新的根元素 —— 它与前面的 v-if 元素互斥显示。
			// 若不特殊处理，会把 `<view v-if>...</view><view v-else>...</view>`
			// 误判成「两个根元素」。
			const isVElse = /\bv-else\b/.test(attrs) || /\bv-else-if\b/.test(attrs)

			//
			// ⚠️ 属性值里出现了结束标签 —— 这正是 Sprint 5.2 的损坏形态：
			//     <view class="header"        </view>
			// 原本应是 <view class="header">…</view>，
			// 中间的内容被吃掉后，引号与标签名混进了属性区。
			//
			// 这种情况标签栈仍然是平衡的（正则把 </view> 当成了属性的一部分），
			// 所以纯靠配对检查发现不了 —— 必须单独检查属性区。
			if (/<\s*\//.test(attrs)) {
				problems.push({
					type: 'tag-in-attribute',
					message: `第 ${line} 行的标签属性里出现了结束标签 ` +
						`「${attrs.trim().slice(0, 50)}」—— ` +
						`通常是属性值或标签被截断所致`,
					line
				})
			}

			// 另一个特征：属性值里出现了未闭合的引号后紧跟标签名，
			// 例如 style="height: 10        </view>
			// 这时引号数量是偶数（配对），但语义已断。
			// 检测方式：属性区里出现了「引号 + 空白 + <」的组合。
			if (/"\s*</.test(attrs)) {
				problems.push({
					type: 'broken-attribute',
					message: `第 ${line} 行的标签属性疑似被截断：` +
						`「${attrs.trim().slice(0, 50)}」`,
					line
				})
			}

			if (stack.length === 0 && !isVElse) {
				rootCount++
				if (rootCount > 1) {
					problems.push({
						type: 'multiple-root',
						message: `出现第 ${rootCount} 个根元素 <${tagName}>（第 ${line} 行）。` +
							`组件模板必须只有一个根元素。`,
						line
					})
				}
			}
			stack.push({ tagName, line, isVElse })
		} else {
			// 闭标签
			if (stack.length === 0) {
				problems.push({
					type: 'unexpected-close',
					message: `多余的结束标签 </${tagName}>（第 ${line} 行）`,
					line
				})
				continue
			}
			const top = stack[stack.length - 1]
			if (top.tagName !== tagName) {
				problems.push({
					type: 'mismatch',
					message: `标签不匹配：第 ${top.line} 行开的是 <${top.tagName}>，` +
						`第 ${line} 行却用 </${tagName}> 关闭` +
						`（${top.tagName} 的正确闭合标签是 </${top.tagName}>）`,
					line
				})
				// 尝试恢复：从栈中找到同名标签并弹出
				const idx = stack.map(x => x.tagName).lastIndexOf(tagName)
				if (idx !== -1) {
					stack.length = idx
				} else {
					stack.pop()
				}
			} else {
				stack.pop()
			}
		}
	}

	// 扫描结束，栈里还有东西 = 未闭合
	stack.forEach(item => {
		problems.push({
			type: 'unclosed',
			message: `标签 <${item.tagName}> 未闭合` +
				`（开在第 ${item.line} 行，缺少对应的 </${item.tagName}>）`,
			line: item.line
		})
	})

	if (rootCount === 0) {
		problems.push({
			type: 'no-root',
			message: '模板中没有根元素',
			line: 1
		})
	}

	return problems
}

/**
 * 检查模板里的「属性值未闭合」
 *
 * ## 这是本次事故的直接特征
 * --------------------------
 * Sprint 5.2 用 Edit 工具替换 location.vue 的一行时，
 * 把
 *     <view style="height: 100px;"></view>
 * 损坏成
 *     <view style="height: 10        </view>
 *
 * 表现是引号没有闭合 —— 后面的 `0px;">` 整段被吃掉，
 * 于是 `<view>` 标签一直开到文件末尾，
 * `<scroll-view>` 自然「没有匹配的结束标签」。
 *
 * 这种损坏**光看标签配对不容易定位**（报的是 scroll-view 未闭合，
 * 真正出错的是上面那个 view），
 * 但用「行内引号数量为奇数」就能一眼看出是哪一行坏了。
 *
 * @param {string} template
 * @returns {Array<{type: string, message: string, line: number}>}
 */
function checkAttributeQuotes (template) {
	const problems = []
	const lines = template.split('\n')

	lines.forEach((line, idx) => {
		// 去掉注释与行尾的引号内容后，统计双引号数量
		const stripped = line.replace(/<!--[\s\S]*?-->/g, '')
		const doubleQuotes = (stripped.match(/"/g) || []).length
		const singleQuotes = (stripped.match(/'/g) || []).length

		// 引号数为奇数 → 该行的属性值没有闭合
		if (doubleQuotes % 2 === 1 || singleQuotes % 2 === 1) {
			problems.push({
				type: 'unclosed-quote',
				message: `第 ${idx + 1} 行的引号数量为奇数，属性值可能被截断：` +
					`${line.trim().slice(0, 60)}`,
				line: idx + 1
			})
		}
	})

	return problems
}

// ==================== 主流程 ====================

const files = []
DIRS.forEach(d => collectVueFiles(path.join(ROOT, d), files))
ROOT_FILES.forEach(f => {
	const p = path.join(ROOT, f)
	if (fs.existsSync(p)) files.push(p)
})

const failures = []
let checked = 0
let noTemplate = 0

files.forEach(file => {
	const src = fs.readFileSync(file, 'utf8')
	const rel = path.relative(ROOT, file).split(path.sep).join('/')

	const template = extractTemplate(src)
	if (template === null) {
		noTemplate++
		return
	}

	checked++
	const problems = checkTags(template).concat(checkAttributeQuotes(template))
	if (problems.length) {
		failures.push({ file: rel, problems })
	}
})

console.log('Vue 模板标签检查 —— ' + ROOT)
console.log('='.repeat(62))
console.log(`检查文件: ${checked} 个（另有 ${noTemplate} 个无 template 块，跳过）`)
console.log('')

if (failures.length) {
	console.log(`❌ ${failures.length} 个文件的模板标签有问题:`)
	console.log('')
	failures.forEach(f => {
		console.log(`  ${f.file}`)
		f.problems.forEach(p => {
			console.log(`     [${p.type}] ${p.message}`)
		})
		console.log('')
	})
	process.exitCode = 1
} else {
	console.log('✅ 全部通过：标签闭合正确，根元素唯一')
}

// ---------- 附：pages.json 与实际页面的一致性 ----------
//
// pages.json 注册了但文件不存在 → 编译期报「页面找不到」
// 文件存在但没注册 → 编译期报「页面未注册」
// 这类问题同样只在 HBuilderX 打开时暴露，值得静态拦一道。

console.log('')
console.log('页面注册一致性检查')
console.log('-'.repeat(62))

try {
	const pagesJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'pages.json'), 'utf8'))
	const registered = (pagesJson.pages || []).map(p => p.path)
	const issues = []

	registered.forEach(p => {
		const full = path.join(ROOT, p + '.vue')
		if (!fs.existsSync(full)) {
			issues.push(`pages.json 注册了不存在的页面文件: ${p}.vue`)
		}
	})

	// 反向：pages/ 下有 .vue 但没注册
	const onDisk = collectVueFiles(path.join(ROOT, 'pages'), [])
		.map(f => path.relative(ROOT, f).split(path.sep).join('/').replace(/\.vue$/, ''))
	onDisk.forEach(p => {
		if (registered.indexOf(p) === -1) {
			issues.push(`页面文件存在但未在 pages.json 注册: ${p}.vue`)
		}
	})

	if (issues.length) {
		console.log(`❌ ${issues.length} 个问题:`)
		issues.forEach(i => console.log('  ' + i))
		process.exitCode = 1
	} else {
		console.log(`✅ ${registered.length} 个页面注册与文件一一对应`)
	}
} catch (e) {
	console.log('❌ pages.json 解析失败: ' + e.message)
	process.exitCode = 1
}

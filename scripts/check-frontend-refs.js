/**
 * 前端未定义标识符扫描器（Sprint 5.1）
 *
 * ## 为什么需要它
 * -------------
 * Sprint 5 的批量替换脚本把 44 处 `uniCloud.callFunction` 改成了 HTTP 调用，
 * 同时清理了 uni-id-pages 的 `store` / `uniIdPageInit` 等引用。
 *
 * 脚本能改「调用点」，但改不了「引用点」——
 * 于是留下了 `store.userInfo` 这种**引用已删模块的残留**，
 * 运行时抛 `ReferenceError`，页面直接崩溃（用户报告的「白屏」）。
 *
 * 本脚本静态扫描所有前端文件，找出「被当作变量使用但没定义也没导入」的标识符，
 * 把这类「重构车祸」在提交前拦下来。
 *
 * 扫描策略（宁可漏报也不误报）：
 *   1. 只看**裸标识符**（前面不是 `.`），排除属性访问
 *   2. 过滤 JS 全部关键字
 *   3. 过滤 uni-app / Vue / 浏览器全局
 *   4. 只在「读取上下文」中报告 —— 即标识符后面跟着 `(`、`.`、运算符等
 *      （排除对象字面量的键、字符串内容）
 *
 * 用法：
 *   node scripts/check-frontend-refs.js
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DIRS = ['pages', 'components', 'utils']
const EXCLUDE = ['node_modules', 'unpackage', 'uni_modules', '.git', 'unpackage/dist']

/** JS 关键字与保留字 */
const KEYWORDS = new Set([
	'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete',
	'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in',
	'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
	'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'async', 'await', 'of', 'get', 'set',
	// 字面量
	'true', 'false', 'null', 'undefined', 'NaN', 'Infinity'
])

/** 全局对象与内置 */
const GLOBALS = new Set([
	'uni', 'plus', 'getCurrentPages', 'getApp', 'requirePlugin', 'define', 'defineProperty',
	'console', 'window', 'document', 'navigator', 'location', 'history', 'localStorage',
	'sessionStorage', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'requestAnimationFrame', 'cancelAnimationFrame', 'Promise', 'Math', 'JSON', 'Date',
	'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Error', 'TypeError',
	'RangeError', 'SyntaxError', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Proxy',
	'Reflect', 'Intl', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
	'Headers', 'Request', 'Response', 'AbortController', 'TextEncoder', 'TextDecoder',
	'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker',
	'performance', 'crypto', 'atob', 'btoa', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
	'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'escape', 'unescape',
	'queueMicrotask', 'structuredClone',
	'Vue', 'Component', 'mixin', 'extend', 'nextTick', 'observable',
	'process', 'global', 'globalThis', 'Buffer', '__dirname', '__filename', 'module',
	'require', 'exports', 'arguments', 'eval',
	// Vue 实例属性
	'$emit', '$refs', '$set', '$delete', '$nextTick', '$forceUpdate', '$props', '$attrs',
	'$listeners', '$slots', '$scopedSlots', '$parent', '$root', '$children', '$watch'
])

/** 剥离注释（保留字符串，因为 import 路径里就是字符串） */
function stripComments (source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/** 收集文件内声明过的标识符 */
function collectDeclared (source) {
	const declared = new Set()
	// 注意：这里只剥离注释，不剥离字符串 ——
	// import 语句的路径是字符串，剥掉会导致 import 解析失效。
	source = stripComments(source)
	let m

	const importRe = /import\s+([^;]+?)\s+from\s+['"][^'"]+['"]/g
	while ((m = importRe.exec(source))) {
		const clause = m[1]
		const def = clause.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/)
		if (def) declared.add(def[1])
		const named = clause.match(/\{([^}]*)\}/)
		if (named) {
			named[1].split(',').forEach(part => {
				const p = part.trim()
				if (!p) return
				const alias = p.split(/\s+as\s+/)
				declared.add((alias[1] || alias[0]).trim())
			})
		}
	}

	const nsRe = /import\s+\*\s+as\s+([A-Za-z_$][\w$]*)/g
	while ((m = nsRe.exec(source))) declared.add(m[1])

	// const/let/var 声明（含解构）
	const declRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g
	while ((m = declRe.exec(source))) declared.add(m[1])

	const destrRe = /\b(?:const|let|var)\s*(?:\{([^}]*)\}|\[([^\]]*)\])\s*=/g
	while ((m = destrRe.exec(source))) {
		const body = m[1] || m[2]
		if (!body) continue
		body.split(',').forEach(part => {
			const p = part.trim()
			if (!p) return
			const alias = p.split(/[:=]/).map(x => x.trim())
			declared.add(alias[alias.length - 1].replace(/^\.\.\./, ''))
		})
	}

	// 函数参数
	const paramRe = /\bfunction\s*\*?\s*[A-Za-z_$][\w$]*\s*\(([^)]*)\)/g
	while ((m = paramRe.exec(source))) {
		m[1].split(',').forEach(p => {
			const name = p.split(/[:=]/)[0].trim().replace(/^\.\.\./, '')
			if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name)
		})
	}

	// 箭头函数参数：(a, b) =>
	const arrowRe = /\(([^()]*)\)\s*=>/g
	while ((m = arrowRe.exec(source))) {
		m[1].split(',').forEach(p => {
			const name = p.split(/[:=]/)[0].trim().replace(/^\.\.\./, '')
			if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name)
		})
	}

	// 单参数箭头：x =>
	const arrow1Re = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>/gm
	while ((m = arrow1Re.exec(source))) declared.add(m[1])

	// function 声明
	const fnRe = /\bfunction\s+([A-Za-z_$][\w$]*)/g
	while ((m = fnRe.exec(source))) declared.add(m[1])

	// 类声明
	const clsRe = /\bclass\s+([A-Za-z_$][\w$]*)/g
	while ((m = clsRe.exec(source))) declared.add(m[1])

	// 对象方法 shorthand 与属性键（这两类既是声明也是使用，需登记为已声明）
	const objMethodRe = /(^|[\s{,])([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm
	while ((m = objMethodRe.exec(source))) declared.add(m[2])

	const objPropRe = /(?:^|[\s{,])([A-Za-z_$][\w$]*)\s*:/gm
	while ((m = objPropRe.exec(source))) declared.add(m[1])

	// 生命周期钩子
	const hookRe = /\b(on[A-Z]\w*)\s*\(/g
	while ((m = hookRe.exec(source))) declared.add(m[1])

	// catch (e)
	const catchRe = /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g
	while ((m = catchRe.exec(source))) declared.add(m[1])

	// for...of / for...in
	const forOfRe = /\bfor\s*\(\s*(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s+of\b/g
	while ((m = forOfRe.exec(source))) declared.add(m[1])

	return declared
}

/**
 * 找出「读取上下文」中的裸标识符
 *
 * 只报告后面跟着 `.` `(` 或运算符的位置 —— 这些才是「取值」，
 * 排除对象字面量的键（`foo: value` 中的 foo 是声明）。
 */
function findBareUses (source) {
	const uses = new Map()

	// 去掉字符串、模板字符串与注释
	// （注释里的标识符不是真实引用 —— 例如
	//   `// 从本地登录态读取用户标识（替代 uniCloud.getCurrentUserInfo）`
	//  这类说明性文字不应该被当成代码）
	const code = source
		.replace(/\/\*[\s\S]*?\*\//g, ' ')          // 块注释
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')      // 行注释（避开 http:// ）
		.replace(/`(?:[^`\\]|\\.)*`/g, '``')
		.replace(/'(?:[^'\\]|\\.)*'/g, "''")
		.replace(/"(?:[^"\\]|\\.)*"/g, '""')

	// 前面不是 . 也不是标识符字符，后面跟 . ( = 等
	const re = /(^|[^.\w$'"`])([A-Za-z_$][\w$]*)(?=\s*[.(=!<>+\-*/%&|^~?:;,)\]}])/g
	let m
	while ((m = re.exec(code))) {
		const name = m[2]
		// 排除对象字面量的键：前面是 { 或 , 且后面是 :
		const before = code.slice(Math.max(0, m.index - 1), m.index + 1)
		const after = code.slice(m.index + m[0].length, m.index + m[0].length + 2)
		if (/[{,]/.test(before) && /^\s*:/.test(after)) continue

		const line = code.slice(0, m.index).split('\n').length
		if (!uses.has(name)) uses.set(name, [])
		uses.get(name).push(line)
	}

	return uses
}

/**
 * 递归收集文件
 */
function collectFiles (dir, out = []) {
	if (!fs.existsSync(dir)) return out
	fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
		if (EXCLUDE.includes(entry.name)) return
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) collectFiles(full, out)
		else if (/\.(vue|js)$/.test(entry.name)) out.push(full)
	})
	return out
}

// ==================== 主流程 ====================

const files = []
DIRS.forEach(d => collectFiles(path.join(ROOT, d), files))

/**
 * 【精确检查】已删除模块的残留引用
 *
 * 这是本次重构最真实、最危险的故障模式：
 * 批量脚本删掉了 uni-id-pages 的 import，却留下了 `store.userInfo` 这样的使用点，
 * 运行时抛 ReferenceError，页面直接崩溃（白屏）。
 *
 * 这类检查**零误报** —— 这些名字在 uni-app 架构下根本不该出现。
 */
const REMOVED_MODULE_LEFTOVERS = [
	{ pattern: /\bstore\s*\.\s*userInfo\b/, name: 'store.userInfo', reason: 'uni-id-pages 的 store 已删除' },
	{ pattern: /\buniIdPageInit\b/, name: 'uniIdPageInit', reason: 'uni-id-pages 的初始化函数已删除' },
	{ pattern: /\buniCloud\s*\./, name: 'uniCloud.*', reason: 'uniCloud 已彻底移除' },
	{ pattern: /\buni_id_token\b/, name: 'uni_id_token', reason: 'uni-id 的 token 存储键已移除' },
	{ pattern: /\buni_id_token_expired\b/, name: 'uni_id_token_expired', reason: 'uni-id 的 token 存储键已移除' },
	{ pattern: /\buni-id-pages\b/, name: 'uni-id-pages', reason: 'uni-id-pages 模块已删除' },
	{ pattern: /\buni-id-common\b/, name: 'uni-id-common', reason: 'uni-id-common 模块已删除' },
	{ pattern: /\buni-config-center\b/, name: 'uni-config-center', reason: 'uni-config-center 模块已删除' }
]

const leftovers = []

files.forEach(file => {
	const src = fs.readFileSync(file, 'utf8')
	const rel = path.relative(ROOT, file).split(path.sep).join('/')

	let code = src
	if (file.endsWith('.vue')) {
		const m = src.match(/<script[^>]*>([\s\S]*?)<\/script>/)
		if (!m) return
		code = m[1]
	}

	// 只看代码（去注释与字符串）
	const clean = stripComments(code)
		.replace(/`(?:[^`\\]|\\.)*`/g, '``')
		.replace(/'(?:[^'\\]|\\.)*'/g, "''")
		.replace(/"(?:[^"\\]|\\.)*"/g, '""')

	REMOVED_MODULE_LEFTOVERS.forEach(rule => {
		const m = clean.match(rule.pattern)
		if (m) {
			const line = clean.slice(0, m.index).split('\n').length
			leftovers.push({ file: rel, line, name: rule.name, reason: rule.reason })
		}
	})
})

console.log('前端引用扫描 —— ' + ROOT)
console.log('='.repeat(62))
console.log(`扫描文件: ${files.length} 个`)
console.log('')

// ---------- 第一部分：已删除模块的残留（精确，零误报） ----------
if (leftovers.length) {
	console.log(`🔴 发现 ${leftovers.length} 处已删除模块的残留引用（会导致运行时崩溃）:`)
	console.log('')
	leftovers.forEach(p => {
		console.log(`  ${p.file}:${p.line}  →  ${p.name}`)
		console.log(`     原因：${p.reason}`)
	})
	console.log('')
} else {
	console.log('✅ 已删除模块的残留引用：无')
}
console.log('')

// ---------- 第二部分：一般未定义标识符（启发式，可能有误报） ----------
const problems = []

files.forEach(file => {
	const src = fs.readFileSync(file, 'utf8')
	const rel = path.relative(ROOT, file).split(path.sep).join('/')

	let code = src
	if (file.endsWith('.vue')) {
		const m = src.match(/<script[^>]*>([\s\S]*?)<\/script>/)
		if (!m) return
		code = m[1]
	}

	const declared = collectDeclared(code)
	const used = findBareUses(code)

	used.forEach((lines, name) => {
		if (KEYWORDS.has(name)) return
		if (GLOBALS.has(name)) return
		if (declared.has(name)) return
		problems.push({ file: rel, name, lines: lines.slice(0, 3) })
	})
})

if (problems.length) {
	console.log(`ℹ️ 另有 ${problems.length} 处启发式可疑标识符（多数是模板作用域变量，可忽略）:`)
	console.log('')
	const grouped = {}
	problems.forEach(p => {
		if (!grouped[p.name]) grouped[p.name] = []
		grouped[p.name].push(p.file + ':' + p.lines.join(','))
	})
	Object.keys(grouped).sort().forEach(name => {
		console.log(`  ${name}  —  ${grouped[name].slice(0, 3).join(' | ')}`)
	})
	console.log('')
} else {
	console.log('✅ 未发现未定义标识符')
}

if (leftovers.length) {
	process.exitCode = 1
}

/**
 * .vue 脚本块语法校验器（Sprint 5.2）
 *
 * ## 为什么需要
 * -----------
 * Sprint 5.1 的批量替换脚本改过 20+ 个 .vue 文件的 script 块，
 * Sprint 5.2 又新增了导航栏组件与多处模板改动。
 * 静态语法检查是防止「改坏了但没人发现」的最后一道防线 ——
 * 编译器不会在 HBuilderX 打开前告诉你哪里写错了。
 *
 * ## 实现要点
 * ---------
 * 用 `new Function()` 构造函数体来触发 JS 引擎的语法解析。
 * 关键是要**先剥离注释**：
 *   注释里常出现 `export default {` 这类示例代码，
 *   若不剥离，替换 `export default` 时会误伤注释，
 *   真正的 `export default` 反而残留 → 假报错。
 *
 * 用法：
 *   node scripts/check-vue-syntax.js
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DIRS = ['pages', 'components']
const EXCLUDE = ['node_modules', 'unpackage', 'uni_modules', '.git']

/**
 * 剥离注释（保留字符串，因为 import 路径是字符串）
 */
function stripComments (source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/**
 * 剥离 import 语句
 * （保留其余代码，让 JS 引擎检查语法）
 */
function stripImports (source) {
	return source.replace(/import\s+[^;]*?from\s+['"][^'"]*['"];?/g, '')
}

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

// ==================== 主流程 ====================

const files = []
DIRS.forEach(d => collectVueFiles(path.join(ROOT, d), files))

const failures = []
let checked = 0

files.forEach(file => {
	const src = fs.readFileSync(file, 'utf8')
	const rel = path.relative(ROOT, file).split(path.sep).join('/')

	const m = src.match(/<script[^>]*>([\s\S]*?)<\/script>/)
	if (!m) return

	checked++

	// 顺序很重要：先剥注释，再剥 import，最后替换 export default
	let code = stripComments(m[1])
	code = stripImports(code)
	code = code.replace(/\bexport\s+default\b/, 'const __default__ =')

	// 顶层 await / return 等在模块顶层不合法的写法：
	// 用 async 函数包裹即可通过语法解析
	try {
		// eslint-disable-next-line no-new-func
		new Function('"use strict"; return (async () => {' + code + '})')
	} catch (e) {
		failures.push({ file: rel, error: e.message })
	}
})

console.log('Vue 语法校验 —— ' + ROOT)
console.log('='.repeat(62))
console.log(`检查文件: ${checked} 个`)
console.log('')

if (failures.length) {
	console.log(`❌ ${failures.length} 个文件有语法错误:`)
	console.log('')
	failures.forEach(f => {
		console.log(`  ${f.file}`)
		console.log(`     ${f.error}`)
	})
	process.exitCode = 1
} else {
	console.log('✅ 全部通过')
}

#!/usr/bin/env node
'use strict'

/**
 * uniCloud → HTTP 后端 调用替换脚本（Sprint 5）
 *
 * 把前端所有 `uniCloud.callFunction({ name: 'X', data: {...} })`
 * 替换为 `businessApi.X({...})` / `agentApi.xxx(...)`，
 * 并把随之变化的 `res.result` 访问改为 `res`。
 *
 * 之所以用脚本而非手工逐处改：
 *   44 处调用点形态高度规整，机械替换比手工更不容易出错，
 *   且替换结果可用 grep 精确断言（零残留 + 零误伤）。
 *
 * 用法：node scripts/migrate-to-http.js [--dry-run]
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

/** 需要扫描的目录 */
const TARGET_DIRS = ['pages', 'components', 'utils']

/** 云函数名 → API 映射 */
const API_MAP = {
	// 业务读接口
	getCheckInRecords: 'businessApi.getCheckInRecords',
	getUserCheckedSpots: 'businessApi.getUserCheckedSpots',
	getUserPhotos: 'businessApi.getUserPhotos',
	get_villages_list: 'businessApi.get_villages_list',
	get_village_info: 'businessApi.get_village_info',
	get_food_info: 'businessApi.get_food_info',
	get_shop_goods: 'businessApi.get_shop_goods',
	get_quiz_questions: 'businessApi.get_quiz_questions',
	get_user_orders: 'businessApi.get_user_orders',
	// 业务写接口
	checkIn: 'businessApi.checkIn',
	dailySignIn: 'businessApi.dailySignIn',
	quizCheckIn: 'businessApi.quizCheckIn',
	gameCheckIn: 'businessApi.gameCheckIn',
	saveUserPhotos: 'businessApi.saveUserPhotos',
	deleteUserPhoto: 'businessApi.deleteUserPhoto',
	updateUserPhoto: 'businessApi.updateUserPhoto',
	purchaseItem: 'businessApi.purchaseItem',
	userInit: 'businessApi.userInit',
	analyzeFoodPhoto: 'businessApi.analyzeFoodPhoto',
	// Agent
	'ai-agent': 'agentApi.chat'
}

function collectFiles (dir, acc = []) {
	if (!fs.existsSync(dir)) return acc
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			collectFiles(full, acc)
		} else if (/\.(vue|js)$/.test(entry.name)) {
			acc.push(full)
		}
	}
	return acc
}

/**
 * 替换单个文件
 * @returns {{changed: boolean, replacements: Array<{from: string, to: string}>}}
 */
function migrateFile (file) {
	let src = fs.readFileSync(file, 'utf8')
	const replacements = []

	// ① 多行形态：
	//    await uniCloud.callFunction({
	//        name: 'X',
	//        data: {...}
	//    })
	const multiLine = /await\s+uniCloud\.callFunction\(\{\s*\n\s*name:\s*'([^']+)'\s*,\s*\n\s*data:\s*([\s\S]*?)\n\s*\}\s*\)/g
	src = src.replace(multiLine, (match, name, dataBlock) => {
		const api = API_MAP[name]
		if (!api) return match
		// data 块内容：去掉末尾逗号
		const data = dataBlock.replace(/,\s*$/, '').trim()
		replacements.push({ from: `callFunction(${name})`, to: api })
		return `await ${api}(${data})`
	})

	// ② 单行形态：
	//    await uniCloud.callFunction({ name: 'X', data: {...} })
	//    await uniCloud.callFunction({ name: 'X' })
	const singleLine = /await\s+uniCloud\.callFunction\(\{\s*name:\s*'([^']+)'\s*(?:,\s*data:\s*([\s\S]*?))?\s*\}\s*\)/g
	src = src.replace(singleLine, (match, name, data) => {
		const api = API_MAP[name]
		if (!api) return match
		replacements.push({ from: `callFunction(${name})`, to: api })
		if (data === undefined) {
			return `await ${api}()`
		}
		return `await ${api}(${data.trim()})`
	})

	// ③ 解构形态：const { result } = await uniCloud.callFunction({...})
	//    已由 ①② 处理，这里处理残留的 result 解构
	src = src.replace(/const\s*\{\s*result\s*\}\s*=\s*await\s+(businessApi\.[A-Za-z_]+|agentApi\.[A-Za-z_]+)\(/g,
		(match, api) => {
			replacements.push({ from: 'const { result } = await ' + api, to: 'const result = await ' + api })
			return `const result = await ${api}(`
		})

	// ④ 结果访问结构对齐：
	//    云函数返回 { code, data }，前端访问 res.result.data
	//    HTTP 后端直接返回 { code, data }，前端访问 res.data
	//    因此把 <变量>.result 改为 <变量>
	//
	// 变量名从替换点前后的赋值语句中提取：
	//    const res = await businessApi.xxx(...)  →  res
	//    const listRes = await ...               →  listRes
	const touchedVars = new Set()
	const declRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+(?:businessApi|agentApi)\./g
	let m
	while ((m = declRe.exec(src)) !== null) {
		touchedVars.add(m[1])
	}
	// 解构形态：const { result } = await xxx  →  变量名就是 result
	touchedVars.add('result')

	for (const v of touchedVars) {
		const before = src
		src = src.replace(new RegExp(`\\b${v}\\.result\\.`, 'g'), `${v}.`)
		src = src.replace(new RegExp(`\\b${v}\\.result\\b`, 'g'), v)
		if (src !== before) {
			replacements.push({ from: `${v}.result`, to: v })
		}
	}

	// ⑤ 补 import
	const needBusiness = replacements.some(r => r.to.startsWith('businessApi.'))
	const needAgent = replacements.some(r => r.to.startsWith('agentApi.'))

	if (needBusiness && !/import\s+\{[^}]*businessApi/.test(src)) {
		// 在 <script> 块内插入 import
		const importLine = `import { businessApi${needAgent ? ', agentApi' : ''} } from '@/utils/auth.js'\n`
		src = insertImport(src, importLine)
		replacements.push({ from: '(import)', to: importLine.trim() })
	} else if (needAgent && !/import\s+\{[^}]*agentApi/.test(src)) {
		const importLine = `import { agentApi } from '@/utils/auth.js'\n`
		src = insertImport(src, importLine)
		replacements.push({ from: '(import)', to: importLine.trim() })
	}

	return { changed: src !== fs.readFileSync(file, 'utf8'), src, replacements }
}

/**
 * 在 script 块的开头插入 import
 */
function insertImport (src, importLine) {
	const scriptMatch = src.match(/<script[^>]*>/)
	if (!scriptMatch) return src
	const idx = src.indexOf(scriptMatch[0]) + scriptMatch[0].length
	// 跳过紧随其后的换行
	let insertAt = idx
	if (src[insertAt] === '\n') insertAt++
	return src.slice(0, insertAt) + importLine + src.slice(insertAt)
}

function main () {
	console.log('uniCloud → HTTP 后端 调用替换' + (DRY_RUN ? '（试运行，不写文件）' : ''))
	console.log('='.repeat(62))

	const files = []
	TARGET_DIRS.forEach(d => collectFiles(path.join(ROOT, d), files))

	let totalReplacements = 0
	const touched = []

	for (const file of files) {
		const rel = path.relative(ROOT, file).split(path.sep).join('/')
		const before = fs.readFileSync(file, 'utf8')
		if (!/uniCloud\.(callFunction|importObject|database|uploadFile|getCurrentUserInfo)/.test(before)) {
			continue
		}

		const result = migrateFile(file)
		if (result.src !== before) {
			totalReplacements += result.replacements.length
			touched.push({ rel, count: result.replacements.length })
			if (!DRY_RUN) {
				fs.writeFileSync(file, result.src)
			}
		}
	}

	console.log(`扫描文件: ${files.length}`)
	console.log(`发生替换的文件: ${touched.length}`)
	console.log(`替换总数: ${totalReplacements}\n`)

	touched.forEach(t => {
		console.log(`  ${String(t.count).padStart(3)} 处  ${t.rel}`)
	})
}

main()

#!/usr/bin/env node
'use strict'

/**
 * uni-id-pages 依赖清理脚本（Sprint 5）
 *
 * 把前端对官方 uni-id-pages 模块的依赖，替换为自研的登录态实现：
 *
 *   ① `import { store } from '@/uni_modules/uni-id-pages/common/store.js'`
 *      → 改用 utils/request.js 的 getUserInfo()
 *   ② `uni.getStorageSync('uni-id-pages-userInfo')`
 *      → `uni.getStorageSync('app_user_info')`
 *   ③ `uni.getStorageSync('uni_id_userinfo')`
 *      → `uni.getStorageSync('app_user_info')`
 *   ④ 登录页路径 `/uni_modules/uni-id-pages/pages/login/xxx`
 *      → `/pages/login/login`
 *   ⑤ 用户中心路径 `/uni_modules/uni-id-pages/pages/userinfo/userinfo`
 *      → `/pages/userinfo/userinfo`
 *
 * 用法：node scripts/migrate-uni-id-pages.js [--dry-run]
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')
const TARGET_DIRS = ['pages', 'components', 'utils']

function collectFiles (dir, acc = []) {
	if (!fs.existsSync(dir)) return acc
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) collectFiles(full, acc)
		else if (/\.(vue|js)$/.test(entry.name)) acc.push(full)
	}
	return acc
}

function migrateFile (file) {
	const before = fs.readFileSync(file, 'utf8')
	let src = before
	const changes = []

	const apply = (pattern, replacement, label) => {
		const next = src.replace(pattern, replacement)
		if (next !== src) {
			src = next
			changes.push(label)
		}
	}

	// ① 官方 store 导入 → 自研 request.js
	apply(
		/import\s*\{\s*store\s*\}\s*from\s*'@\/uni_modules\/uni-id-pages\/common\/store\.js'/g,
		"import { getUserInfo } from '@/utils/request.js'",
		'store 导入'
	)

	// ② store.state.userInfo → getUserInfo()
	apply(/\bstore\.state\.userInfo\b/g, 'getUserInfo()', 'store.state.userInfo')

	// ③ 存储键替换
	apply(/uni\.getStorageSync\('uni-id-pages-userInfo'\)/g, "uni.getStorageSync('app_user_info')", 'userInfo 存储键')
	apply(/uni\.getStorageSync\('uni_id_userinfo'\)/g, "uni.getStorageSync('app_user_info')", 'userinfo 存储键')
	apply(/uni\.setStorageSync\('uni-id-pages-userInfo'/g, "uni.setStorageSync('app_user_info'", 'userInfo 写入键')
	apply(/uni\.removeStorageSync\('uni-id-pages-userInfo'\)/g, "uni.removeStorageSync('app_user_info')", 'userInfo 移除键')

	// ④ 登录页路径
	apply(/'\/uni_modules\/uni-id-pages\/pages\/login\/login-withpwd'/g, "'/pages/login/login'", '登录页路径')
	apply(/'\/uni_modules\/uni-id-pages\/pages\/login\/login-withoutpwd'/g, "'/pages/login/login'", '登录页路径')
	apply(/'\/uni_modules\/uni-id-pages\/pages\/login\/login-smscode'/g, "'/pages/login/login'", '登录页路径')

	// ⑤ 用户中心路径
	apply(/'\/uni_modules\/uni-id-pages\/pages\/userinfo\/userinfo'/g, "'/pages/userinfo/userinfo'", '用户中心路径')

	// ⑥ 补 getUserInfo 的 import
	if (changes.includes('store.state.userInfo') || changes.includes('store 导入')) {
		if (!/import\s*\{[^}]*getUserInfo[^}]*\}\s*from\s*'@\/utils\/request\.js'/.test(src)) {
			const re = /(import\s*\{[^}]*\}\s*from\s*'@\/utils\/request\.js')/
			if (re.test(src)) {
				src = src.replace(re, m => m.replace('{', '{ getUserInfo,').replace(' getUserInfo,,', ' getUserInfo,'))
			}
		}
	}

	return { src, changes, changed: src !== before }
}

function main () {
	console.log('uni-id-pages 依赖清理' + (DRY_RUN ? '（试运行）' : ''))
	console.log('='.repeat(62))

	const files = []
	TARGET_DIRS.forEach(d => collectFiles(path.join(ROOT, d), files))

	let total = 0
	const touched = []

	for (const file of files) {
		const rel = path.relative(ROOT, file).split(path.sep).join('/')
		const before = fs.readFileSync(file, 'utf8')
		if (before.indexOf('uni-id-pages') === -1) continue

		const result = migrateFile(file)
		if (result.changed) {
			total += result.changes.length
			touched.push({ rel, changes: result.changes })
			if (!DRY_RUN) fs.writeFileSync(file, result.src)
		}
	}

	console.log(`发生修改的文件: ${touched.length}`)
	console.log(`修改点总数: ${total}\n`)
	touched.forEach(t => {
		console.log(`  ${t.rel}`)
		console.log(`    ${[...new Set(t.changes)].join(', ')}`)
	})
}

main()

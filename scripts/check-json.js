#!/usr/bin/env node
'use strict'

/**
 * JSON 语法校验器（Sprint 0 引入的唯一自动化检查）
 *
 * 背景：Sprint 0 对 13 个 JSON 文件做了删改（死代码清理、隐私数据替换、密钥占位符化、
 * package.json 规范化）。任何一处写坏都会导致 HBuilderX 编译或 uniCloud 部署直接失败，
 * 因此需要一个零依赖、可在任意环境运行的校验入口。
 *
 * 用法：
 *   npm test
 *   node scripts/check-json.js
 *
 * 退出码：0 = 全部通过；1 = 存在校验失败的文件
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

// 需要跳过的目录：依赖、构建产物、缓存
const SKIP_DIRS = new Set([
	'node_modules',
	'unpackage',
	'dist',
	'build',
	'.git',
	'.hbuilderx',
	'.backup',
	'.npm-cache',
	'npm_cache',
	'.idea',
	'.vscode'
])

// 这些文件虽然合法但体积巨大或由工具生成，跳过以加快校验
const SKIP_FILES = new Set(['package-lock.json'])

function collectJsonFiles(dir, acc) {
	let entries
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true })
	} catch (e) {
		return acc
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) continue
			collectJsonFiles(full, acc)
		} else if (entry.isFile() && entry.name.endsWith('.json')) {
			if (SKIP_FILES.has(entry.name)) continue
			acc.push(full)
		}
	}
	return acc
}

/**
 * 判断文件是否为 JSONL 数据格式（每行一条独立 JSON）
 * —— 每行是一条独立的 JSON 记录。
 * 这类文件整体不是合法 JSON，但逐行是。
 */
function isJsonlFormat(raw) {
	const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
	if (lines.length === 0) return false
	// 若整体能解析成功，说明它就是标准 JSON，不走 JSONL 分支
	try {
		JSON.parse(raw)
		return false
	} catch (e) {
		// 整体解析失败 —— 判断是否所有行都是独立 JSON
		return lines.every(line => {
			try {
				JSON.parse(line)
				return true
			} catch (e2) {
				return false
			}
		})
	}
}

/**
 * 部分 schema 文件允许顶部出现 `//` 行注释。
 * 校验前先剥离整行注释，再尝试解析。
 */
function stripLineComments(raw) {
	return raw
		.split(/\r?\n/)
		.map(line => {
			const trimmed = line.trim()
			if (trimmed.startsWith('//')) return ''
			return line
		})
		.join('\n')
}

function validateFile(file) {
	const raw = fs.readFileSync(file, 'utf8')
	if (raw.trim() === '') {
		return { ok: false, reason: '文件为空' }
	}

	// ① 标准 JSON
	try {
		JSON.parse(raw)
		return { ok: true, format: 'json' }
	} catch (e) {
		// 继续尝试其他格式
	}

	// ② JSONL（uniCloud 数据库数据文件）
	if (isJsonlFormat(raw)) {
		const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
		for (let i = 0; i < lines.length; i++) {
			try {
				JSON.parse(lines[i])
			} catch (e) {
				return { ok: false, reason: 'JSONL 第 ' + (i + 1) + ' 行解析失败: ' + e.message }
			}
		}
		return { ok: true, format: 'jsonl', records: lines.length }
	}

	// ③ 带行注释的 schema
	const stripped = stripLineComments(raw)
	try {
		JSON.parse(stripped)
		return { ok: true, format: 'json-with-comments' }
	} catch (e) {
		return { ok: false, reason: e.message }
	}
}

function main() {
	const files = collectJsonFiles(ROOT, []).sort()

	const passed = []
	const failed = []
	const formatCount = {}

	for (const file of files) {
		const result = validateFile(file)
		const rel = path.relative(ROOT, file).split(path.sep).join('/')
		if (result.ok) {
			passed.push({ file: rel, format: result.format, records: result.records })
			formatCount[result.format] = (formatCount[result.format] || 0) + 1
		} else {
			failed.push({ file: rel, reason: result.reason })
		}
	}

	console.log('JSON 语法校验 —— ' + ROOT)
	console.log('='.repeat(60))
	console.log('扫描文件数: ' + files.length)
	const fmtDesc = {
		json: '标准 JSON',
		jsonl: 'JSONL（每行独立 JSON 的数据文件）',
		'json-with-comments': 'JSON（含行注释 schema）'
	}
	for (const key of Object.keys(formatCount)) {
		console.log('  ' + (fmtDesc[key] || key) + ': ' + formatCount[key] + ' 个')
	}
	console.log('')

	if (passed.length) {
		console.log('✅ 通过 (' + passed.length + ')')
		for (const item of passed) {
			const suffix = item.format === 'jsonl' ? '  [JSONL × ' + item.records + ' 条记录]' : ''
			console.log('   OK   ' + item.file + suffix)
		}
		console.log('')
	}

	if (failed.length) {
		console.log('❌ 失败 (' + failed.length + ')')
		for (const item of failed) {
			console.log('   FAIL ' + item.file)
			console.log('        ' + item.reason)
		}
		console.log('')
		console.log('校验结果: 失败')
		process.exitCode = 1
		return
	}

	console.log('校验结果: 全部通过')
}

main()

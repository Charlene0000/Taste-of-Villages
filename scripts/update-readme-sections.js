#!/usr/bin/env node
'use strict'

/**
 * README 章节替换工具（Sprint 5）
 *
 * 从 docs/readme-sections/*.md 读取章节内容，替换 README 中对应的二级标题章节。
 * 用独立文件承载内容，避免模板字符串的转义问题。
 *
 * 用法：node scripts/update-readme-sections.js
 */

const fs = require('fs')
const path = require('path')

const README = path.join(__dirname, '..', 'README.md')
const SECTION_DIR = path.join(__dirname, '..', 'docs', 'readme-sections')

/** 文件名 → 章节标题 */
const MAP = {
	'known-issues.md': 'Known Issues & Limitations',
	'features.md': 'Features',
	'development-process.md': 'Development Process',
	'production-deployment.md': 'Production Deployment',
	'technical-highlights.md': 'Technical Highlights'
}

function main () {
	let src = fs.readFileSync(README, 'utf8')

	for (const [file, title] of Object.entries(MAP)) {
		const filePath = path.join(SECTION_DIR, file)
		if (!fs.existsSync(filePath)) {
			console.log('❌ 缺少章节文件: ' + file)
			continue
		}

		const content = fs.readFileSync(filePath, 'utf8').replace(/\s+$/, '')

		const start = src.indexOf('## ' + title)
		if (start === -1) {
			console.log('❌ 未找到章节: ' + title)
			continue
		}

		const next = src.indexOf('\n## ', start + 1)
		const end = next === -1 ? src.length : next + 1

		src = src.slice(0, start) + content + '\n' + src.slice(end)
		console.log('✅ 已替换章节: ' + title)
	}

	fs.writeFileSync(README, src)
}

main()

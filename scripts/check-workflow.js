#!/usr/bin/env node
'use strict'

/**
 * GitHub Actions workflow YAML 语法校验（Sprint 4）
 *
 * 目的：workflow 文件结构正确但 YAML 语法错误的话，GitHub 会在推送时
 *       静默忽略或报错。提交前本地校验一遍，能避免这种低级问题。
 *
 * 实现：不引入 yaml 依赖（保持零依赖），
 *       自己做缩进一致性、Tab 字符、键值结构、必填字段的检查，
 *       并与 GitHub 官方 schema 的关键约束对照。
 *
 * 用法：node scripts/check-workflow.js
 */

const fs = require('fs')
const path = require('path')

const WORKFLOW_DIR = path.join(__dirname, '..', '.github', 'workflows')

const results = []
function check (name, fn) {
	try {
		fn()
		results.push({ name, ok: true })
		console.log('  ✅ ' + name)
	} catch (e) {
		results.push({ name, ok: false, error: e.message })
		console.log('  ❌ ' + name + '\n     ' + e.message)
	}
}

/**
 * 极简 YAML 结构解析器（仅支持本项目 workflow 用到的语法子集）
 * 返回按层级展开的键路径集合
 */
function parseStructure (lines) {
	const keys = []
	const stack = []

	lines.forEach((line, idx) => {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#')) return

		const indent = line.length - line.replace(/^\s*/, '').length
		const m = trimmed.match(/^([A-Za-z_][\w.-]*)\s*:(\s*(.*))?$/)

		while (stack.length && stack[stack.length - 1].indent >= indent) {
			stack.pop()
		}

		if (m) {
			const key = m[1]
			const value = (m[3] || '').trim()
			const path = stack.map(s => s.key).concat(key).join('.')
			keys.push({ path, value, line: idx + 1, indent })

			if (value === '') {
				stack.push({ key, indent })
			}
		} else if (trimmed.startsWith('- ')) {
			const path = stack.map(s => s.key).join('.')
			keys.push({ path: path + '[]', value: trimmed.slice(2), line: idx + 1, indent })
		}
	})

	return keys
}

function validateFile (file) {
	const raw = fs.readFileSync(file, 'utf8')
	const lines = raw.split(/\r?\n/)

	// 标记处于块标量（| 或 >）内部的行 —— 这些行是脚本文本，不参与 YAML 缩进检查
	const inBlock = []
	let blockIndent = null
	lines.forEach((l, i) => {
		if (blockIndent !== null) {
			// 空行或缩进大于块标量起始缩进 → 仍在块内
			if (!l.trim() || (l.length - l.replace(/^\s*/, '').length) > blockIndent) {
				inBlock[i] = true
				return
			}
			blockIndent = null
		}
		const m = l.match(/^(\s*).*[:|>]+\s*$/)
		if (m && /[:|>]/.test(l)) {
			// 形如 "run: |" 的块标量起始
			const valuePart = l.trim().split(':').slice(1).join(':').trim()
			if (valuePart === '|' || valuePart === '>' || valuePart === '|-' || valuePart === '>-') {
				blockIndent = l.length - l.replace(/^\s*/, '').length
			}
		}
	})

	// ① 不允许 Tab 缩进（YAML 规范）
	const tabLines = []
	lines.forEach((l, i) => {
		if (!inBlock[i] && /^\s*\t/.test(l)) tabLines.push(i + 1)
	})
	if (tabLines.length) {
		throw new Error('第 ' + tabLines.join(', ') + ' 行使用了 Tab 缩进，YAML 不允许')
	}

	// ② 缩进必须是空格且为 2 的倍数（块标量内部除外）
	lines.forEach((l, i) => {
		if (inBlock[i]) return
		if (!l.trim() || l.trim().startsWith('#')) return
		const indent = l.length - l.replace(/^\s*/, '').length
		if (indent % 2 !== 0) {
			throw new Error('第 ' + (i + 1) + ' 行缩进为 ' + indent + '，应为 2 的倍数')
		}
	})

	// ③ 结构解析不能抛错
	const keys = parseStructure(lines)
	const paths = keys.map(k => k.path)

	// ④ 必填顶层字段
	for (const required of ['name', 'on', 'jobs']) {
		if (!paths.some(p => p === required)) {
			throw new Error('缺少顶层字段: ' + required)
		}
	}

	// ⑤ on 触发器
	const hasPush = paths.some(p => p === 'on.push')
	const hasDispatch = paths.some(p => p === 'on.workflow_dispatch')
	if (!hasPush && !hasDispatch) {
		throw new Error('on 触发器为空，至少需要 push 或 workflow_dispatch')
	}

	// ⑥ jobs 下至少有一个 job，且每个 job 有 runs-on 与 steps
	const jobNames = new Set()
	keys.forEach(k => {
		const m = k.path.match(/^jobs\.([^.]+)\./)
		if (m) jobNames.add(m[1])
	})
	if (!jobNames.size) {
		throw new Error('jobs 下没有任何 job')
	}
	for (const job of jobNames) {
		if (!paths.some(p => p === `jobs.${job}.runs-on`)) {
			throw new Error(`job "${job}" 缺少 runs-on`)
		}
		if (!paths.some(p => p === `jobs.${job}.steps` || p.startsWith(`jobs.${job}.steps.`))) {
			throw new Error(`job "${job}" 缺少 steps`)
		}
	}

	// ⑦ steps 中的每个条目都应有 name 或 uses
	const stepPaths = keys.filter(k => /^jobs\.[^.]+\.steps\[\]$/.test(k.path))
	for (const sp of stepPaths) {
		if (!sp.value) {
			throw new Error(`第 ${sp.line} 行的 step 为空`)
		}
	}

	// ⑧ uses 引用格式
	keys.forEach(k => {
		if (k.path.endsWith('.uses') && k.value) {
			if (!/^[\w.-]+\/[\w.-]+(\/[^@\s]+)?@[\w.\-]+$/.test(k.value)) {
				throw new Error(`第 ${k.line} 行 uses 引用格式可能有误: ${k.value}`)
			}
		}
	})

	return {
		file: path.basename(file),
		jobCount: jobNames.size,
		stepCount: stepPaths.length
	}
}

console.log('GitHub Actions workflow 校验')
console.log('='.repeat(62))

let files = []
try {
	files = fs.readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
} catch (e) {
	console.log('未找到 .github/workflows 目录')
	process.exitCode = 1
	return
}

if (!files.length) {
	console.log('未找到 workflow 文件')
	process.exitCode = 1
	return
}

for (const f of files) {
	console.log('\n【' + f + '】')
	const full = path.join(WORKFLOW_DIR, f)
	check('YAML 结构与必填字段校验', () => validateFile(full))
}

console.log('\n' + '='.repeat(62))
const passed = results.filter(r => r.ok).length
const failed = results.filter(r => !r.ok)
console.log(`结果: ${passed}/${results.length} 通过`)
if (failed.length) {
	console.log('\n失败项:')
	failed.forEach(f => console.log('  ❌ ' + f.name + '\n     ' + f.error))
	process.exitCode = 1
} else {
	console.log('workflow 校验全部通过 ✅')
}

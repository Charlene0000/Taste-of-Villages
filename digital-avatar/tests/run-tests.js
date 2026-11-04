#!/usr/bin/env node
'use strict'

/**
 * 数字人模块单元测试运行器（Sprint 3）
 *
 * 零依赖实现，与 agent/tests/run-tests.js 保持同一套框架。
 *
 * 用法：node digital-avatar/tests/run-tests.js
 */

const path = require('path')

const suites = []
let currentSuite = null

global.describe = function (name, fn) {
	currentSuite = { name, tests: [] }
	suites.push(currentSuite)
	fn()
	currentSuite = null
}

global.test = function (name, fn) {
	if (!currentSuite) {
		currentSuite = { name: 'default', tests: [] }
		suites.push(currentSuite)
	}
	currentSuite.tests.push({ name, fn })
}

const testFiles = [
	path.join(__dirname, 'lipsync.test.js'),
	path.join(__dirname, 'controller.test.js')
]

const loadErrors = []
for (const f of testFiles) {
	try {
		require(f)
	} catch (e) {
		loadErrors.push({ file: path.basename(f), error: e.message })
		console.error(`加载测试文件失败: ${f}\n`, e.message)
	}
}

async function run () {
	console.log('数字人交互层单元测试')
	console.log('='.repeat(62))

	let passed = 0
	const failures = []

	for (const suite of suites) {
		console.log(`\n【${suite.name}】`)
		for (const t of suite.tests) {
			try {
				await t.fn()
				passed++
				console.log('  ✅ ' + t.name)
			} catch (e) {
				failures.push({ suite: suite.name, name: t.name, error: e.message })
				console.log('  ❌ ' + t.name)
				console.log('     ' + e.message)
			}
		}
	}

	console.log('\n' + '='.repeat(62))
	console.log(`结果: ${passed}/${passed + failures.length} 通过`)

	if (loadErrors.length) {
		console.log(`\n⚠️ 有 ${loadErrors.length} 个测试文件加载失败：`)
		loadErrors.forEach(e => console.log(`  ❌ ${e.file}\n     ${e.error}`))
		process.exitCode = 1
		return
	}

	if (failures.length) {
		console.log('\n失败项:')
		failures.forEach(f => console.log(`  ❌ [${f.suite}] ${f.name}\n     ${f.error}`))
		process.exitCode = 1
	} else {
		console.log('全部通过 ✅')
	}
}

run().catch(e => {
	console.error('测试运行器异常:', e)
	process.exitCode = 1
})

#!/usr/bin/env node
'use strict'

/**
 * Agent 单元测试运行器（Sprint 2）
 *
 * 零依赖实现，不引入 jest / mocha —— 保持「clone 即可运行」的约束。
 *
 * 用法：node agent/tests/run-tests.js
 * 退出码：0 = 全部通过；1 = 存在失败
 */

const path = require('path')

// 极简测试框架
// 注意：必须先定义全局 describe/test，再加载测试文件，
// 否则被测文件在模块顶层调用 describe/test 时会找不到定义。
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

// 加载测试文件
const testFiles = [
	path.join(__dirname, 'planner.test.js'),
	path.join(__dirname, 'executor.test.js'),
	path.join(__dirname, 'fallback.test.js'),
	path.join(__dirname, 'run-agent.test.js')
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

// 执行
async function run () {
	console.log('Agent 编排层单元测试')
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

	// 测试文件加载失败必须导致非零退出码，避免「0 个测试也算通过」的假绿
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

#!/usr/bin/env node
'use strict'

/**
 * 后端测试总入口
 *
 * 依次执行：
 *   ① 缓存与分页单元测试（无需数据库 / 无需启动服务）
 *   ② API 与安全设计测试（需要数据库 + 运行中的服务）
 *
 * API 测试所需的服务器由本脚本自动拉起：
 *   - 复用已在 3000 端口运行的实例（不重复启动）
 *   - 否则 fork 一个子进程，测试结束后再关闭
 *
 * 用法：
 *   cd server
 *   npm test            # 全部
 *   npm run test:api    # 仅 API 测试（要求服务已启动）
 */

const { spawn, fork } = require('child_process')
const path = require('path')
const http = require('http')

const SERVER_DIR = path.join(__dirname, '..')
const PORT = parseInt(process.env.PORT, 10) || 3000

/** 探测 3000 端口是否已有服务在监听 */
function pingServer () {
	return new Promise(resolve => {
		const req = http.request(
			{ hostname: 'localhost', port: PORT, path: '/api/health', method: 'GET', timeout: 1500 },
			res => {
				res.resume()
				resolve(res.statusCode === 200)
			}
		)
		req.on('error', () => resolve(false))
		req.on('timeout', () => { req.destroy(); resolve(false) })
		req.end()
	})
}

/** 运行一个测试脚本，返回退出码 */
function runScript (scriptPath, args = []) {
	return new Promise(resolve => {
		const child = spawn(process.execPath, [scriptPath, ...args], {
			cwd: SERVER_DIR,
			stdio: 'inherit',
			env: Object.assign({}, process.env, { PORT: String(PORT) })
		})
		child.on('exit', code => resolve(code === null ? 1 : code))
		child.on('error', () => resolve(1))
	})
}

/** 启动服务子进程 */
function startServer () {
	const child = fork(path.join(SERVER_DIR, 'src', 'server.js'), [], {
		cwd: SERVER_DIR,
		stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		env: Object.assign({}, process.env, { PORT: String(PORT) })
	})
	child.stdout.on('data', d => process.stdout.write('[server] ' + d))
	child.stderr.on('data', d => process.stderr.write('[server] ' + d))
	return child
}

/** 等待服务就绪 */
async function waitForServer (timeoutMs = 20000) {
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		if (await pingServer()) return true
		await new Promise(r => setTimeout(r, 400))
	}
	return false
}

async function main () {
	let exitCode = 0

	// ---------- ① 单元测试 ----------
	console.log('\n' + '='.repeat(62))
	console.log('【1/2】缓存与分页单元测试')
	console.log('='.repeat(62))
	const unitCode = await runScript(path.join(__dirname, 'cache-pagination.test.js'))
	if (unitCode !== 0) exitCode = unitCode

	// ---------- ② API 测试 ----------
	console.log('\n' + '='.repeat(62))
	console.log('【2/2】API 与安全设计测试')
	console.log('='.repeat(62))

	let serverProcess = null
	const alreadyRunning = await pingServer()
	if (alreadyRunning) {
		console.log('ℹ️  检测到 3000 端口已有服务，直接复用\n')
	} else {
		console.log('⏳ 正在启动测试服务...')
		serverProcess = startServer()
		const ready = await waitForServer()
		if (!ready) {
			console.error('❌ 服务启动超时（可能数据库未初始化：请先执行 npx prisma db push）')
			if (serverProcess) serverProcess.kill()
			process.exit(1)
		}
		console.log('✅ 服务已就绪\n')
	}

	const apiCode = await runScript(path.join(__dirname, 'api.test.js'))

	if (serverProcess) {
		serverProcess.kill()
		await new Promise(r => setTimeout(r, 300))
	}

	if (apiCode !== 0) exitCode = apiCode

	console.log('\n' + '='.repeat(62))
	if (exitCode === 0) {
		console.log('后端全部测试通过 ✅')
	} else {
		console.log('后端测试存在失败项 ❌')
	}
	process.exit(exitCode)
}

main().catch(e => {
	console.error('测试运行异常:', e)
	process.exit(1)
})

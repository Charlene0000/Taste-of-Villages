'use strict'

/**
 * Prisma 客户端单例（自研）
 *
 * 为什么需要单例：PrismaClient 会持有一个连接池，
 * 每次 require 都 new 一个会在热重载时泄漏连接。
 */

const { PrismaClient } = require('@prisma/client')

let prisma = null

function getPrisma () {
	if (!prisma) {
		prisma = new PrismaClient({
			log: process.env.PRISMA_LOG === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error']
		})
	}
	return prisma
}

/**
 * 关闭连接（优雅退出用）
 */
async function disconnect () {
	if (prisma) {
		await prisma.$disconnect()
		prisma = null
	}
}

module.exports = { getPrisma, disconnect }

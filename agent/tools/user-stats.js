'use strict'

/**
 * 工具：查询当前用户的登录统计
 *
 * 数据来源：uni-id-users 中当前用户的 login_count / register_date。
 * 在浏览器/H5 演示环境下没有真实用户上下文，返回脱敏的占位数据，
 * 但**始终返回结构化结果**，不抛异常。
 */

module.exports = {
	name: 'user-stats',
	description: '查询当前用户的登录次数、注册天数与最近登录时间',
	parameters: {
		type: 'object',
		properties: {
			includeDevices: {
				type: 'boolean',
				description: '是否附带当前登录设备数'
			}
		},
		required: []
	},
	handler: async (args, context = {}) => {
		const user = context.user || null

		if (!user) {
			// 无用户上下文（如未登录的演示环境）
			return {
				ok: true,
				loggedIn: false,
				loginCount: 0,
				registerDays: 0,
				lastLoginAt: null,
				deviceCount: null,
				message: '当前未获取到用户信息，请先登录后再查询'
			}
		}

		const loginCount = typeof user.login_count === 'number' ? user.login_count : 0
		const registerDate = user.register_date || user.registerDate || null
		const lastLoginAt = user.last_login_at || user.last_login_date || null

		let registerDays = 0
		if (registerDate) {
			registerDays = Math.max(0, Math.floor((Date.now() - registerDate) / (1000 * 60 * 60 * 24)))
		}

		const result = {
			ok: true,
			loggedIn: true,
			nickname: user.nickname || null,
			loginCount,
			registerDays,
			lastLoginAt,
			message: `你一共登录了 ${loginCount} 次，注册至今 ${registerDays} 天`
		}

		if (args && args.includeDevices) {
			result.deviceCount = Array.isArray(user.token) ? user.token.length : null
		}

		return result
	}
}

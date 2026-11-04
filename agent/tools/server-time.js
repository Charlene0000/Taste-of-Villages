'use strict'

/**
 * 工具：返回服务器时间
 *
 * 用于验证「多工具串行」与「工具结果聚合」链路。
 */

module.exports = {
	name: 'server-time',
	description: '获取当前服务器时间（含 ISO 格式与中文可读格式）',
	parameters: {
		type: 'object',
		properties: {
			format: {
				type: 'string',
				enum: ['iso', 'readable', 'timestamp'],
				description: '返回时间的格式'
			}
		},
		required: []
	},
	handler: async (args = {}) => {
		const now = new Date()
		const format = args.format || 'iso'

		let value
		switch (format) {
			case 'readable':
				value = now.toLocaleString('zh-CN', { hour12: false })
				break
			case 'timestamp':
				value = now.getTime()
				break
			default:
				value = now.toISOString()
		}

		return {
			ok: true,
			format,
			time: value,
			message: `服务器当前时间是 ${value}`
		}
	}
}

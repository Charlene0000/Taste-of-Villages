'use strict'

/**
 * 工具：回显，用于调试链路
 *
 * 用途：验证「参数校验 → 工具执行 → 结果聚合」整条链路是否通畅。
 * 特别地，当传入非字符串类型的 message 时，executor 的参数校验会拦截它，
 * 从而可以验证校验失败时返回的是结构化错误而非异常。
 */

module.exports = {
	name: 'echo',
	description: '回显传入的文本内容（用于调试工具调用链路）',
	parameters: {
		type: 'object',
		properties: {
			message: {
				type: 'string',
				description: '待回显的文本',
				minLength: 1,
				maxLength: 200
			},
			times: {
				type: 'integer',
				description: '重复次数',
				minimum: 1,
				maximum: 5
			}
		},
		required: ['message']
	},
	handler: async (args = {}) => {
		const times = typeof args.times === 'number' ? args.times : 1
		const text = new Array(times).fill(args.message).join(' ')
		return {
			ok: true,
			message: text,
			echoed: args.message,
			times
		}
	}
}

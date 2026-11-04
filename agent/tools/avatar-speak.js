'use strict'

/**
 * 工具：让数字人开口（Agent ↔ 数字人联动的桥梁）
 *
 * 职责：把 Agent 的工具调用，转化为数字人的播报动作。
 *
 * 可用性边界（重要）
 * ------------------
 * 该工具**仅在前端可用**，云函数中不注册。原因：
 *   - AvatarController 依赖 requestAnimationFrame 与 Canvas 上下文，
 *     这是浏览器/App 渲染层的能力，云端不存在；
 *   - 数字人是对当前用户的即时反馈，本就不应在服务端执行。
 *
 * 因此本工具不在 agent/core/index.js 的默认注册集中，
 * 而是由前端在需要时显式注册（见 pages/agent-demo/agent-demo.vue）。
 *
 * 注册方式：
 *
 *   const registry = require('@/agent/tools/index')
 *   const avatarSpeak = require('@/agent/tools/avatar-speak')
 *
 *   // 方式一：注册为普通工具（handler 自行取 controller）
 *   registry.register(avatarSpeak.createTool(() => controller))
 *
 *   // 方式二：注册为绑定式（把 controller 注入闭包）
 *   registry.register(avatarSpeak.createBoundTool(controller))
 */

const DEFAULT_EXPRESSION = 'happy'

/**
 * 创建一个需要运行时注入 controller 的工具定义
 *
 * @param {Function} getController 返回 AvatarController 的函数
 * @returns {Object} 工具定义
 */
function createTool (getController) {
	return {
		name: 'avatar-speak',
		description: '让数字人用口型动画说出指定文本（前端专用，不出声）',
		parameters: {
			type: 'object',
			properties: {
				text: {
					type: 'string',
					description: '要播报的文本',
					minLength: 1,
					maxLength: 200
				},
				expression: {
					type: 'string',
					enum: ['neutral', 'happy', 'thinking', 'surprised'],
					description: '播报时的表情'
				}
			},
			required: ['text']
		},
		handler: async (args = {}, context = {}) => {
			// controller 可以来自注入的 getter，也可以从 context 拿
			const controller = (typeof getController === 'function' ? getController() : null)
				|| context.avatarController
				|| null

			if (!controller) {
				return {
					ok: false,
					spoke: false,
					message: '数字人未就绪（当前环境不支持 Canvas 渲染），已跳过播报'
				}
			}

			const expression = args.expression || DEFAULT_EXPRESSION
			const started = controller.speak(args.text, { expression })

			return {
				ok: true,
				spoke: started,
				expression,
				text: args.text,
				message: started
					? `数字人开始播报：${args.text}`
					: '数字人播报未启动'
			}
		}
	}
}

/**
 * 创建一个绑定了具体 controller 的工具定义
 *
 * @param {Object} controller AvatarController 实例
 * @returns {Object} 工具定义
 */
function createBoundTool (controller) {
	return createTool(() => controller)
}

/**
 * 默认导出（不带 controller 的模板）
 * 说明：直接注册这个模板时，handler 会从 context.avatarController 取 controller。
 */
const tool = createTool(() => null)

module.exports = tool
module.exports.createTool = createTool
module.exports.createBoundTool = createBoundTool
module.exports.DEFAULT_EXPRESSION = DEFAULT_EXPRESSION

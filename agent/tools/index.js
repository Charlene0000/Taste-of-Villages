'use strict'

/**
 * 工具注册表（自研）
 *
 * 每个工具声明四要素：
 *   name        工具唯一标识
 *   description 供 planner 与人阅读的能力描述
 *   parameters  JSON Schema 风格的参数声明
 *   handler     实际执行体，入参为已通过校验的参数对象
 *
 * executor 在调用 handler 前会用 parameters 做类型校验，
 * 校验失败返回结构化错误，而不是抛异常。
 */

/**
 * 轻量 JSON Schema 校验器
 *
 * 支持的类型：string / number / integer / boolean / object / array
 * 支持的约束：required / enum / minimum / maximum / minLength / maxLength
 *
 * @param {Object} schema 参数声明
 * @param {Object} value 实际参数
 * @returns {{ valid: boolean, errors: Array<{field: string, message: string}> }}
 */
function validateParams (schema, value) {
	const errors = []
	const params = schema || {}
	const input = value && typeof value === 'object' ? value : {}

	// required 检查
	const required = params.required || []
	for (const field of required) {
		if (input[field] === undefined || input[field] === null || input[field] === '') {
			errors.push({ field, message: `缺少必填参数: ${field}` })
		}
	}

	// 类型与约束检查
	for (const field of Object.keys(params.properties || {})) {
		const spec = params.properties[field]
		const v = input[field]
		if (v === undefined || v === null) continue

		const typeOk = checkType(spec.type, v)
		if (!typeOk) {
			errors.push({ field, message: `参数 ${field} 类型应为 ${spec.type}，实际为 ${typeof v}` })
			continue
		}

		if (spec.enum && spec.enum.indexOf(v) === -1) {
			errors.push({ field, message: `参数 ${field} 必须是 ${spec.enum.join(' / ')} 之一` })
		}
		if (spec.minimum !== undefined && typeof v === 'number' && v < spec.minimum) {
			errors.push({ field, message: `参数 ${field} 不能小于 ${spec.minimum}` })
		}
		if (spec.maximum !== undefined && typeof v === 'number' && v > spec.maximum) {
			errors.push({ field, message: `参数 ${field} 不能大于 ${spec.maximum}` })
		}
		if (spec.minLength !== undefined && typeof v === 'string' && v.length < spec.minLength) {
			errors.push({ field, message: `参数 ${field} 长度不能小于 ${spec.minLength}` })
		}
		if (spec.maxLength !== undefined && typeof v === 'string' && v.length > spec.maxLength) {
			errors.push({ field, message: `参数 ${field} 长度不能大于 ${spec.maxLength}` })
		}
	}

	return { valid: errors.length === 0, errors }
}

function checkType (type, v) {
	switch (type) {
		case 'string': return typeof v === 'string'
		case 'number': return typeof v === 'number' && !Number.isNaN(v)
		case 'integer': return typeof v === 'number' && Number.isInteger(v)
		case 'boolean': return typeof v === 'boolean'
		case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v)
		case 'array': return Array.isArray(v)
		default: return true
	}
}

/** 工具注册表 */
const registry = new Map()

/**
 * 注册一个工具
 * @param {Object} tool 工具定义
 */
function register (tool) {
	if (!tool || !tool.name) {
		throw new Error('工具必须包含 name')
	}
	if (typeof tool.handler !== 'function') {
		throw new Error(`工具 ${tool.name} 必须包含 handler 函数`)
	}
	registry.set(tool.name, Object.assign({
		description: '',
		parameters: { type: 'object', properties: {}, required: [] }
	}, tool))
}

/**
 * 批量注册
 * @param {Array<Object>} tools
 */
function registerAll (tools) {
	for (const t of tools || []) register(t)
}

/**
 * 获取工具
 */
function get (name) {
	return registry.get(name) || null
}

/**
 * 列出所有工具的能力描述（用于 fallback 能力清单）
 * @returns {Array<{name: string, description: string, required: Array<string>}>}
 */
function listCapabilities () {
	return Array.from(registry.values()).map(t => ({
		name: t.name,
		description: t.description,
		required: (t.parameters && t.parameters.required) || []
	}))
}

/**
 * 清空注册表（测试用）
 */
function clear () {
	registry.clear()
}

/**
 * 校验参数并返回结构化错误
 */
function validate (name, args) {
	const tool = registry.get(name)
	if (!tool) {
		return {
			valid: false,
			errors: [{ field: 'name', message: `未注册的工具: ${name}` }]
		}
	}
	return validateParams(tool.parameters, args)
}

module.exports = {
	register,
	registerAll,
	get,
	listCapabilities,
	clear,
	validate,
	validateParams,
	checkType
}

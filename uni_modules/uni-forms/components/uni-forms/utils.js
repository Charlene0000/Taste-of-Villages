
export const deepCopy = (val) => {
	return JSON.parse(JSON.stringify(val))
}

export const typeFilter = (format) => {
	return format === 'int' || format === 'double' || format === 'number' || format === 'timestamp';
}


export const getValue = (key, value, rules) => {
	const isRuleNumType = rules.find(val => val.format && typeFilter(val.format));
	const isRuleBoolType = rules.find(val => (val.format && val.format === 'boolean') || val.format === 'bool');
	
	if (!!isRuleNumType) {
		if (!value && value !== 0) {
			value = null
		} else {
			value = isNumber(Number(value)) ? Number(value) : value
		}
	}

	
	if (!!isRuleBoolType) {
		value = isBoolean(value) ? value : false
	}

	return value;
}


export const setDataValue = (field, formdata, value) => {
	formdata[field] = value
	return value || ''
}


export const getDataValue = (field, data) => {
	return objGet(data, field)
}


export const getDataValueType = (field, data) => {
	const value = getDataValue(field, data)
	return {
		type: type(value),
		value
	}
}


export const realName = (name, data = {}) => {
	const base_name = _basePath(name)
	if (typeof base_name === 'object' && Array.isArray(base_name) && base_name.length > 1) {
		const realname = base_name.reduce((a, b) => a += `#${b}`, '_formdata_')
		return realname
	}
	return base_name[0] || name
}


export const isRealName = (name) => {
	const reg = /^_formdata_#*/
	return reg.test(name)
}


export const rawData = (object = {}, name) => {
	let newData = JSON.parse(JSON.stringify(object))
	let formData = {}
	for(let i in newData){
		let path = name2arr(i)
		objSet(formData,path,newData[i])
	}
	return formData
}


export const name2arr = (name) => {
	let field = name.replace('_formdata_#', '')
	field = field.split('#').map(v => (isNumber(v) ? Number(v) : v))
	return field
}


export const objSet = (object, path, value) => {
	if (typeof object !== 'object') return object;
	_basePath(path).reduce((o, k, i, _) => {
		if (i === _.length - 1) { 
			
			o[k] = value
			return null
		} else if (k in o) { 
			
			return o[k]
		} else { 
			
			o[k] = /^[0-9]{1,}$/.test(_[i + 1]) ? [] : {}
			return o[k]
		}
	}, object)
	
	return object;
}


function _basePath(path) {
	
	if (Array.isArray(path)) return path
	
	return path.replace(/\[/g, '.').replace(/\]/g, '').split('.')
}


export const objGet = (object, path, defaultVal = 'undefined') => {
	
	let newPath = _basePath(path)
	
	let val = newPath.reduce((o, k) => {
		return (o || {})[k]
	}, object);
	return !val || val !== undefined ? val : defaultVal
}



export const isNumber = (num) => {
	return !isNaN(Number(num))
}


export const isBoolean = (bool) => {
	return (typeof bool === 'boolean')
}

export const isRequiredField = (rules) => {
	let isNoField = false;
	for (let i = 0; i < rules.length; i++) {
		const ruleData = rules[i];
		if (ruleData.required) {
			isNoField = true;
			break;
		}
	}
	return isNoField;
}



export const type = (obj) => {
	var class2type = {};

	
	"Boolean Number String Function Array Date RegExp Object Error".split(" ").map(function(item, index) {
		class2type["[object " + item + "]"] = item.toLowerCase();
	})
	if (obj == null) {
		return obj + "";
	}
	return typeof obj === "object" || typeof obj === "function" ?
		class2type[Object.prototype.toString.call(obj)] || "object" :
		typeof obj;
}


export const isEqual = (a, b) => {
	
	if (a === b) {
		
		return a !== 0 || 1 / a === 1 / b;
	}
	
	if (a == null || b == null) {
		return a === b;
	}
	
	var classNameA = toString.call(a),
		classNameB = toString.call(b);
	
	if (classNameA !== classNameB) {
		return false;
	}
	
	switch (classNameA) {
		case '[object RegExp]':
		case '[object String]':
			
			return '' + a === '' + b;
		case '[object Number]':
			
			if (+a !== +a) {
				return +b !== +b;
			}
			
			return +a === 0 ? 1 / +a === 1 / b : +a === +b;
		case '[object Date]':
		case '[object Boolean]':
			return +a === +b;
	}
	
	if (classNameA == '[object Object]') {
		
		var propsA = Object.getOwnPropertyNames(a),
			propsB = Object.getOwnPropertyNames(b);
		if (propsA.length != propsB.length) {
			return false;
		}
		for (var i = 0; i < propsA.length; i++) {
			var propName = propsA[i];
			
			if (a[propName] !== b[propName]) {
				return false;
			}
		}
		return true;
	}
	
	if (classNameA == '[object Array]') {
		if (a.toString() == b.toString()) {
			return true;
		}
		return false;
	}
}

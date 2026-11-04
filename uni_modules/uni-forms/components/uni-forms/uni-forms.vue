<template>
	<view class="uni-forms">
		<form>
			<slot></slot>
		</form>
	</view>
</template>

<script>
	import Validator from './validate.js';
	import {
		deepCopy,
		getValue,
		isRequiredField,
		setDataValue,
		getDataValue,
		realName,
		isRealName,
		rawData,
		isEqual
	} from './utils.js'

	
	
	import Vue from 'vue';
	Vue.prototype.binddata = function(name, value, formName) {
		if (formName) {
			this.$refs[formName].setValue(name, value);
		} else {
			let formVm;
			for (let i in this.$refs) {
				const vm = this.$refs[i];
				if (vm && vm.$options && vm.$options.name === 'uniForms') {
					formVm = vm;
					break;
				}
			}
			if (!formVm) return console.error('当前 uni-froms 组件缺少 ref 属性');
			formVm.setValue(name, value);
		}
	};
	
	
	export default {
		name: 'uniForms',
		emits: ['validate', 'submit'],
		options: {
			virtualHost: true
		},
		props: {
			
			value: {
				type: Object,
				default () {
					return null;
				}
			},
			
			modelValue: {
				type: Object,
				default () {
					return null;
				}
			},
			
			model: {
				type: Object,
				default () {
					return null;
				}
			},
			
			rules: {
				type: Object,
				default () {
					return {};
				}
			},
			
			errShowType: {
				type: String,
				default: 'undertext'
			},
			
			validateTrigger: {
				type: String,
				default: 'submit'
			},
			
			labelPosition: {
				type: String,
				default: 'left'
			},
			
			labelWidth: {
				type: [String, Number],
				default: ''
			},
			
			labelAlign: {
				type: String,
				default: 'left'
			},
			border: {
				type: Boolean,
				default: false
			}
		},
		provide() {
			return {
				uniForm: this
			}
		},
		data() {
			return {
				
				formData: {},
				formRules: {}
			};
		},
		computed: {
			
			localData() {
				const localVal = this.model || this.modelValue || this.value
				if (localVal) {
					return deepCopy(localVal)
				}
				return {}
			}
		},
		watch: {
			
			
			
			rules: {
				handler: function(val, oldVal) {
					this.setRules(val)
				},
				deep: true,
				immediate: true
			}
		},
		created() {
			
			let getbinddata = getApp().$vm.$.appContext.config.globalProperties.binddata
			if (!getbinddata) {
				getApp().$vm.$.appContext.config.globalProperties.binddata = function(name, value, formName) {
					if (formName) {
						this.$refs[formName].setValue(name, value);
					} else {
						let formVm;
						for (let i in this.$refs) {
							const vm = this.$refs[i];
							if (vm && vm.$options && vm.$options.name === 'uniForms') {
								formVm = vm;
								break;
							}
						}
						if (!formVm) return console.error('当前 uni-froms 组件缺少 ref 属性');
						formVm.setValue(name, value);
					}
				}
			}
			

			
			this.childrens = []
			
			this.inputChildrens = []
			this.setRules(this.rules)
		},
		methods: {
			
			setRules(rules) {
				
				this.formRules = Object.assign({}, this.formRules, rules)
				
				this.validator = new Validator(rules);
			},

			
			setValue(key, value) {
				let example = this.childrens.find(child => child.name === key);
				if (!example) return null;
				this.formData[key] = getValue(key, value, (this.formRules[key] && this.formRules[key].rules) || [])
				return example.onFieldChange(this.formData[key]);
			},

			
			validate(keepitem, callback) {
				return this.checkAll(this.formData, keepitem, callback);
			},

			
			validateField(props = [], callback) {
				props = [].concat(props);
				let invalidFields = {};
				this.childrens.forEach(item => {
					const name = realName(item.name)
					if (props.indexOf(name) !== -1) {
						invalidFields = Object.assign({}, invalidFields, {
							[name]: this.formData[name]
						});
					}
				});
				return this.checkAll(invalidFields, [], callback);
			},

			
			clearValidate(props = []) {
				props = [].concat(props);
				this.childrens.forEach(item => {
					if (props.length === 0) {
						item.errMsg = '';
					} else {
						const name = realName(item.name)
						if (props.indexOf(name) !== -1) {
							item.errMsg = '';
						}
					}
				});
			},

			
			submit(keepitem, callback, type) {
				for (let i in this.dataValue) {
					const itemData = this.childrens.find(v => v.name === i);
					if (itemData) {
						if (this.formData[i] === undefined) {
							this.formData[i] = this._getValue(i, this.dataValue[i]);
						}
					}
				}

				if (!type) {
					console.warn('submit 方法即将废弃，请使用validate方法代替！');
				}

				return this.checkAll(this.formData, keepitem, callback, 'submit');
			},

			
			async checkAll(invalidFields, keepitem, callback, type) {
				
				if (!this.validator) return
				let childrens = []
				
				for (let i in invalidFields) {
					const item = this.childrens.find(v => realName(v.name) === i)
					if (item) {
						childrens.push(item)
					}
				}

				
				if (!callback && typeof keepitem === 'function') {
					callback = keepitem;
				}

				let promise;
				
				if (!callback && typeof callback !== 'function' && Promise) {
					promise = new Promise((resolve, reject) => {
						callback = function(valid, invalidFields) {
							!valid ? resolve(invalidFields) : reject(valid);
						};
					});
				}

				let results = [];
				
				let tempFormData = JSON.parse(JSON.stringify(invalidFields))
				
				for (let i in childrens) {
					const child = childrens[i]
					let name = realName(child.name);
					const result = await child.onFieldChange(tempFormData[name]);
					if (result) {
						results.push(result);
						
						if (this.errShowType === 'toast' || this.errShowType === 'modal') break;
					}
				}


				if (Array.isArray(results)) {
					if (results.length === 0) results = null;
				}
				if (Array.isArray(keepitem)) {
					keepitem.forEach(v => {
						let vName = realName(v);
						let value = getDataValue(v, this.localData)
						if (value !== undefined) {
							tempFormData[vName] = value
						}
					});
				}

				
				if (type === 'submit') {
					this.$emit('submit', {
						detail: {
							value: tempFormData,
							errors: results
						}
					});
				} else {
					this.$emit('validate', results);
				}

				
				let resetFormData = {}
				resetFormData = rawData(tempFormData, this.name)
				callback && typeof callback === 'function' && callback(results, resetFormData);

				if (promise && callback) {
					return promise;
				} else {
					return null;
				}

			},

			
			validateCheck(result) {
				this.$emit('validate', result);
			},
			_getValue: getValue,
			_isRequiredField: isRequiredField,
			_setDataValue: setDataValue,
			_getDataValue: getDataValue,
			_realName: realName,
			_isRealName: isRealName,
			_isEqual: isEqual
		}
	};
</script>

<style lang="scss">
	.uni-forms {}
</style>

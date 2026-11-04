<template>
	<view class="uni-forms-item"
		:class="['is-direction-' + localLabelPos ,border?'uni-forms-item--border':'' ,border && isFirstBorder?'is-first-border':'']">
		<slot name="label">
			<view class="uni-forms-item__label" :class="{'no-label':!label && !required}"
				:style="{width:localLabelWidth,justifyContent: localLabelAlign}">
				<text v-if="required" class="is-required">*</text>
				<text>{{label}}</text>
			</view>
		</slot>
		
		<view class="uni-forms-item__content">
			<slot></slot>
			<view class="uni-forms-item__error" :class="{'msg--active':msg}">
				<text>{{msg}}</text>
			</view>
		</view>
		
		
		<view class="uni-forms-item__nuve-content">
			<view class="uni-forms-item__content">
				<slot></slot>
			</view>
			<view class="uni-forms-item__error" :class="{'msg--active':msg}">
				<text class="error-text">{{msg}}</text>
			</view>
		</view>
		
	</view>
</template>

<script>
	

	export default {
		name: 'uniFormsItem',
		options: {
			virtualHost: true
		},
		provide() {
			return {
				uniFormItem: this
			}
		},
		inject: {
			form: {
				from: 'uniForm',
				default: null
			},
		},
		props: {
			
			rules: {
				type: Array,
				default () {
					return null;
				}
			},
			
			name: {
				type: [String, Array],
				default: ''
			},
			required: {
				type: Boolean,
				default: false
			},
			label: {
				type: String,
				default: ''
			},
			
			labelWidth: {
				type: [String, Number],
				default: ''
			},
			
			labelAlign: {
				type: String,
				default: ''
			},
			
			errorMessage: {
				type: [String, Boolean],
				default: ''
			},
			
			
			
			
			
			
			
			
			
			
			
			leftIcon: String,
			iconColor: {
				type: String,
				default: '#606266'
			},
		},
		data() {
			return {
				errMsg: '',
				userRules: null,
				localLabelAlign: 'left',
				localLabelWidth: '65px',
				localLabelPos: 'left',
				border: false,
				isFirstBorder: false,
			};
		},
		computed: {
			
			msg() {
				return this.errorMessage || this.errMsg;
			}
		},
		watch: {
			
			'form.formRules'(val) {
				
				
				this.init()
				
			},
			'form.labelWidth'(val) {
				
				this.localLabelWidth = this._labelWidthUnit(val)

			},
			'form.labelPosition'(val) {
				
				this.localLabelPos = this._labelPosition()
			},
			'form.labelAlign'(val) {

			}
		},
		created() {
			this.init(true)
			if (this.name && this.form) {
				
				
				this.$watch('form.formRules', () => {
					this.init()
				})
				

				
				this.$watch(
					() => {
						const val = this.form._getDataValue(this.name, this.form.localData)
						return val
					},
					(value, oldVal) => {
						const isEqual = this.form._isEqual(value, oldVal)
						
						
						
						if (!isEqual) {
							const val = this.itemSetValue(value)
							this.onFieldChange(val, false)
						}
					}, {
						immediate: false
					}
				);
			}

		},
		
		destroyed() {
			if (this.__isUnmounted) return
			this.unInit()
		},
		
		
		unmounted() {
			this.__isUnmounted = true
			this.unInit()
		},
		
		methods: {
			
			setRules(rules = null) {
				this.userRules = rules
				this.init(false)
			},
			
			setValue() {
				
			},
			
			async onFieldChange(value, formtrigger = true) {
				const {
					formData,
					localData,
					errShowType,
					validateCheck,
					validateTrigger,
					_isRequiredField,
					_realName
				} = this.form
				const name = _realName(this.name)
				if (!value) {
					value = this.form.formData[name]
				}
				
				

				
				const ruleLen = this.itemRules.rules && this.itemRules.rules.length
				if (!this.validator || !ruleLen || ruleLen === 0) return;

				
				
				const isRequiredField = _isRequiredField(this.itemRules.rules || []);
				let result = null;
				
				if (validateTrigger === 'bind' || formtrigger) {
					
					result = await this.validator.validateUpdate({
							[name]: value
						},
						formData
					);

					
					if (!isRequiredField && (value === undefined || value === '')) {
						result = null;
					}

					
					if (result && result.errorMessage) {
						if (errShowType === 'undertext') {
							
							this.errMsg = !result ? '' : result.errorMessage;
						}
						if (errShowType === 'toast') {
							uni.showToast({
								title: result.errorMessage || '校验错误',
								icon: 'none'
							});
						}
						if (errShowType === 'modal') {
							uni.showModal({
								title: '提示',
								content: result.errorMessage || '校验错误'
							});
						}
					} else {
						this.errMsg = ''
					}
					
					validateCheck(result ? result : null)
				} else {
					this.errMsg = ''
				}
				return result ? result : null;
			},
			
			init(type = false) {
				const {
					validator,
					formRules,
					childrens,
					formData,
					localData,
					_realName,
					labelWidth,
					_getDataValue,
					_setDataValue
				} = this.form || {}
				
				this.localLabelAlign = this._justifyContent()
				
				this.localLabelWidth = this._labelWidthUnit(labelWidth)
				
				this.localLabelPos = this._labelPosition()
				
				this.form && type && childrens.push(this)

				if (!validator || !formRules) return
				
				if (!this.form.isFirstBorder) {
					this.form.isFirstBorder = true;
					this.isFirstBorder = true;
				}

				
				if (this.group) {
					if (!this.group.isFirstBorder) {
						this.group.isFirstBorder = true;
						this.isFirstBorder = true;
					}
				}
				this.border = this.form.border;
				
				const name = _realName(this.name)
				const itemRule = this.userRules || this.rules
				if (typeof formRules === 'object' && itemRule) {
					
					formRules[name] = {
						rules: itemRule
					}
					validator.updateSchema(formRules);
				}
				
				const itemRules = formRules[name] || {}
				this.itemRules = itemRules
				
				this.validator = validator
				
				this.itemSetValue(_getDataValue(this.name, localData))
			},
			unInit() {
				if (this.form) {
					const {
						childrens,
						formData,
						_realName
					} = this.form
					childrens.forEach((item, index) => {
						if (item === this) {
							this.form.childrens.splice(index, 1)
							delete formData[_realName(item.name)]
						}
					})
				}
			},
			
			itemSetValue(value) {
				const name = this.form._realName(this.name)
				const rules = this.itemRules.rules || []
				const val = this.form._getValue(name, value, rules)
				this.form._setDataValue(name, this.form.formData, val)
				return val
			},

			
			clearValidate() {
				this.errMsg = '';
			},

			
			_isRequired() {
				
				
				
				
				
				
				
				return this.required
			},

			
			_justifyContent() {
				if (this.form) {
					const {
						labelAlign
					} = this.form
					let labelAli = this.labelAlign ? this.labelAlign : labelAlign;
					if (labelAli === 'left') return 'flex-start';
					if (labelAli === 'center') return 'center';
					if (labelAli === 'right') return 'flex-end';
				}
				return 'flex-start';
			},
			
			_labelWidthUnit(labelWidth) {

				
				
				
				
				return this.num2px(this.labelWidth ? this.labelWidth : (labelWidth || (this.label ? 65 : 'auto')))
				
				
			},
			
			_labelPosition() {
				if (this.form) return this.form.labelPosition || 'left'
				return 'left'

			},

			
			isTrigger(rule, itemRlue, parentRule) {
				
				if (rule === 'submit' || !rule) {
					if (rule === undefined) {
						if (itemRlue !== 'bind') {
							if (!itemRlue) {
								return parentRule === '' ? 'bind' : 'submit';
							}
							return 'submit';
						}
						return 'bind';
					}
					return 'submit';
				}
				return 'bind';
			},
			num2px(num) {
				if (typeof num === 'number') {
					return `${num}px`
				}
				return num
			}
		}
	};
</script>

<style lang="scss">
	.uni-forms-item {
		position: relative;
		display: flex;
		
		
		padding-bottom: 22px;
		
		
		margin-bottom: 22px;
		
		flex-direction: row;

		&__label {
			display: flex;
			flex-direction: row;
			align-items: center;
			text-align: left;
			font-size: 14px;
			color: #606266;
			height: 36px;
			padding: 0 12px 0 0;
			
			vertical-align: middle;
			flex-shrink: 0;
			

			
			box-sizing: border-box;

			
			&.no-label {
				padding: 0;
			}
		}

		&__content {
			
			
			
			
			position: relative;
			font-size: 14px;
			flex: 1;
			
			box-sizing: border-box;
			
			flex-direction: row;

			
			
			&>uni-easyinput,
			&>uni-data-picker {
				width: 100%;
			}

			

		}

		& .uni-forms-item__nuve-content {
			display: flex;
			flex-direction: column;
			flex: 1;
		}

		&__error {
			color: #f56c6c;
			font-size: 12px;
			line-height: 1;
			padding-top: 4px;
			position: absolute;
			
			top: 100%;
			left: 0;
			transition: transform 0.3s;
			transform: translateY(-100%);
			
			
			bottom: 5px;
			

			opacity: 0;

			.error-text {
				
				color: #f56c6c;
				font-size: 12px;
			}

			&.msg--active {
				opacity: 1;
				transform: translateY(0%);
			}
		}

		
		&.is-direction-left {
			flex-direction: row;
		}

		&.is-direction-top {
			flex-direction: column;

			.uni-forms-item__label {
				padding: 0 0 8px;
				line-height: 1.5715;
				text-align: left;
				
				white-space: initial;
				
			}
		}

		.is-required {
			
			color: #dd524d;
			font-weight: bold;
		}
	}


	.uni-forms-item--border {
		margin-bottom: 0;
		padding: 10px 0;
		
		border-top: 1px #eee solid;

		
		.uni-forms-item__content {
			flex-direction: column;
			justify-content: flex-start;
			align-items: flex-start;

			.uni-forms-item__error {
				position: relative;
				top: 5px;
				left: 0;
				padding-top: 0;
			}
		}

		

		
		display: flex;
		flex-direction: column;

		.uni-forms-item__error {
			position: relative;
			top: 0px;
			left: 0;
			padding-top: 0;
			margin-top: 5px;
		}

		

	}

	.is-first-border {
		
		border: none;
		
		
		border-width: 0;
		
	}
</style>

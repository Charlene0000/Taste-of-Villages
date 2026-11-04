<template>
	<view class="uni-easyinput" :class="{ 'uni-easyinput-error': msg }" :style="boxStyle">
		<view class="uni-easyinput__content" :class="inputContentClass" :style="inputContentStyle">
			<uni-icons v-if="prefixIcon" class="content-clear-icon" :type="prefixIcon" color="#c0c4cc" @click="onClickIcon('prefix')" size="22"></uni-icons>
			<textarea
				v-if="type === 'textarea'"
				class="uni-easyinput__content-textarea"
				:class="{ 'input-padding': inputBorder }"
				:name="name"
				:value="val"
				:placeholder="placeholder"
				:placeholderStyle="placeholderStyle"
				:disabled="disabled"
				placeholder-class="uni-easyinput__placeholder-class"
				:maxlength="inputMaxlength"
				:focus="focused"
				:autoHeight="autoHeight"
				@input="onInput"
				@blur="_Blur"
				@focus="_Focus"
				@confirm="onConfirm"
        @keyboardheightchange="onkeyboardheightchange"
			></textarea>
			<input
				v-else
				:type="type === 'password' ? 'text' : type"
				class="uni-easyinput__content-input"
				:style="inputStyle"
				:name="name"
				:value="val"
				:password="!showPassword && type === 'password'"
				:placeholder="placeholder"
				:placeholderStyle="placeholderStyle"
				placeholder-class="uni-easyinput__placeholder-class"
				:disabled="disabled"
				:maxlength="inputMaxlength"
				:focus="focused"
				:confirmType="confirmType"
				@focus="_Focus"
				@blur="_Blur"
				@input="onInput"
				@confirm="onConfirm"
        @keyboardheightchange="onkeyboardheightchange"
			/>
			<template v-if="type === 'password' && passwordIcon">
				
				<uni-icons
					v-if="isVal"
					class="content-clear-icon"
					:class="{ 'is-textarea-icon': type === 'textarea' }"
					:type="showPassword ? 'eye-slash-filled' : 'eye-filled'"
					:size="22"
					:color="focusShow ? primaryColor : '#c0c4cc'"
					@click="onEyes"
				></uni-icons>
			</template>
			<template v-else-if="suffixIcon">
				<uni-icons v-if="suffixIcon" class="content-clear-icon" :type="suffixIcon" color="#c0c4cc" @click="onClickIcon('suffix')" size="22"></uni-icons>
			</template>
			<template v-else>
				<uni-icons
					v-if="clearable && isVal && !disabled && type !== 'textarea'"
					class="content-clear-icon"
					:class="{ 'is-textarea-icon': type === 'textarea' }"
					type="clear"
					:size="clearSize"
					:color="msg ? '#dd524d' : focusShow ? primaryColor : '#c0c4cc'"
					@click="onClear"
				></uni-icons>
			</template>
			<slot name="right"></slot>
		</view>
	</view>
</template>

<script>

function obj2strClass(obj) {
	let classess = '';
	for (let key in obj) {
		const val = obj[key];
		if (val) {
			classess += `${key} `;
		}
	}
	return classess;
}

function obj2strStyle(obj) {
	let style = '';
	for (let key in obj) {
		const val = obj[key];
		style += `${key}:${val};`;
	}
	return style;
}
export default {
	name: 'uni-easyinput',
	emits: ['click', 'iconClick', 'update:modelValue', 'input', 'focus', 'blur', 'confirm', 'clear', 'eyes', 'change'],
	model: {
		prop: 'modelValue',
		event: 'update:modelValue'
	},
	options: {
		virtualHost: true
	},
	inject: {
		form: {
			from: 'uniForm',
			default: null
		},
		formItem: {
			from: 'uniFormItem',
			default: null
		}
	},
	props: {
		name: String,
		value: [Number, String],
		modelValue: [Number, String],
		type: {
			type: String,
			default: 'text'
		},
		clearable: {
			type: Boolean,
			default: true
		},
		autoHeight: {
			type: Boolean,
			default: false
		},
		placeholder: {
			type: String,
			default: ' '
		},
		placeholderStyle: String,
		focus: {
			type: Boolean,
			default: false
		},
		disabled: {
			type: Boolean,
			default: false
		},
		maxlength: {
			type: [Number, String],
			default: 140
		},
		confirmType: {
			type: String,
			default: 'done'
		},
		clearSize: {
			type: [Number, String],
			default: 24
		},
		inputBorder: {
			type: Boolean,
			default: true
		},
		prefixIcon: {
			type: String,
			default: ''
		},
		suffixIcon: {
			type: String,
			default: ''
		},
		trim: {
			type: [Boolean, String],
			default: true
		},
		passwordIcon: {
			type: Boolean,
			default: true
		},
		primaryColor: {
			type: String,
			default: '#2979ff'
		},
		styles: {
			type: Object,
			default() {
				return {
					color: '#333',
					backgroundColor: '#fff',
					disableColor: '#F7F6F6',
					borderColor: '#e5e5e5'
				};
			}
		},
		errorMessage: {
			type: [String, Boolean],
			default: ''
		}
	},
	data() {
		return {
			focused: false,
			val: '',
			showMsg: '',
			border: false,
			isFirstBorder: false,
			showClearIcon: false,
			showPassword: false,
			focusShow: false,
			localMsg: '',
			isEnter: false 
		};
	},
	computed: {
		
		isVal() {
			const val = this.val;
			
			if (val || val === 0) {
				return true;
			}
			return false;
		},

		msg() {
			
			
			
			
			
			return this.localMsg || this.errorMessage;
		},
		
		inputMaxlength() {
			return Number(this.maxlength);
		},

		
		boxStyle() {
			return `color:${this.inputBorder && this.msg ? '#e43d33' : this.styles.color};`;
		},
		
		inputContentClass() {
			return obj2strClass({
				'is-input-border': this.inputBorder,
				'is-input-error-border': this.inputBorder && this.msg,
				'is-textarea': this.type === 'textarea',
				'is-disabled': this.disabled,
				'is-focused': this.focusShow
			});
		},
		inputContentStyle() {
			const focusColor = this.focusShow ? this.primaryColor : this.styles.borderColor;
			const borderColor = this.inputBorder && this.msg ? '#dd524d' : focusColor;
			return obj2strStyle({
				'border-color': borderColor || '#e5e5e5',
				'background-color': this.disabled ? this.styles.disableColor : this.styles.backgroundColor
			});
		},
		
		inputStyle() {
			const paddingRight = this.type === 'password' || this.clearable || this.prefixIcon ? '' : '10px';
			return obj2strStyle({
				'padding-right': paddingRight,
				'padding-left': this.prefixIcon ? '' : '10px'
			});
		}
	},
	watch: {
		value(newVal) {
			this.val = newVal;
		},
		modelValue(newVal) {
			this.val = newVal;
		},
		focus(newVal) {
			this.$nextTick(() => {
				this.focused = this.focus;
				this.focusShow = this.focus;
			});
		}
	},
	created() {
		this.init();
		
		if (this.form && this.formItem) {
			this.$watch('formItem.errMsg', newVal => {
				this.localMsg = newVal;
			});
		}
	},
	mounted() {
		this.$nextTick(() => {
			this.focused = this.focus;
			this.focusShow = this.focus;
		});
	},
	methods: {
		
		init() {
			if (this.value || this.value === 0) {
				this.val = this.value;
			} else if (this.modelValue || this.modelValue === 0 || this.modelValue === '') {
				this.val = this.modelValue;
			} else {
				this.val = null;
			}
		},

		
		onClickIcon(type) {
			this.$emit('iconClick', type);
		},

		
		onEyes() {
			this.showPassword = !this.showPassword;
			this.$emit('eyes', this.showPassword);
		},

		
		onInput(event) {
			let value = event.detail.value;
			
			if (this.trim) {
				if (typeof this.trim === 'boolean' && this.trim) {
					value = this.trimStr(value);
				}
				if (typeof this.trim === 'string') {
					value = this.trimStr(value, this.trim);
				}
			}
			if (this.errMsg) this.errMsg = '';
			this.val = value;
			
			this.$emit('input', value);
			
			this.$emit('update:modelValue', value);
		},

		
		onFocus() {
			this.$nextTick(() => {
				this.focused = true;
			});
			this.$emit('focus', null);
		},

		_Focus(event) {
			this.focusShow = true;
			this.$emit('focus', event);
		},

		
		onBlur() {
			this.focused = false;
			this.$emit('focus', null);
		},
		_Blur(event) {
			let value = event.detail.value;
			this.focusShow = false;
			this.$emit('blur', event);
			
			if (this.isEnter === false) {
				this.$emit('change', this.val);
			}
			
			if (this.form && this.formItem) {
				const { validateTrigger } = this.form;
				if (validateTrigger === 'blur') {
					this.formItem.onFieldChange();
				}
			}
		},

		
		onConfirm(e) {
			this.$emit('confirm', this.val);
			this.isEnter = true;
			this.$emit('change', this.val);
			this.$nextTick(() => {
				this.isEnter = false;
			});
		},

		
		onClear(event) {
			this.val = '';
			
			this.$emit('input', '');
			
			
			this.$emit('update:modelValue', '');
			
			this.$emit('clear');
		},

    
    onkeyboardheightchange(event) {
      this.$emit("keyboardheightchange",event);
    },

		
		trimStr(str, pos = 'both') {
			if (pos === 'both') {
				return str.trim();
			} else if (pos === 'left') {
				return str.trimLeft();
			} else if (pos === 'right') {
				return str.trimRight();
			} else if (pos === 'start') {
				return str.trimStart();
			} else if (pos === 'end') {
				return str.trimEnd();
			} else if (pos === 'all') {
				return str.replace(/\s+/g, '');
			} else if (pos === 'none') {
				return str;
			}
			return str;
		}
	}
};
</script>

<style lang="scss">
$uni-error: #e43d33;
$uni-border-1: #dcdfe6 !default;

.uni-easyinput {
	
	width: 100%;
	
	flex: 1;
	position: relative;
	text-align: left;
	color: #333;
	font-size: 14px;
}

.uni-easyinput__content {
	flex: 1;
	
	width: 100%;
	display: flex;
	box-sizing: border-box;
	
	
	flex-direction: row;
	align-items: center;
	
	border-color: #fff;
	transition-property: border-color;
	transition-duration: 0.3s;
}

.uni-easyinput__content-input {
	
	width: auto;
	
	position: relative;
	overflow: hidden;
	flex: 1;
	line-height: 1;
	font-size: 14px;
	height: 35px;
	
}

.uni-easyinput__placeholder-class {
	color: #999;
	font-size: 12px;
	
}

.is-textarea {
	align-items: flex-start;
}

.is-textarea-icon {
	margin-top: 5px;
}

.uni-easyinput__content-textarea {
	position: relative;
	overflow: hidden;
	flex: 1;
	line-height: 1.5;
	font-size: 14px;
	margin: 6px;
	margin-left: 0;
	height: 80px;
	min-height: 80px;
	
	min-height: 80px;
	width: auto;
	
}

.input-padding {
	padding-left: 10px;
}

.content-clear-icon {
	padding: 0 5px;
}

.label-icon {
	margin-right: 5px;
	margin-top: -1px;
}


.is-input-border {
	
	display: flex;
	box-sizing: border-box;
	
	flex-direction: row;
	align-items: center;
	border: 1px solid $uni-border-1;
	border-radius: 4px;
	
	overflow: hidden;
	
}

.uni-error-message {
	position: absolute;
	bottom: -17px;
	left: 0;
	line-height: 12px;
	color: $uni-error;
	font-size: 12px;
	text-align: left;
}

.uni-error-msg--boeder {
	position: relative;
	bottom: 0;
	line-height: 22px;
}

.is-input-error-border {
	border-color: $uni-error;

	.uni-easyinput__placeholder-class {
		color: mix(#fff, $uni-error, 50%);
	}
}

.uni-easyinput--border {
	margin-bottom: 0;
	padding: 10px 15px;
	
	border-top: 1px #eee solid;
}

.uni-easyinput-error {
	padding-bottom: 0;
}

.is-first-border {
	
	border: none;
	
	
	border-width: 0;
	
}

.is-disabled {
	background-color: #f7f6f6;
	color: #d5d5d5;

	.uni-easyinput__placeholder-class {
		color: #d5d5d5;
		font-size: 12px;
	}
}
</style>

<template>
	<view>
		<uni-captcha :focus="focusCaptchaInput" ref="captcha" scene="send-email-code" v-model="captcha" />
		<view class="box">
			<uni-easyinput :focus="focusEmailCodeInput" @blur="focusEmailCodeInput = false" type="number" class="input-box" :inputBorder="false" v-model="modelValue" maxlength="6"
				placeholder="请输入邮箱验证码">
			</uni-easyinput>
			<view class="short-code-btn" hover-class="hover" @click="start">
				<text class="inner-text" :class="reverseNumber==0?'inner-text-active':''">{{innerText}}</text>
			</view>
		</view>
	</view>
</template>

<script>
	function debounce(func, wait) {
		let timer;
		wait = wait || 500;
		return function() {
			let context = this;
			let args = arguments;
			if (timer) clearTimeout(timer);
			let callNow = !timer;
			timer = setTimeout(() => {
				timer = null;
			}, wait)
			if (callNow) func.apply(context, args);
		}
	}
	
	export default {
		name: "uni-email-code-form",
		model: {
			prop: 'modelValue',
			event: 'update:modelValue'
		},
		props: {
			event: ['update:modelValue'],
			
			count: {
				type: [String, Number],
				default: 60
			},
			
			email: {
				type: [String],
				default: ''
			},
			
			type: {
				type: String,
				default () {
					return 'register'
				}
			},
			
			focusCaptchaInput: {
				type: Boolean,
				default () {
					return false
				}
			},
		},
		data() {
			return {
				captcha: "",
				reverseNumber: 0,
				reverseTimer: null,
				modelValue: "",
				focusEmailCodeInput:false
			};
		},
		watch: {
			captcha(value, oldValue) {
				if (value.length == 4 && oldValue.length != 4) {
					this.start()
				}
			},
			modelValue(value) {
				
				this.$emit('input', value);
				
				this.$emit('update:modelValue', value)
			}
		},
		computed: {
			innerText() {
				if (this.reverseNumber == 0) return "获取邮箱验证码";
				return "重新发送" + '(' + this.reverseNumber + 's)';
			}
		},
		created() {
			this.initClick();
		},
		methods: {
			getImageCaptcha(focus) {
				this.$refs.captcha.getImageCaptcha(focus)
			},
			initClick() {
				this.start = debounce(() => {
					if (this.reverseNumber != 0) return;
					this.sendMsg();
				})
			},
			sendMsg() {
				if (this.captcha.length != 4) {
					this.$refs.captcha.focusCaptchaInput = true
					return uni.showToast({
						title: '请先输入图形验证码',
						icon: 'none',
						duration: 3000
					});
				}
				if(!this.email) return uni.showToast({
					title: "请输入邮箱",
					icon: 'none',
					duration: 3000
				});
				let reg_email = /@/;
				if (!reg_email.test(this.email)) return uni.showToast({
					title: "邮箱格式错误",
					icon: 'none',
					duration: 3000
				});
				const uniIdCo = uniCloud.importObject("uni-id-co", {
					customUI: true
				})
				console.log('sendEmailCode',{
					"email": this.email,
					"scene": this.type,
					"captcha": this.captcha
				});
				uniIdCo.sendEmailCode({
					"email": this.email,
					"scene": this.type,
					"captcha": this.captcha
				}).then(result => {
					uni.showToast({
						title: "邮箱验证码发送成功",
						icon: 'none',
						duration: 3000
					});
					this.reverseNumber = Number(this.count);
					this.getCode();
				}).catch(e => {
					if (e.code == "uni-id-invalid-mail-template") {
						this.modelValue = "123456"
						uni.showToast({
							title: '已启动测试模式,详情【控制台信息】',
							icon: 'none',
							duration: 3000
						});
						console.warn(e.message);
					} else {
						this.getImageCaptcha()
						this.captcha = ""
						uni.showToast({
							title: e.message,
							icon: 'none',
							duration: 3000
						});
					}
				})
			},
			getCode() {
				if (this.reverseNumber == 0) {
					clearTimeout(this.reverseTimer);
					this.reverseTimer = null;
					return;
				}
				this.reverseNumber--;
				this.reverseTimer = setTimeout(() => {
					this.getCode();
				}, 1000)
			}
		}
	}
</script>

<style lang="scss" scoped>
	.box {
		position: relative;
		margin-top: 10px;
	}

	.short-code-btn {
		padding: 0;
		position: absolute;
		top: 0;
		right: 8px;
		width: 260rpx;
		max-width: 130px;
		height: 44px;
		
		display: flex;
		
		justify-content: center;
		align-items: center;
		
	}

	.inner-text {
		font-size: 14px;
		color: #AAAAAA;
	}

	.inner-text-active {
		color: #04498c;
	}

	.captcha {
		width: 350rpx;
	}

	.input-box {
		margin: 0;
		padding: 4px;
		background-color: #F8F8F8;
		font-size: 14px;
	}

	.box ::v-deep .content-clear-icon {
		margin-right: 100px;
	}

	.box {
		
		display: flex;
		
		flex-direction: row;
	}
</style>

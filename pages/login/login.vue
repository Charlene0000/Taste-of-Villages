<template>
	<view class="page">
		<!--
			Sprint 5.2：显式返回按钮
			删掉 uni-id-pages 后本页改用原生导航栏，
			H5/Web 端常不渲染返回按钮 → 死胡同。
			用自研 nav-bar 补一个始终可见的返回入口。
		-->
		<nav-bar title="登录" />

		<view class="header">
			<text class="title">欢迎回来</text>
			<text class="subtitle">登录后即可打卡、签到、兑换特产</text>
		</view>

		<view class="form-card">
			<!-- 手机号 -->
			<view class="field">
				<text class="label">手机号</text>
				<input
					class="input"
					type="number"
					maxlength="11"
					v-model="mobile"
					placeholder="请输入 11 位手机号"
					placeholder-class="ph"
				/>
			</view>

			<!-- 验证码 -->
			<view class="field">
				<text class="label">验证码</text>
				<view class="code-row">
					<input
						class="input code-input"
						type="number"
						maxlength="6"
						v-model="code"
						placeholder="6 位验证码"
						placeholder-class="ph"
						@confirm="submit"
					/>
					<button
						class="code-btn"
						:class="{ disabled: counting > 0 }"
						:disabled="counting > 0 || sending"
						@click="sendCode"
					>{{ counting > 0 ? (counting + 's 后重发') : (sending ? '发送中' : '获取验证码') }}</button>
				</view>
			</view>

			<!-- 开发模式提示 -->
			<view class="dev-tip" v-if="devCode">
				<text class="dev-tip-label">开发模式验证码</text>
				<text class="dev-tip-value">{{ devCode }}</text>
			</view>

			<!-- 错误提示 -->
			<view class="error-box" v-if="errorMsg">
				<text class="error-text">{{ errorMsg }}</text>
			</view>

			<button class="submit-btn" :disabled="submitting" @click="submit">
				{{ submitting ? '登录中...' : '登录 / 注册' }}
			</button>

			<view class="agree">
				<text class="agree-text">登录即代表同意</text>
				<text class="agree-link" @click="showPolicy = true">《用户协议与隐私政策》</text>
			</view>
		</view>

		<!-- 协议弹窗 -->
		<view class="mask" v-if="showPolicy" @click="showPolicy = false">
			<view class="policy-box" @click.stop>
				<text class="policy-title">用户协议与隐私政策</text>
				<scroll-view class="policy-scroll" scroll-y="true">
					<text class="policy-text">
						本应用为乡村美食打卡小程序，仅收集实现功能所必需的最少信息。{'\n\n'}
						· 手机号：用于账号注册登录与身份识别{'\n'}
						· 定位信息：用于打卡时判定你是否在打卡点附近{'\n'}
						· 相机与相册：用于记录打卡照片{'\n'}
						· 昵称与头像：用于展示你在社区中的身份{'\n\n'}
						我们不会将你的信息用于其他用途，也不会向第三方出售。{'\n\n'}
						你可以随时在「我的」页面修改昵称与头像，或注销账号。
					</text>
				</scroll-view>
				<button class="policy-close" @click="showPolicy = false">我知道了</button>
			</view>
		</view>
	</view>
</template>

<script>
import { authApi } from '@/utils/auth.js'
import NavBar from '@/components/nav-bar/nav-bar.vue'

export default {
	components: { NavBar },
	data () {
		return {
			mobile: '',
			code: '',
			sending: false,
			counting: 0,
			submitting: false,
			errorMsg: '',
			devCode: '',
			showPolicy: false,
			// Sprint 5.1：登录成功后要返回的页面（由路由守卫通过 ?redirect= 传入）
			redirect: ''
		}
	},
	onLoad (options) {
		// Sprint 5.1：接收守卫传来的 redirect 参数。
		// 原实现忽略它，登录后只能 navigateBack / reLaunch 到封面页，
		// 用户点「登录」进去后回不到原本想去的页面 —— 表现为「跳转异常」。
		if (options && options.redirect) {
			this.redirect = decodeURIComponent(options.redirect)
			console.log('[login] 登录后将返回:', this.redirect)
		}
	},
	onUnload () {
		if (this.timer) clearInterval(this.timer)
	},
	methods: {
		/**
		 * 发送验证码
		 */
		async sendCode () {
			if (this.sending || this.counting > 0) return

			// 前端先做一次格式校验，减少无谓请求
			if (!/^1[3-9]\d{9}$/.test(this.mobile.trim())) {
				this.errorMsg = '请输入正确的 11 位手机号'
				return
			}

			this.sending = true
			this.errorMsg = ''
			this.devCode = ''

			try {
				const res = await authApi.sendCode(this.mobile.trim())
				// 开发模式后端会返回 devCode
				if (res && res.devCode) {
					this.devCode = res.devCode
				}
				uni.showToast({ title: '验证码已发送', icon: 'none' })
				this.startCountdown()
			} catch (e) {
				this.errorMsg = e && e.message ? e.message : '验证码发送失败'
				if (e && e.errCode === 'auth-sms-too-frequent') {
					// 频控：按后端返回的剩余秒数启动倒计时
					const wait = e.data && e.data.retryAfter ? e.data.retryAfter : 60
					this.startCountdown(wait)
				}
			} finally {
				this.sending = false
			}
		},

		/**
		 * 倒计时
		 */
		startCountdown (seconds = 60) {
			this.counting = seconds
			if (this.timer) clearInterval(this.timer)
			this.timer = setInterval(() => {
				this.counting--
				if (this.counting <= 0) {
					clearInterval(this.timer)
					this.timer = null
				}
			}, 1000)
		},

		/**
		 * 登录 / 注册
		 */
		async submit () {
			if (this.submitting) return

			if (!/^1[3-9]\d{9}$/.test(this.mobile.trim())) {
				this.errorMsg = '请输入正确的 11 位手机号'
				return
			}
			if (!/^\d{6}$/.test(this.code.trim())) {
				this.errorMsg = '请输入 6 位验证码'
				return
			}

			this.submitting = true
			this.errorMsg = ''

			try {
				const res = await authApi.login(this.mobile.trim(), this.code.trim())
				uni.showToast({
					title: res && res.isNewUser ? '注册成功' : '登录成功',
					icon: 'none'
				})

				// Sprint 5.1：优先跳回 redirect 指定的页面；
				// 没有 redirect 时回退到原有逻辑（返回上一页 / 回到封面页）。
				if (this.redirect) {
					const target = this.redirect
					this.redirect = ''
					// redirect 是页面路由（不带前导斜杠），需补全
					const url = target.charAt(0) === '/' ? target : '/' + target
					console.log('[login] 登录成功，跳回:', url)
					uni.redirectTo({
						url,
						fail: (err) => {
							console.warn('[login] redirectTo 失败，改用 reLaunch:', err && err.message)
							uni.reLaunch({ url: '/pages/index/cover' })
						}
					})
					return
				}

				const pages = getCurrentPages()
				if (pages.length > 1) {
					uni.navigateBack()
				} else {
					uni.reLaunch({ url: '/pages/index/cover' })
				}
			} catch (e) {
				this.errorMsg = e && e.message ? e.message : '登录失败'
				if (e && e.errCode === 'auth-code-mismatch' && e.data && e.data.remainingAttempts > 0) {
					this.errorMsg += `（还可尝试 ${e.data.remainingAttempts} 次）`
				}
			} finally {
				this.submitting = false
			}
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #FFFBF0;
	padding: 80rpx 48rpx;
	box-sizing: border-box;
}

.header {
	margin-bottom: 56rpx;
}

.title {
	font-size: 52rpx;
	font-weight: 700;
	color: #5D4037;
	display: block;
}

.subtitle {
	font-size: 26rpx;
	color: #A1887F;
	margin-top: 12rpx;
	display: block;
}

.form-card {
	background: #FFFFFF;
	border-radius: 32rpx;
	padding: 48rpx 40rpx;
	box-shadow: 0 8rpx 32rpx rgba(93, 64, 55, 0.08);
}

.field {
	margin-bottom: 40rpx;
}

.label {
	font-size: 26rpx;
	color: #6D4C41;
	display: block;
	margin-bottom: 16rpx;
	font-weight: 500;
}

.input {
	height: 92rpx;
	background: #FFF8F1;
	border-radius: 44rpx;
	padding: 0 32rpx;
	font-size: 30rpx;
	color: #5D4037;
	box-sizing: border-box;
}

.ph {
	color: #D7CCC8;
}

.code-row {
	display: flex;
	align-items: center;
}

.code-input {
	flex: 1;
	margin-right: 20rpx;
}

.code-btn {
	font-size: 24rpx;
	color: #DC825E;
	background: #FFF3E0;
	border-radius: 44rpx;
	padding: 0 28rpx;
	height: 92rpx;
	line-height: 92rpx;
	margin: 0;
	flex-shrink: 0;
}

.code-btn.disabled {
	color: #BCAAA4;
	background: #F5F0EC;
}

.dev-tip {
	background: #FFF8E1;
	border: 1rpx dashed #FFE082;
	border-radius: 16rpx;
	padding: 20rpx 24rpx;
	margin-bottom: 24rpx;
	display: flex;
	align-items: center;
}

.dev-tip-label {
	font-size: 22rpx;
	color: #B08968;
	margin-right: 16rpx;
}

.dev-tip-value {
	font-size: 32rpx;
	font-weight: 700;
	color: #DC825E;
	letter-spacing: 4rpx;
}

.error-box {
	background: #FFEBEE;
	border-radius: 16rpx;
	padding: 20rpx 24rpx;
	margin-bottom: 24rpx;
}

.error-text {
	font-size: 24rpx;
	color: #C62828;
	line-height: 1.6;
}

.submit-btn {
	background: linear-gradient(135deg, #FF9E80, #DC825E);
	color: #FFFFFF;
	font-size: 30rpx;
	font-weight: 600;
	border-radius: 48rpx;
	height: 96rpx;
	line-height: 96rpx;
	margin: 0;
}

.agree {
	margin-top: 28rpx;
	text-align: center;
}

.agree-text {
	font-size: 22rpx;
	color: #BCAAA4;
}

.agree-link {
	font-size: 22rpx;
	color: #DC825E;
}

.mask {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.45);
	z-index: 999;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 60rpx;
}

.policy-box {
	width: 100%;
	background: #FFFFFF;
	border-radius: 28rpx;
	padding: 40rpx;
	box-sizing: border-box;
}

.policy-title {
	font-size: 32rpx;
	font-weight: 600;
	color: #5D4037;
	display: block;
	text-align: center;
	margin-bottom: 24rpx;
}

.policy-scroll {
	max-height: 600rpx;
}

.policy-text {
	font-size: 24rpx;
	color: #6D4C41;
	line-height: 1.8;
	white-space: pre-wrap;
}

.policy-close {
	background: #FFF3E0;
	color: #DC825E;
	font-size: 28rpx;
	border-radius: 44rpx;
	height: 84rpx;
	line-height: 84rpx;
	margin: 32rpx 0 0;
}
</style>

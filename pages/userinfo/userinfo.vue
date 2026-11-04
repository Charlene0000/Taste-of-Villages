<template>
	<view class="page">
		<!-- 头部资料卡 -->
		<view class="profile-card">
			<view class="avatar-wrap" @click="pickAvatar">
				<image class="avatar" v-if="user.avatar" :src="user.avatar" mode="aspectFill" />
				<view class="avatar placeholder" v-else>
					<text class="avatar-text">{{ avatarInitial }}</text>
				</view>
				<view class="avatar-edit">
					<text class="avatar-edit-text">换</text>
				</view>
			</view>

			<view class="info">
				<text class="nickname">{{ user.nickname || '未设置昵称' }}</text>
				<text class="mobile">{{ maskedMobile }}</text>
			</view>

			<button class="logout-btn" size="mini" @click="onLogout">退出</button>
		</view>

		<!-- 统计数据 -->
		<view class="stats-row">
			<view class="stat-item">
				<text class="stat-value">{{ user.loginCount || 0 }}</text>
				<text class="stat-label">登录次数</text>
			</view>
			<view class="stat-item">
				<text class="stat-value">{{ registerDays }}</text>
				<text class="stat-label">注册天数</text>
			</view>
			<view class="stat-item">
				<text class="stat-value">{{ user.points || 0 }}</text>
				<text class="stat-label">当前积分</text>
			</view>
		</view>

		<!-- 资料编辑 -->
		<view class="section">
			<text class="section-title">编辑资料</text>
			<view class="form-card">
				<view class="field">
					<text class="label">昵称</text>
					<input
						class="input"
						v-model="editNickname"
						maxlength="32"
						placeholder="给自己起个名字"
						placeholder-class="ph"
					/>
				</view>
				<button class="save-btn" :disabled="saving" @click="saveProfile">
					{{ saving ? '保存中...' : '保存资料' }}
				</button>
			</view>
		</view>

		<!-- 会话信息 -->
		<view class="section">
			<text class="section-title">登录状态</text>
			<view class="info-card">
				<view class="info-row" v-for="(v, k) in sessionInfo" :key="k">
					<text class="info-key">{{ k }}</text>
					<text class="info-val">{{ v }}</text>
				</view>
				<button class="refresh-btn" @click="refreshSession">刷新会话状态</button>
			</view>
		</view>

		<!-- 关于 -->
		<view class="section">
			<text class="section-title">关于</text>
			<view class="info-card">
				<text class="about-text">
					跨境共生小程序 v1.0.0{'\n'}
					前端 uni-app + 后端 Express + SQLite{'\n'}
					零付费云依赖，本地即可完整运行
				</text>
			</view>
		</view>
	</view>
</template>

<script>
import { userApi, authApi } from '@/utils/auth.js'
import { getUserInfo, setUserInfo } from '@/utils/request.js'
import { audit } from '@/utils/session.js'
import { upload } from '@/utils/request.js'
import { checkAuth } from '@/utils/router-guard.js'

export default {
	data () {
		return {
			user: {},
			editNickname: '',
			saving: false,
			sessionInfo: {}
		}
	},
	computed: {
		maskedMobile () {
			const m = this.user.mobile || ''
			if (m.length !== 11) return m
			return m.slice(0, 3) + '****' + m.slice(7)
		},
		avatarInitial () {
			const n = this.user.nickname || this.user.mobile || '?'
			return String(n).charAt(0).toUpperCase()
		},
		registerDays () {
			if (!this.user.registerDate) return 0
			const diff = Date.now() - new Date(this.user.registerDate).getTime()
			return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
		}
	},
	onLoad () {
		// Sprint 5.1：用户中心在 authRouter.needLogin 列表中，
		// 但此前未接入 checkAuth —— 手动输入 URL 可绕过登录。
		// 这里接入守卫，并显式传路由（避免 onLoad 时页面栈时序问题）。
		if (!checkAuth({ route: 'pages/userinfo/userinfo' })) return
	},
	onShow () {
		this.loadProfile()
	},
	methods: {
		async loadProfile () {
			try {
				const res = await userApi.profile()
				console.log('[userinfo] profile 响应:', {
					code: res && res.code,
					hasUser: !!(res && res.user),
					userId: res && res.user ? res.user.id : null
				})
				if (res && res.user) {
					this.user = res.user
					this.editNickname = res.user.nickname || ''
					setUserInfo(res.user)
				}
			} catch (e) {
				console.error('[userinfo] 加载资料失败:', e && e.message)
			}
		},

		async saveProfile () {
			if (this.saving) return
			const nickname = (this.editNickname || '').trim()
			if (!nickname) {
				uni.showToast({ title: '昵称不能为空', icon: 'none' })
				return
			}
			this.saving = true
			try {
				const res = await userApi.updateProfile({ nickname })
				if (res && res.user) {
					this.user = res.user
					setUserInfo(res.user)
				}
				uni.showToast({ title: '保存成功', icon: 'none' })
			} catch (e) {
				uni.showToast({
					title: e && e.message ? e.message : '保存失败',
					icon: 'none'
				})
			} finally {
				this.saving = false
			}
		},

		/**
		 * 选择并上传头像
		 */
		pickAvatar () {
			uni.chooseImage({
				count: 1,
				sizeType: ['compressed'],
				sourceType: ['album', 'camera'],
				success: async (res) => {
					const path = res.tempFilePaths && res.tempFilePaths[0]
					if (!path) return
					try {
						uni.showLoading({ title: '上传中' })
						const up = await upload(path)
						if (up && up.url) {
							const saved = await userApi.updateProfile({ avatar: up.url })
							if (saved && saved.user) {
								this.user = saved.user
								setUserInfo(saved.user)
							}
							uni.showToast({ title: '头像已更新', icon: 'none' })
						}
					} catch (e) {
						uni.showToast({
							title: e && e.message ? e.message : '上传失败',
							icon: 'none'
						})
					} finally {
						uni.hideLoading()
					}
				}
			})
		},

		/**
		 * 刷新会话状态（展示 session-audit 的替代实现）
		 */
		async refreshSession () {
			const res = await audit({ silent: true })
			if (!res) {
				this.sessionInfo = { 状态: '服务不可用（已放行，不阻断操作）' }
				return
			}
			this.sessionInfo = {
				'会话有效': res.valid ? '是' : '否',
				'剩余有效期': Math.round((res.expiresIn || 0) / 60) + ' 分钟',
				'是否即将过期': res.expiresSoon ? '是（将自动续期）' : '否',
				'登录设备数': res.deviceCount === null ? '未知' : res.deviceCount,
				'最近登录地': res.lastLoginIpMasked || '未知'
			}
		},

		onLogout () {
			uni.showModal({
				title: '退出登录',
				content: '确定要退出当前账号吗？',
				confirmColor: '#DC825E',
				success: async (res) => {
					if (!res.confirm) return
					await authApi.logout()
					uni.reLaunch({ url: '/pages/index/cover' })
				}
			})
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #FFFBF0;
	padding: 32rpx;
	box-sizing: border-box;
}

.profile-card {
	background: linear-gradient(135deg, #FFF3E0, #FFECB3);
	border-radius: 32rpx;
	padding: 40rpx 36rpx;
	display: flex;
	align-items: center;
	box-shadow: 0 8rpx 28rpx rgba(93, 64, 55, 0.08);
}

.avatar-wrap {
	position: relative;
	width: 120rpx;
	height: 120rpx;
	margin-right: 28rpx;
	flex-shrink: 0;
}

.avatar {
	width: 120rpx;
	height: 120rpx;
	border-radius: 50%;
	background: #FFFFFF;
}

.avatar.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
}

.avatar-text {
	font-size: 48rpx;
	font-weight: 700;
	color: #DC825E;
}

.avatar-edit {
	position: absolute;
	right: -4rpx;
	bottom: -4rpx;
	width: 40rpx;
	height: 40rpx;
	border-radius: 50%;
	background: #DC825E;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 3rpx solid #FFFFFF;
}

.avatar-edit-text {
	font-size: 20rpx;
	color: #FFFFFF;
}

.info {
	flex: 1;
}

.nickname {
	font-size: 36rpx;
	font-weight: 700;
	color: #5D4037;
	display: block;
}

.mobile {
	font-size: 24rpx;
	color: #A1887F;
	display: block;
	margin-top: 8rpx;
}

.logout-btn {
	background: #FFFFFF;
	color: #DC825E;
	font-size: 24rpx;
	border-radius: 30rpx;
	margin: 0;
	padding: 0 28rpx;
}

.stats-row {
	background: #FFFFFF;
	border-radius: 28rpx;
	padding: 36rpx 0;
	margin-top: 24rpx;
	display: flex;
	box-shadow: 0 4rpx 20rpx rgba(93, 64, 55, 0.05);
}

.stat-item {
	flex: 1;
	text-align: center;
}

.stat-value {
	font-size: 40rpx;
	font-weight: 700;
	color: #DC825E;
	display: block;
}

.stat-label {
	font-size: 22rpx;
	color: #A1887F;
	display: block;
	margin-top: 6rpx;
}

.section {
	margin-top: 36rpx;
}

.section-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #5D4037;
	display: block;
	margin-bottom: 20rpx;
}

.form-card,
.info-card {
	background: #FFFFFF;
	border-radius: 28rpx;
	padding: 32rpx;
	box-shadow: 0 4rpx 20rpx rgba(93, 64, 55, 0.05);
}

.field {
	margin-bottom: 28rpx;
}

.label {
	font-size: 24rpx;
	color: #6D4C41;
	display: block;
	margin-bottom: 14rpx;
}

.input {
	height: 88rpx;
	background: #FFF8F1;
	border-radius: 40rpx;
	padding: 0 28rpx;
	font-size: 28rpx;
	color: #5D4037;
}

.ph {
	color: #D7CCC8;
}

.save-btn {
	background: linear-gradient(135deg, #FF9E80, #DC825E);
	color: #FFFFFF;
	font-size: 28rpx;
	border-radius: 44rpx;
	height: 88rpx;
	line-height: 88rpx;
	margin: 0;
}

.info-row {
	display: flex;
	padding: 10rpx 0;
}

.info-key {
	font-size: 24rpx;
	color: #8D6E63;
	width: 220rpx;
}

.info-val {
	font-size: 24rpx;
	color: #5D4037;
	flex: 1;
}

.refresh-btn {
	background: #FFF3E0;
	color: #DC825E;
	font-size: 24rpx;
	border-radius: 36rpx;
	height: 72rpx;
	line-height: 72rpx;
	margin: 24rpx 0 0;
}

.about-text {
	font-size: 24rpx;
	color: #8D6E63;
	line-height: 1.8;
	white-space: pre-wrap;
}
</style>

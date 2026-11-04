<template>
	<view class="nav-bar" :style="safeAreaStyle">
		<!-- 返回按钮 -->
		<view class="nav-back" hover-class="nav-hover" @click="onBack">
			<text class="nav-back-icon">‹</text>
			<text class="nav-back-text" v-if="showText">{{ backText }}</text>
		</view>

		<!-- 标题 -->
		<text class="nav-title">{{ title }}</text>

		<!-- 右侧插槽 -->
		<view class="nav-right">
			<slot name="right"></slot>
		</view>
	</view>
</template>

<script>
/**
 * 轻量导航栏（Sprint 5.2 自研）
 *
 * ## 为什么自研而不用 uni-nav-bar
 * --------------------------------
 * `uni_modules/` 里没有 `uni-nav-bar`（项目只装了 8 个纯 UI 模块），
 * 而手写的 `pages/userinfo/userinfo` 与 `pages/login/login`
 * 在 H5/Web 端用原生导航栏时经常不渲染返回按钮 ——
 * 页面就成了「死胡同」，进得去出不来。
 *
 * 引入一个新模块去解决两个页面的问题，不如自绘一个 30 行的组件：
 * 行为完全可控，且不增加依赖体积。
 *
 * ## 用法
 * ---------
 *   <nav-bar title="个人资料" @back="onBack" />
 *
 *   export default {
 *     methods: {
 *       onBack () {
 *         const pages = getCurrentPages()
 *         if (pages.length > 1) uni.navigateBack()
 *         else uni.switchTab({ url: '/pages/home/show' })
 *       }
 *     }
 *   }
 */
export default {
	name: 'NavBar',
	props: {
		/** 标题 */
		title: {
			type: String,
			default: ''
		},
		/** 返回按钮文案（空则只显示箭头） */
		backText: {
			type: String,
			default: ''
		},
		/** 是否显示返回文案 */
		showText: {
			type: Boolean,
			default: false
		},
		/** 无上级页面时的兜底跳转路径 */
		fallbackUrl: {
			type: String,
			default: '/pages/home/show'
		},
		/** 背景色 */
		bgColor: {
			type: String,
			default: '#FFFBF0'
		},
		/** 文字色 */
		color: {
			type: String,
			default: '#5D4037'
		}
	},
	computed: {
		/** 状态栏高度（刘海屏适配） */
		safeAreaStyle () {
			let top = 0
			try {
				const info = uni.getSystemInfoSync()
				top = (info && info.statusBarHeight) || 0
			} catch (e) {
				// 非 uni-app 运行时（如单测）忽略
			}
			return 'padding-top:' + top + 'px;'
		}
	},
	methods: {
		/**
		 * 返回
		 *
		 * 有上级页面 → navigateBack
		 * 没有（直接打开的入口页）→ switchTab 回首页
		 */
		onBack () {
			console.log('[nav-bar] 点击返回')
			const pages = getCurrentPages()
			if (pages.length > 1) {
				uni.navigateBack({
					fail: () => {
						uni.switchTab({ url: this.fallbackUrl })
					}
				})
			} else {
				uni.switchTab({
					url: this.fallbackUrl,
					fail: () => {
						uni.reLaunch({ url: this.fallbackUrl })
					}
				})
			}
			this.$emit('back')
		}
	}
}
</script>

<style scoped>
.nav-bar {
	position: relative;
	display: flex;
	align-items: center;
	height: 88rpx;
	padding-left: 24rpx;
	padding-right: 24rpx;
	background-color: #FFFBF0;
	box-sizing: border-box;
	z-index: 100;
}

.nav-back {
	display: flex;
	align-items: center;
	min-width: 60rpx;
	height: 60rpx;
	padding: 0 12rpx;
	border-radius: 30rpx;
	flex-shrink: 0;
}

.nav-hover {
	background-color: rgba(216, 122, 70, 0.12);
}

.nav-back-icon {
	font-size: 48rpx;
	line-height: 1;
	color: #5D4037;
	font-weight: 300;
}

.nav-back-text {
	font-size: 28rpx;
	color: #5D4037;
	margin-left: 2rpx;
}

.nav-title {
	flex: 1;
	text-align: center;
	font-size: 34rpx;
	font-weight: 600;
	color: #5D4037;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.nav-right {
	min-width: 60rpx;
	display: flex;
	justify-content: flex-end;
	align-items: center;
	flex-shrink: 0;
}
</style>

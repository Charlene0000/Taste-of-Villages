<template>
	<view class="journal-container">
		<!-- 背景底纸 -->
		<view class="paper-texture"></view>
		<view class="watercolor-stain top-right"></view>
		<view class="watercolor-stain bottom-left"></view>

		<!-- 头部：手账本封面风格 -->
		<view class="journal-header">
			<view class="back-area" @click="goBack">
				<view class="back-circle"><text class="back-arrow">←</text></view>
			</view>
			<view class="title-strip">
				<text class="title-text">共生手账 · 岁时记</text>
				<view class="date-seal">
					<text class="month">肆月</text>
					<text class="year">2026</text>
				</view>
			</view>
			<text class="quote">“万物并育而不相害，道并行而不相悖。”</text>
		</view>

		<!-- 手账条目列表 -->
		<view class="entry-list">
			<view class="entries-wrapper">
				<view 
					v-for="(item, index) in journalEntries" 
					:key="index" 
					class="journal-entry"
					:class="index % 2 === 0 ? 'layout-left' : 'layout-right'"
				>
					<!-- 时间轴圆点 -->
					<view class="timeline-dot"></view>
					
					<!-- 照片卡片 -->
					<view class="photo-card" :style="{ transform: 'rotate(' + (item.rotate || 2) + 'deg)' }">
						<image :src="item.image" mode="aspectFill" class="photo-img"></image>
						<view class="tape-deco"></view>
						<text class="photo-caption">{{ item.location }}</text>
					</view>

					<!-- 文字内容 -->
					<view class="entry-content">
						<text class="entry-date">{{ item.date }}</text>
						<view class="bingbing-comment">
							<image src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/congmei-static.gif" class="avatar"></image>
							<view class="bubble">
								<text class="comment-text">{{ item.comment }}</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 底部装饰 -->
				<view class="journal-footer">
					<view class="stamp-box">
						<image src="https://mp-b88a8047-5a18-4ba9-b43c-d93de4363320.cdn.bspapp.com/cloudstorage/init-data/logo.png" mode="aspectFit" class="stamp-img"></image>
					</view>
					<text class="footer-msg">今日份的小惊喜已收录</text>
				</view>
			</view>
		</view>


	</view>
</template>

<script>
import { businessApi } from '@/utils/auth.js'
import CustomTabBar from '@/components/custom-tab-bar/index.vue'

import { getUserInfo } from '@/utils/request.js'

export default {
	components: {
		CustomTabBar
	},
	data() {
		return {
			journalEntries: [],
			loading: true
		}
	},
	onLoad() {
		this.fetchData()
	},
	computed: {
		userInfo() {
			// Sprint 5.1 修复：
			// 原代码是 `return store.userInfo` —— uni-id-pages 的响应式 store，
			// Sprint 5 删除了该模块，import 已移除但**使用点残留**，
			// computed 求值时抛 `ReferenceError: store is not defined` → 手账页崩溃。
			// 现在直接读本地缓存（getUserInfo 已在 import 中）。
			return getUserInfo() || {}
		}
	},
	methods: {
		goBack() {
			uni.navigateBack()
		},
		async fetchData() {
			// Sprint 5.1：_id 别名由 utils/auth.js 补齐，这里同时兜底 id
			const info = this.userInfo || {}
			const cached = uni.getStorageSync('app_user_info') || {}
			const openid = info._id || info.id || cached._id || cached.id;
			if (!openid) {
				console.warn('[journal] 未登录，跳过手账数据加载')
				return;
			}
			
			try {
				this.loading = true;
				const res = await businessApi.getCheckInRecords({ openid });
				
				if (res && res.code === 200) {
					// 过滤出有进度的记录
					const records = res.data.filter(item => (item.progress || 0) > 0);
					
					this.journalEntries = records.map((item, index) => {
						const comments = [
							`在${item.name || '未知'}留下了脚印，这里的空气都带着泥土的清香呢！`,
							`${item.name || '未知'}的风景真的不错，我已经把它收进我的私人珍藏集啦~`,
							`哇，你在${item.name || '未知'}的探索进度已经达到${item.progress || 0}%了，加油呀！`,
							`下一次我们要不要更深入地去了解一下${item.name || '未知'}的故事呢？`
						];
						return {
							date: item.lastTime || '最近',
							location: item.name || '未知',
							image: item.image,
							comment: comments[index % comments.length],
							rotate: (Math.random() * 6 - 3).toFixed(1)
						}
					});
				}
			} catch (e) {
				console.error(e);
			} finally {
				this.loading = false;
			}
		}
	}
}
</script>

<style scoped lang="scss">
.journal-container {
	width: 100vw;
	min-height: 100vh;
	background-color: #FFFBF0;
	position: relative;
	display: flex;
	flex-direction: column;
	font-family: "Songti SC", "Noto Serif SC", serif;
}

.paper-texture {
	position: absolute;
	top: 0; left: 0; right: 0; bottom: 0;
	background-image: radial-gradient(#E8D7C3 1rpx, transparent 0);
	background-size: 40rpx 40rpx;
	opacity: 0.1;
	z-index: 1;
}

.watercolor-stain {
	position: absolute;
	width: 600rpx;
	height: 600rpx;
	border-radius: 50%;
	filter: blur(80px);
	z-index: 0;
	opacity: 0.3;
	
	&.top-right { top: -200rpx; right: -100rpx; background: #FFD54F; }
	&.bottom-left { bottom: -100rpx; left: -200rpx; background: #FFAB91; }
}

.journal-header {
	padding: 100rpx 50rpx 40rpx;
	z-index: 10;
	display: flex;
	flex-direction: column;
	
	.back-area {
		margin-bottom: 20rpx;
		align-self: flex-start;
		
		.back-circle {
			width: 64rpx;
			height: 64rpx;
			background: rgba(255, 255, 255, 0.6);
			border-radius: 50%;
			display: flex;
			justify-content: center;
			align-items: center;
			border: 1px solid rgba(141, 110, 99, 0.2);
			
			.back-arrow {
				font-size: 36rpx;
				color: #5D4037;
			}
		}
	}
	
	.title-strip {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 2rpx solid #D7CCC8;
		padding-bottom: 20rpx;
		
		.title-text {
			font-size: 44rpx;
			color: #3E2723;
			font-weight: bold;
			letter-spacing: 2rpx;
		}
		
		.date-seal {
			display: flex;
			flex-direction: column;
			align-items: center;
			background: rgba(211, 47, 47, 0.05);
			border: 2rpx solid #D32F2F;
			color: #D32F2F;
			padding: 4rpx 12rpx;
			border-radius: 8rpx;
			transform: rotate(5deg);
			
			.month { font-size: 24rpx; font-weight: bold; }
			.year { font-size: 16rpx; }
		}
	}
	
	.quote {
		font-size: 22rpx;
		color: #8D6E63;
		margin-top: 20rpx;
		display: block;
		font-style: italic;
	}
}

.entry-list {
	flex: 1;
	width: 100%;
	z-index: 10;
}

.entries-wrapper {
	padding: 20rpx 40rpx 150rpx;
	position: relative;
	
	&::before {
		content: '';
		position: absolute;
		left: 60rpx;
		top: 0;
		bottom: 150rpx;
		width: 2rpx;
		background: #D7CCC8;
		z-index: 1;
	}
}

.journal-entry {
	display: flex;
	margin-bottom: 80rpx;
	position: relative;
	z-index: 2;
	
	.timeline-dot {
		width: 16rpx;
		height: 16rpx;
		background: #DC825E;
		border-radius: 50%;
		border: 4rpx solid #FFF;
		margin-top: 20rpx;
		margin-right: 30rpx;
		box-shadow: 0 4rpx 8rpx rgba(0,0,0,0.1);
	}
	
	.photo-card {
		width: 280rpx;
		background: #FFF;
		padding: 12rpx 12rpx 40rpx;
		box-shadow: 0 10rpx 30rpx rgba(0,0,0,0.08);
		position: relative;
		
		.photo-img {
			width: 100%;
			height: 200rpx;
			border-radius: 4rpx;
		}
		
		.tape-deco {
			position: absolute;
			top: -20rpx;
			left: 50%;
			transform: translateX(-50%);
			width: 80rpx;
			height: 30rpx;
			background: rgba(220, 130, 94, 0.3);
			border-radius: 4rpx;
			z-index: 3;
		}
		
		.photo-caption {
			font-size: 18rpx;
			color: #8D6E63;
			text-align: center;
			display: block;
			margin-top: 15rpx;
		}
	}
	
	.entry-content {
		flex: 1;
		margin-left: 30rpx;
		display: flex;
		flex-direction: column;
		justify-content: center;
		
		.entry-date {
			font-size: 26rpx;
			color: #A1887F;
			font-weight: bold;
			margin-bottom: 15rpx;
		}
		
		.bingbing-comment {
			display: flex;
			align-items: flex-start;
			gap: 15rpx;
			
			.avatar {
				width: 50rpx;
				height: 50rpx;
				border-radius: 50%;
				background: #FFF;
				border: 1px solid #FFE0B2;
			}
			
			.bubble {
				flex: 1;
				background: #FFFDE7;
				padding: 16rpx 20rpx;
				border-radius: 0 20rpx 20rpx 20rpx;
				border: 1px solid #FFF59D;
				position: relative;
				
				.comment-text {
					font-size: 24rpx;
					color: #5D4037;
					line-height: 1.5;
				}
			}
		}
	}
}

.journal-footer {
	margin-top: 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	
	.stamp-box {
		width: 120rpx;
		height: 120rpx;
		opacity: 0.15;
		margin-bottom: 20rpx;
		
		.stamp-img { width: 100%; height: 100%; }
	}
	
	.footer-msg {
		font-size: 20rpx;
		color: #BCAAA4;
		font-style: italic;
	}
}
</style>

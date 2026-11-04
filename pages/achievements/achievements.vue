<template>
	<view class="achievement-container">
		<view class="watercolor-bg"></view>
		<view class="watercolor-bg-2"></view>

		<view class="stats-header">
			<view class="back-area" @click="goBack">
				<view class="back-circle"><text class="back-arrow">←</text></view>
			</view>
			<view class="stats-card">
				<view class="stat-item">
					<text class="num">{{ unlockedCount }}</text>
					<text class="label">已点亮</text>
				</view>
				<view class="divider"></view>
				<view class="stat-item">
					<text class="num">{{ totalCount }}</text>
					<text class="label">勋章总数</text>
				</view>
			</view>
			<text class="header-hint">每一个印章，都是与土地共生的证明</text>
		</view>

		<!-- 勋章网格 -->
		<view class="medals-grid-container">
			<view class="medals-grid">
				<view 
					v-for="(medal, index) in medalList" 
					:key="index" 
					class="medal-box"
					@click="showMedalDetail(medal)"
				>
					<view class="medal-inner" :class="{ locked: !medal.unlocked }">
						<view class="medal-icon-wrapper">
							<!-- 勋章背景晕染 -->
							<view class="medal-bg-glow" :style="{ backgroundColor: medal.color || '#FFE0B2' }"></view>
							<!-- 勋章图标/文字 -->
							<view class="medal-seal">
								<text class="seal-text">{{ medal.name.substring(0, 2) }}</text>
							</view>
						</view>
						<text class="medal-name">{{ medal.name }}</text>
						<text class="medal-date" v-if="medal.unlocked">{{ medal.date }}</text>
						<text class="medal-status" v-else>未锁定</text>
					</view>
				</view>
			</view>
			
			<!-- 底部留白 -->
			<view class="footer-spacer"></view>
		</view>



		
		<!-- 勋章详情弹窗 (模拟) -->
		<view class="detail-popup" v-if="selectedMedal" @click="selectedMedal = null">
			<view class="popup-content" @click.stop>
				<view class="popup-seal" :style="{ color: selectedMedal.color, borderColor: selectedMedal.color }">
					<text>{{ selectedMedal.name.substring(0, 2) }}</text>
				</view>
				<text class="popup-title">{{ selectedMedal.name }}</text>
				<text class="popup-desc">{{ selectedMedal.desc }}</text>
				<button class="close-btn" @click="selectedMedal = null" :style="{ backgroundColor: selectedMedal.color }">收下这份荣誉</button>
			</view>
		</view>
	</view>
</template>

<script>
import CustomTabBar from '@/components/custom-tab-bar/index.vue'

import { store } from '@/uni_modules/uni-id-pages/common/store.js'

export default {
	components: {
		CustomTabBar
	},
	data() {
		return {
			selectedMedal: null,
			medalList: [],
			loading: true
		}
	},
	onLoad() {
		this.fetchData()
	},
	computed: {
		unlockedCount() {
			return this.medalList.filter(m => m.unlocked).length
		},
		totalCount() {
			return this.medalList.length
		},
		userInfo() {
			return store.userInfo
		}
	},
	methods: {
		goBack() {
			uni.navigateBack()
		},
		async fetchData() {
			const openid = this.userInfo._id || uni.getStorageSync('uni-id-pages-userInfo')._id;
			if (!openid) return;
			
			try {
				this.loading = true;
				const res = await uniCloud.callFunction({
					name: 'getCheckInRecords',
					data: { openid }
				});
				
				if (res.result && res.result.code === 200) {
					// 映射真实数据到勋章列表
					this.medalList = res.result.data.map((item, index) => {
						const colors = ['#E57373', '#81C784', '#64B5F6', '#FFB74D', '#9575CD', '#4DB6AC'];
						return {
							name: item.name + '勋章',
							desc: `您在${item.name}的探索进度已达${item.progress}%，${item.progress >= 100 ? '已完全点亮此印记。' : '继续努力解锁全部成就吧！'}`,
							unlocked: item.progress > 0, // 只要有进度就视为解锁初步印记
							date: item.progress >= 100 ? '已圆满' : '探索中',
							color: colors[index % colors.length],
							progress: item.progress
						}
					});
				}
			} catch (e) {
				console.error(e);
			} finally {
				this.loading = false;
			}
		},
		showMedalDetail(medal) {
			if (medal.unlocked) {
				this.selectedMedal = medal
			} else {
				uni.showToast({ title: '开始探索该地区以进入勋章馆', icon: 'none' })
			}
		}
	}
}
</script>

<style scoped lang="scss">
.achievement-container {
	width: 100vw;
	min-height: 100vh;
	background-color: #FFFBF0;
	position: relative;
	display: flex;
	flex-direction: column;
	font-family: "Songti SC", "Noto Serif SC", serif;
}

.watercolor-bg {
	position: absolute;
	top: -10%; left: -20%;
	width: 600rpx; height: 600rpx;
	background: radial-gradient(circle, #FFE0B2 0%, rgba(255, 224, 178, 0) 70%);
	filter: blur(50rpx);
	opacity: 0.6;
	z-index: 0;
}

.watercolor-bg-2 {
	position: absolute;
	bottom: 10%; right: -20%;
	width: 500rpx; height: 500rpx;
	background: radial-gradient(circle, #FFCC80 0%, rgba(255, 204, 128, 0) 70%);
	filter: blur(60rpx);
	opacity: 0.4;
	z-index: 0;
}

.stats-header {
	padding: 100rpx 40rpx 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	z-index: 10;
	
	.back-area {
		margin-bottom: 30rpx;
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
	
	.stats-card {
		background: #FFF;
		border-radius: 40rpx;
		padding: 30rpx 60rpx;
		display: flex;
		align-items: center;
		box-shadow: 0 10rpx 40rpx rgba(93, 64, 55, 0.08);
		border: 1px solid #FFE0B2;
		
		.stat-item {
			display: flex;
			flex-direction: column;
			align-items: center;
			
			.num { font-size: 48rpx; color: #3E2723; font-weight: bold; }
			.label { font-size: 20rpx; color: #8D6E63; margin-top: 4rpx; }
		}
		
		.divider {
			width: 2rpx;
			height: 60rpx;
			background: #EFEBE9;
			margin: 0 60rpx;
		}
	}
	
	.header-hint {
		font-size: 22rpx;
		color: #A1887F;
		margin-top: 30rpx;
		font-style: italic;
	}
}

.medals-scroll {
	flex: 1;
	width: 100%;
	z-index: 10;
}

.medals-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 40rpx;
	padding: 20rpx 40rpx;
}

.medal-box {
	.medal-inner {
		background: #FFF;
		border-radius: 30rpx;
		padding: 40rpx 20rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		border: 1px solid #FFF8E1;
		
		&:active { transform: scale(0.95); }
		
		&.locked {
			opacity: 0.6;
			filter: grayscale(0.8);
			background: #FAFAFA;
			
			.medal-seal { border: 4rpx dashed #BDBDBD !important; color: #BDBDBD !important; }
		}
		
		.medal-icon-wrapper {
			position: relative;
			width: 160rpx;
			height: 160rpx;
			display: flex;
			justify-content: center;
			align-items: center;
			margin-bottom: 20rpx;
			
			.medal-bg-glow {
				position: absolute;
				width: 120rpx;
				height: 120rpx;
				border-radius: 50%;
				filter: blur(20px);
				opacity: 0.4;
			}
			
			.medal-seal {
				width: 130rpx;
				height: 130rpx;
				border: 6rpx solid #DC825E;
				border-radius: 50%;
				display: flex;
				justify-content: center;
				align-items: center;
				background: #FFF;
				color: #DC825E;
				font-size: 40rpx;
				font-weight: bold;
				z-index: 2;
				position: relative;
				
				&::after {
					content: '';
					position: absolute;
					width: 144rpx;
					height: 144rpx;
					border: 2rpx dashed currentColor;
					border-radius: 50%;
				}
			}
		}
		
		.medal-name {
			font-size: 28rpx;
			color: #3E2723;
			font-weight: bold;
		}
		
		.medal-date, .medal-status {
			font-size: 20rpx;
			color: #8D6E63;
			margin-top: 10rpx;
		}
	}
}

.footer-spacer {
	height: 150rpx;
}

/* 详情弹窗 */
.detail-popup {
	position: fixed;
	top: 0; left: 0; right: 0; bottom: 0;
	background: rgba(93, 64, 55, 0.6);
	backdrop-filter: blur(4px);
	z-index: 10000;
	display: flex;
	justify-content: center;
	align-items: center;
	
	.popup-content {
		width: 560rpx;
		background: #FFF;
		border-radius: 50rpx;
		padding: 60rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		animation: popupAnim 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		
		.popup-seal {
			width: 180rpx;
			height: 180rpx;
			border: 8rpx solid;
			border-radius: 50%;
			display: flex;
			justify-content: center;
			align-items: center;
			font-size: 60rpx;
			font-weight: bold;
			margin-bottom: 40rpx;
			position: relative;
			
			&::after {
				content: '';
				position: absolute;
				width: 200rpx;
				height: 200rpx;
				border: 2rpx dashed currentColor;
				border-radius: 50%;
			}
		}
		
		.popup-title {
			font-size: 40rpx;
			color: #3E2723;
			font-weight: bold;
			margin-bottom: 20rpx;
		}
		
		.popup-desc {
			font-size: 26rpx;
			color: #795548;
			text-align: center;
			line-height: 1.6;
			margin-bottom: 50rpx;
		}
		
		.close-btn {
			width: 100%;
			height: 90rpx;
			border-radius: 45rpx;
			background: #DC825E;
			color: #FFF;
			font-size: 28rpx;
			font-weight: bold;
			display: flex;
			justify-content: center;
			align-items: center;
			border: none;
			box-shadow: 0 10rpx 20rpx rgba(0,0,0,0.1);
		}
	}
}

@keyframes popupAnim {
	from { transform: scale(0.8); opacity: 0; }
	to { transform: scale(1); opacity: 1; }
}
</style>

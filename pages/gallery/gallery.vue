<template>
	<view class="gallery-container">
		<!-- 水彩背景渐变 -->
		<view class="watercolor-bg-blob pos-1"></view>
		<view class="watercolor-bg-blob pos-2"></view>
		<view class="watercolor-bg-blob pos-3"></view>

		<!-- 顶部标题 -->
		<view class="custom-header">
			<text class="title-main">万物长廊</text>
			<text class="title-sub">寻觅自然与岁月的温柔馈赠</text>
		</view>

		<!-- 内容滑块 -->
		<scroll-view scroll-x class="painting-scroll" enable-flex>
			<view class="painting-content">
				<view 
					v-for="(item, index) in artifactList" 
					:key="index" 
					class="artifact-card"
					:class="'card-style-' + (index % 3)"
					@click="viewDetail(item)"
				>
					<view class="card-inner">
						<view class="image-wrapper">
							<image :src="item.image" mode="aspectFill" class="artifact-image"></image>
							<view class="watercolor-overlay"></view>
						</view>
						<view class="info-content">
							<text class="artifact-tag">{{ item.category }}</text>
							<text class="artifact-name">{{ item.name }}</text>
							<text class="artifact-desc">{{ item.shortDesc }}</text>
						</view>
						<view class="card-footer">
							<text class="village-name">来自 {{ item.village }}</text>
							<view class="heart-icon">
								<text class="icon">♥</text>
							</view>
						</view>
					</view>
				</view>
				
				<!-- 结束留白 -->
				<view class="scroll-footer">
					<view class="seal-icon">
						<text>跨境</text>
						<text>共生</text>
					</view>
					<text class="footer-text">未完待续...</text>
				</view>
			</view>
		</scroll-view>

		<custom-tab-bar :current="-1" />
	</view>
</template>

<script>
import CustomTabBar from '@/components/custom-tab-bar/index.vue'

export default {
	components: {
		CustomTabBar
	},
	data() {
		return {
			artifactList: [
				{
					name: '遮浪玛仔',
					category: '非遗美食',
					shortDesc: '红海湾的咸甜记忆，层层叠叠的麦芽糖韵。',
					village: '东尾村',
					image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/shaqima.png'
				},
				{
					name: '石寨古墙',
					category: '古法建筑',
					shortDesc: '石块垒起的岁月，守望百年的静谧时光。',
					village: '石寨村',
					image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/shizhaicun.png'
				},
				{
					name: '清蒸晨洲蚝',
					category: '自然馈赠',
					shortDesc: '万顷江海微咸，孕育出那一抹如牛奶般的嫩滑。',
					village: '晨洲村',
					image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/chenzhouhao.png'
				},
				{
					name: '红桃粿',
					category: '祈福风物',
					shortDesc: '粉嫩的色彩背后，是潮汕儿女对美好的最深祈愿。',
					village: '新山村',
					image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/hongtaoguo.png'
				}
			]
		}
	},
	methods: {
		viewDetail(item) {
			uni.showToast({ title: '收录中...', icon: 'none' })
		}
	}
}
</script>

<style scoped lang="scss">
.gallery-container {
	width: 100vw;
	height: 100vh;
	background-color: #FFFBF0; 
	display: flex;
	flex-direction: column;
	overflow: hidden;
	position: relative;
	font-family: "Songti SC", "Noto Serif SC", serif;
}

.watercolor-bg-blob {
	position: absolute;
	border-radius: 50%;
	filter: blur(60px);
	z-index: 0;
	opacity: 0.4;
	
	&.pos-1 { top: -100rpx; right: -100rpx; width: 400rpx; height: 400rpx; background: radial-gradient(circle, #FFCCBC, transparent); }
	&.pos-2 { bottom: 200rpx; left: -150rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, #FFE082, transparent); }
	&.pos-3 { top: 300rpx; right: 20%; width: 300rpx; height: 300rpx; background: radial-gradient(circle, #D7CCC8, transparent); }
}

.custom-header {
	padding: 100rpx 40rpx 40rpx;
	z-index: 10;
	
	.title-main {
		font-size: 52rpx;
		color: #5D4037;
		font-weight: 600;
		display: block;
		letter-spacing: 4rpx;
	}
	
	.title-sub {
		font-size: 24rpx;
		color: #8D6E63;
		margin-top: 10rpx;
		display: block;
		font-style: italic;
	}
}

.painting-scroll {
	flex: 1;
	width: 100%;
	z-index: 10;
}

.painting-content {
	display: flex;
	padding: 40rpx;
	padding-right: 120rpx;
	align-items: center;
	height: 100%;
}

.artifact-card {
	flex-shrink: 0;
	width: 480rpx;
	margin-right: 60rpx;
	background: #FFF;
	border-radius: 30rpx;
	box-shadow: 0 20rpx 50rpx rgba(93, 64, 55, 0.1);
	overflow: hidden;
	transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	
	&:active {
		transform: scale(0.95) rotate(-1deg);
	}
	
	.card-inner {
		display: flex;
		flex-direction: column;
	}
	
	.image-wrapper {
		position: relative;
		height: 540rpx;
		
		.artifact-image {
			width: 100%;
			height: 100%;
		}
		
		.watercolor-overlay {
			position: absolute;
			top: 0; left: 0; right: 0; bottom: 0;
			background: linear-gradient(to top, rgba(255, 251, 240, 0.8) 0%, transparent 40%);
		}
	}
	
	.info-content {
		padding: 30rpx;
		background: #FFFBEC;
		
		.artifact-tag {
			font-size: 20rpx;
			color: #DC825E;
			border: 1px solid #DC825E;
			padding: 2rpx 12rpx;
			border-radius: 20rpx;
			display: inline-block;
			margin-bottom: 16rpx;
		}
		
		.artifact-name {
			font-size: 36rpx;
			color: #3E2723;
			font-weight: bold;
			display: block;
			margin-bottom: 10rpx;
		}
		
		.artifact-desc {
			font-size: 24rpx;
			color: #795548;
			line-height: 1.6;
			display: block;
		}
	}
	
	.card-footer {
		padding: 20rpx 30rpx 30rpx;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #FFFBEC;
		
		.village-name {
			font-size: 22rpx;
			color: #A1887F;
		}
		
		.heart-icon {
			color: #DC825E;
			font-size: 32rpx;
		}
	}
}

/* 错位排列效果 */
.card-style-0 { transform: translateY(-20rpx); }
.card-style-1 { transform: translateY(40rpx); }
.card-style-2 { transform: translateY(0rpx); }

.scroll-footer {
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding-left: 60rpx;
	
	.seal-icon {
		width: 100rpx;
		height: 100rpx;
		border: 4rpx solid #D32F2F;
		color: #D32F2F;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		font-size: 24rpx;
		line-height: 1.1;
		transform: rotate(-10rpx);
		border-radius: 10rpx;
		opacity: 0.6;
		margin-bottom: 20rpx;
	}
	
	.footer-text {
		font-size: 24rpx;
		color: #BCAAA4;
		writing-mode: vertical-lr;
		letter-spacing: 10rpx;
	}
}
</style>

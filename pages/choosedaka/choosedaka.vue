<template>
	<view class="container">
		
		<image src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/daka/choose_backgroud.png" class="bg-image" mode="scaleToFill"></image>

		
		<view class="back-btn" @click="goBack">
			<view class="back-icon"></view>
		</view>

		
		<view class="header">
			<text class="title">一起去打卡！</text>
		</view>

		
		<view class="subtitle-container">
			<text class="subtitle">{{ currentTitle }}</text>
		</view>

		
		<swiper 
			class="swiper-container" 
			previous-margin="100rpx" 
			next-margin="100rpx" 
			:circular="true"
			@change="onSwiperChange"
		>
			<swiper-item v-for="(item, index) in dakaTypes" :key="index" class="swiper-item">
				<view 
					class="card" 
					:class="{ 'card-active': currentIndex === index }"
				>
					<image :src="item.image" mode="aspectFit" class="card-image"></image>
				</view>
			</swiper-item>
		</swiper>
		
		
		<view class="swipe-hint-container">
			<view class="arrow-left">❮</view>
			<text class="hint-text">左右滑动解锁更多玩法</text>
			<view class="arrow-right">❯</view>
		</view>

		
		<view class="action-btn-container">
			<view class="action-btn" @click="goToDaka">
				<text class="action-btn-text">去打卡</text>
			</view>
		</view>
	</view>
</template>

<script>
import { agentApi } from '@/utils/auth.js'
import { checkAuth } from '@/utils/router-guard.js'

	export default {
		data() {
			return {
				currentIndex: 0,
                queryParams: '',
                isPhotoEnabled: true, 
                isLoadingFeature: true, 
				allDakaTypes: [
					{
						title: "定位打卡",
						image: "https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/daka/map.png",
						path: "/pages/choosedaka/location/location" 
					},
					{
						title: "拍照打卡",
						image: "https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/daka/photo.png",
						path: "/pages/choosedaka/photo/photo",
                        isPhoto: true 
					},
					{
						title: "制作打卡",
						image: "https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/daka/game.png",
						path: "/pages/choosedaka/cook/cook" 
					},
					{
						title: "答题打卡",
						image: "https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/daka/QA.png",
						path: "/pages/choosedaka/test/test" 
					}
				]
			}
		},
        onLoad(options) {
          // 路由守卫：未登录访问受保护页面时跳登录
          if (!checkAuth()) return

            
            this.checkPhotoFeatureStatus();
            
            
            if (options) {
                const params = [];
                for (const key in options) {
                    params.push(`${key}=${options[key]}`);
                }
                this.queryParams = params.join('&');
                console.log('Received Daka Params:', this.queryParams);
            }
        },
		computed: {
            
            dakaTypes() {
                if (this.isLoadingFeature) {
                    
                    return this.allDakaTypes;
                }
                
                return this.allDakaTypes.filter(item => {
                    if (item.isPhoto && !this.isPhotoEnabled) {
                        return false;
                    }
                    return true;
                });
            },
			currentTitle() {
				return this.dakaTypes[this.currentIndex].title;
			}
		},
		methods: {
            async checkPhotoFeatureStatus() {
                this.isLoadingFeature = true;
                try {
                    const res = await agentApi.chat({ action: 'checkStatus' });
                    
                    if (res && res.enable === true) {
                        this.isPhotoEnabled = true;
                    } else {
                        this.isPhotoEnabled = false;
                    }
                } catch (e) {
                    console.error('Failed to check photo feature status:', e);
                    
                    this.isPhotoEnabled = false;
                } finally {
                    this.isLoadingFeature = false;
                }
            },
			onSwiperChange(e) {
				this.currentIndex = e.detail.current;
			},
			goBack() {
				uni.navigateBack();
			},
			goToDaka() {
				const currentItem = this.dakaTypes[this.currentIndex];
				console.log("Navigating to:", currentItem.title);
                
                let url = currentItem.path;
                
                if (url && this.queryParams) {
                    url += `?${this.queryParams}`;
                }
                
                if (url) {
                    uni.navigateTo({
                        url: url,
                        fail: (err) => {
                            console.error('Nav failed:', err);
                            uni.showToast({ title: '功能开发中', icon: 'none' });
                        }
                    });
                } else {
                    uni.showToast({ title: '敬请期待', icon: 'none' });
                }
			}
		}
	}
</script>

<style lang="scss" scoped>
	
	.bg-image {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}

	.container {
		min-height: 100vh;
		width: 100vw;
		
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 100rpx;
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
	}

	.back-btn {
		position: absolute;
		top: 90rpx;
		left: 40rpx;
		width: 80rpx;
		height: 90rpx;
		background-color: rgba(255, 255, 255, 0.5);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		backdrop-filter: blur(5px);
		transform: translateY(8px);
	}

	.uni-icon {
		font-size: 40rpx;
		color: #5D4037;
		font-weight: bold;
	}

	.header {
		margin-top: 40rpx;
		margin-bottom: 20rpx;
		z-index: 2;
	}

	.title {
		font-size: 72rpx; 
		color: #5D4037;
		font-weight: 800;
		letter-spacing: 4rpx;
		
		text-shadow: 4rpx 4rpx 0 #fff, 
		             8rpx 8rpx 0 rgba(255, 138, 101, 0.2);
		transform: rotate(-2deg) translateY(80rpx);
		margin-bottom: 10rpx;
	}

	.subtitle-container {
		margin-bottom: 60rpx;
		z-index: 2;
		text-align: center;
	}

	.subtitle {
		display: inline-block;
		font-size: 32rpx; 
		color: #5D4037; 
		background: #FFE0B2; 
		padding: 12rpx 36rpx;
		border-radius: 40rpx;
		font-weight: bold;
		box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.05);
	}
	
	
	.subtitle::before, .subtitle::after {
		content: '•'; 
		color: #FF8A65; 
		margin: 0 10rpx;
	}

	.swiper-container {
		width: 100%;
		height: 900rpx;
		z-index: 2;
	}

	.swiper-item {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.back-icon {
		width: 32px;
		height: 32px;
		
		background-image: url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%233E2723' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='19' y1='12' x2='5' y2='12'%3E%3C/line%3E%3Cpolyline points='12 19 5 12 12 5'%3E%3C/polyline%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: center;
		cursor: pointer;
	}

	.card {
		width: 540rpx;
		height: 750rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.4s ease;
		transform: scale(0.9);
		opacity: 0.8;
	}
	
	.card-active {
		transform: scale(1.1); 
		opacity: 1;
		z-index: 5;
		filter: drop-shadow(0 20rpx 40rpx rgba(93, 64, 55, 0.25));
	}

	.card-image {
		width: 100%;
		height: 100%;
		
	}

	
	.swipe-hint-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 20rpx;
		margin-top: -20rpx; 
		z-index: 2;
		opacity: 0.8;
	}

	.hint-text {
		font-size: 28rpx;
		color: #8D6E63;
		font-weight: bold;
		letter-spacing: 2rpx;
	}

	.arrow-left, .arrow-right {
		font-size: 32rpx;
		color: #8D6E63;
		font-weight: bold;
		animation: blink 2s infinite ease-in-out;
	}
	
	.arrow-left { animation-delay: 0s; }
	.arrow-right { animation-delay: 1s; }

	@keyframes blink {
		0%, 100% { opacity: 0.3; transform: scale(0.9); }
		50% { opacity: 1; transform: scale(1.1); }
	}

	.action-btn-container {
		margin-top: 40rpx;
		z-index: 2;
	}

	.action-btn {
		
		background: linear-gradient(135deg, #FFAB91 0%, #D87A46 100%);
		padding: 24rpx 120rpx;
		border-radius: 60rpx;
		border: 4rpx solid #FFF;
		box-shadow: 
			0 12rpx 0 #D87A46, 
			0 30rpx 40rpx rgba(255, 160, 0, 0.3);
		transform: translateY(0);
		transition: transform 0.1s, box-shadow 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.action-btn:active {
		transform: translateY(8rpx);
		box-shadow: 
			0 4rpx 0 #FCD181,
			0 10rpx 20rpx rgba(255, 160, 0, 0.3);
	}

	.action-btn-text {
		font-size: 36rpx;
		color: #ffffff;
		font-weight: 700;
		letter-spacing: 4rpx;
	}
</style>

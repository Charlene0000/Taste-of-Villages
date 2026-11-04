<template>
	<view class="container" v-if="foodData">
		
		<view class="deco deco-flower"></view>
		<view class="deco deco-leaf"></view>
		<view class="deco deco-wheat"></view>

		
		<view class="nav-bar">
			<view class="back-icon" @click="goBack"></view>
		</view>

		
		<view class="hero-card fade-in-up">
			<view class="hero-img-container">
				<image :src="foodData.hero_image" mode="aspectFill" class="hero-img"></image>
			</view>
		</view>

		
		<view class="title-section fade-in-up" style="animation-delay: 0.1s;">
			<view class="main-title-row">
				<text class="main-title">{{ foodData.name }}</text>
				<text class="title-deco">❀</text>
			</view>

			<view class="location-tag">
				<view class="location-icon"></view>
				<text>{{ foodData.location }}</text>
			</view>

			<view class="tags-row">
				<text class="tag" v-for="(tag, index) in foodData.tags" :key="index">{{ tag }}</text>
			</view>
		</view>

		
		<view class="content-section fade-in-up" style="animation-delay: 0.2s;">
			<view class="section-title">美味故事</view>

			<view class="text-p" v-for="(para, index) in foodData.story_paragraphs" :key="index">
				<rich-text :nodes="para" style="font-family: 'PingFang SC', sans-serif;"></rich-text>
			</view>
		</view>

		
		<view class="bee">{{ foodData.decorative_emoji }}</view>

		
		<view class="bottom-bar-wrapper">
			<view class="bottom-bar">
				<view class="like-btn" @click="toggleLike" :class="{ 'liked': isLiked }">
					<view class="heart-icon" :class="{ 'active': isLiked }"></view>
				</view>
				<button class="cta-btn" @click="goToDaka">
					去打卡
					<text style="font-family:sans-serif; margin-left:8px;">→</text>
				</button>
			</view>
		</view>
	</view>
	<view class="loading-container" v-else>
		<text>加载中...</text>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				isLiked: false,
				foodData: null,
				loading: true,
                currentSlug: '',
                
                locationConfig: {
                    'shaqima': { lat: 23.140422, lng: 113.351711, locationId: 101 }, 
                    'caibaoguo': { lat: 23.083, lng: 115.65, locationId: 102 },
                    'taohuaguo': { lat: 22.97, lng: 115.35, locationId: 103 },
                    'chenzhouhao': { lat: 22.82, lng: 115.25, locationId: 104 },
                    'paiguxianfan': { lat: 22.85, lng: 115.80, locationId: 105 }
                },
                passedLocation: null
			}
		},
		onLoad(options) {
			const slug = options.slug || 'shaqima';
            this.currentSlug = slug;
            
            if (options.lat && options.lng) {
                this.passedLocation = {
                    lat: options.lat,
                    lng: options.lng
                };
            }
            
            this.checkIfLiked(slug);
			this.fetchFoodInfo(slug);
		},
		methods: {
            checkIfLiked(slug) {
                try {
                    const list = uni.getStorageSync('myLikesList') || [];
                    this.isLiked = list.some(item => item.id === slug);
                } catch (e) {}
            },
			async fetchFoodInfo(slug) {
				this.loading = true;
				try {
					const res = await uniCloud.callFunction({
						name: 'get_food_info',
						data: { slug: slug }
					});
					
					if (res.result.code === 0) {
						const data = res.result.data;
						if (data.story_paragraphs && Array.isArray(data.story_paragraphs)) {
							data.story_paragraphs = data.story_paragraphs.map(p => 
								p.replace(/<text class="highlight">/g, '<span style="color: #D87A46; font-weight: bold; background: linear-gradient(to top, rgba(216, 122, 70, 0.1) 50%, transparent 50%); display: inline-block;">')
								 .replace(/<\/text>/g, '</span>')
							);
						}
						this.foodData = data;
					} else {
						uni.showToast({
							title: '未找到美食信息',
							icon: 'none'
						});
					}
				} catch (e) {
					console.error("Cloud Function Error Details:", e);
					uni.showModal({
						title: '加载失败',
						content: '错误信息: ' + (e.message || JSON.stringify(e)),
						showCancel: false
					});
				} finally {
					this.loading = false;
				}
			},
			goBack() {
				uni.navigateBack();
			},
			toggleLike() {
				this.isLiked = !this.isLiked;
                if (!this.foodData) return;
                
                try {
                    let list = uni.getStorageSync('myLikesList') || [];
                    if (this.isLiked) {
                        
                        const exists = list.some(i => i.id === this.currentSlug);
                        if (!exists) {
                            const now = new Date();
                            const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                            list.unshift({
                                id: this.currentSlug,
                                title: this.foodData.name,
                                image: this.foodData.hero_image,
                                description: this.foodData.location, 
                                time: dateStr
                            });
                            uni.showToast({ title: '已收藏', icon: 'success' });
                        }
                    } else {
                        
                        list = list.filter(i => i.id !== this.currentSlug);
                    }
                    uni.setStorageSync('myLikesList', list);
                } catch (e) {
                    console.error('Like persistence error:', e);
                }
			},
			goToDaka() {
                if (!this.foodData) return;
                
                const config = this.locationConfig[this.currentSlug] || {};
                
                const targetLat = this.passedLocation ? this.passedLocation.lat : config.lat;
                const targetLng = this.passedLocation ? this.passedLocation.lng : config.lng;
                const targetId = config.locationId || 0;

                
                const params = [
                    `name=${encodeURIComponent(this.foodData.name)}`,
                    `slug=${this.currentSlug}`,
                    `locationId=${targetId}`,
                    `lat=${targetLat || ''}`,
                    `lng=${targetLng || ''}`,
                    `maxDistance=10000`
                ].join('&');
                
				uni.navigateTo({
					url: `/pages/choosedaka/choosedaka?${params}` 
				});
			}
		}
	}
</script>

<style>
    
	page {
		--bg-paper: #FFF9F0;
		--primary-brown: #5D4037;
		--accent-orange: #D87A46;
		--accent-gold: #E6B450;
		--text-body: #6D5E55;
		--watercolor-shadow: 0 10px 20px rgba(139, 69, 19, 0.12);
		background-color: var(--bg-paper);
		color: var(--primary-brown);
		min-height: 100vh;
		font-family: "Songti SC", "Noto Serif SC", "SimSun", serif;
		background-image:
			radial-gradient(circle at 10% 10%, rgba(255, 200, 150, 0.3) 0%, transparent 50%),
			radial-gradient(circle at 90% 60%, rgba(255, 240, 200, 0.4) 0%, transparent 40%),
			url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
	}

	.container {
		width: 100%;
		padding: 0 20px 100px 20px;
		position: relative;
		box-sizing: border-box;
		overflow-x: hidden;
	}
	
	.loading-container {
		display: flex;
		justify-content: center;
		padding-top: 100px;
		color: #8D6E63;
	}

	
	.deco {
		position: absolute;
		z-index: 0;
		opacity: 0.8;
		pointer-events: none;
	}

	.deco-flower {
		top: -20px;
		right: -20px;
		width: 150px;
		height: 150px;
		background: radial-gradient(circle, #ffe0b2 0%, transparent 70%);
		filter: blur(10px);
	}

	.deco-leaf {
		top: 20px;
		right: 10px;
		width: 80px;
		height: 40px;
		background: #A5D6A7;
		border-radius: 50% 0 50% 0;
		transform: rotate(-30deg);
		opacity: 0.4;
		filter: blur(2px);
	}

	.deco-wheat {
		bottom: 80px;
		left: -30px;
		width: 120px;
		height: 120px;
		background: radial-gradient(circle, #E6B450 0%, transparent 70%);
		opacity: 0.3;
		filter: blur(15px);
	}

	
	
	.nav-bar {
		padding-top: calc(var(--status-bar-height) + 10px); 
		height: 44px;
		display: flex;
		align-items: center;
		position: relative;
		z-index: 10;
		margin-bottom: 10px; 
	}

	.back-icon {
		width: 32px;
		height: 32px;
		background-image: url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%233E2723' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='19' y1='12' x2='5' y2='12'%3E%3C/line%3E%3Cpolyline points='12 19 5 12 12 5'%3E%3C/polyline%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: center;
		cursor: pointer;
	}

	
	.hero-card {
		background: #fff;
		padding: 8px;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		box-shadow: var(--watercolor-shadow);
		margin-bottom: 25px;
		position: relative;
		z-index: 2;
		transform: rotate(-1deg);
		animation: float 6s ease-in-out infinite;
	}

	.hero-img-container {
		width: 100%;
		height: 240px;
		overflow: hidden;
		border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
		position: relative;
	}

	.hero-img {
		width: 100%;
		height: 100%;
		filter: contrast(1.05) saturate(1.1) sepia(0.1);
	}

	
	.title-section {
		margin-bottom: 25px;
		position: relative;
		z-index: 2;
	}
	
	.main-title-row {
		display: flex;
		align-items: center;
		margin-bottom: 12px;
	}

	.main-title {
		font-size: 28px;
		font-weight: 900;
		color: #3E2723;
		letter-spacing: 1px;
	}

	.title-deco {
		display: inline-block;
		color: #FBC02D;
		font-size: 20px;
		transform: rotate(20deg);
		margin-left: 5px;
	}

	.location-tag {
		display: inline-flex;
		align-items: center;
		background: rgba(216, 122, 70, 0.1);
		color: #8D6E63;
		padding: 6px 14px;
		border-radius: 20px 25px 25px 20px;
		font-size: 13px;
		font-family: sans-serif;
		margin-bottom: 15px;
	}
	
	.location-icon {
		width: 14px;
		height: 14px;
		margin-right: 6px;
		background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 24 24' fill='%23D87A46' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E");
		background-size: contain;
		background-repeat: no-repeat;
	}

	.tags-row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.tag {
		font-size: 12px;
		color: #A1887F;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(161, 136, 127, 0.2);
		padding: 4px 10px;
		border-radius: 4px;
		font-family: sans-serif;
	}

	
	.content-section {
		position: relative;
		z-index: 2;
	}

	.section-title {
		font-size: 20px;
		font-weight: bold;
		color: #4E342E;
		margin-bottom: 15px;
		display: flex;
		align-items: center;
		position: relative;
	}

	.section-title::after {
		content: '';
		display: block;
		width: 40px;
		height: 8px;
		background: rgba(216, 122, 70, 0.3);
		border-radius: 10px;
		position: absolute;
		left: 0;
		bottom: -5px;
		z-index: -1;
		filter: blur(2px);
	}

	.text-p {
		font-size: 15px;
		line-height: 1.8;
		color: var(--text-body);
		margin-bottom: 20px;
		text-align: justify;
		font-family: "PingFang SC", sans-serif;
	}
	
	
	.text-p .highlight {
		color: var(--accent-orange);
		font-weight: bold;
		background: linear-gradient(to top, rgba(216, 122, 70, 0.1) 50%, transparent 50%);
		display: inline;
	}

	
	.bottom-bar-wrapper {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 90px;
		background: linear-gradient(to top, rgba(255, 249, 240, 1) 40%, rgba(255, 249, 240, 0));
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 100;
		pointer-events: none;
	}

	.bottom-bar {
		width: 100%;
		max-width: 420px;
		padding: 0 25px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		pointer-events: auto;
	}

	.like-btn {
		width: 50px;
		height: 50px;
		background: #fff;
		border-radius: 50%;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: transform 0.2s;
		border: 1px solid rgba(0, 0, 0, 0.02);
	}

	.like-btn:active {
		transform: scale(0.9);
	}
	
	.heart-icon {
		width: 24px;
		height: 24px;
		background-image: url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='%23FFCCBC' stroke='%23FF7043' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/%3E%3C/svg%3E");
		background-size: contain;
		background-repeat: no-repeat;
		transition: all 0.2s;
	}
	
	.heart-icon.active {
		background-image: url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='%23FF5722' stroke='%23FF7043' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/%3E%3C/svg%3E");
		transform: scale(1.2);
	}

	.cta-btn {
		flex: 1;
		margin-left: 20px;
		height: 54px;
		border: none;
		color: #fff;
		font-size: 18px;
		font-weight: bold;
		font-family: "Songti SC", serif;
		letter-spacing: 2px;
		cursor: pointer;
		background: linear-gradient(135deg, #FFAB91 0%, #D87A46 100%);
		border-radius: 255px 25px 225px 25px / 25px 225px 25px 255px;
		box-shadow: 0 6px 15px rgba(216, 122, 70, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.cta-btn:active {
		transform: scale(0.98) rotate(1deg);
		box-shadow: 0 2px 8px rgba(216, 122, 70, 0.3);
	}

	
	.bee {
		position: absolute;
		font-size: 24px;
		bottom: 120px;
		right: 20px;
		animation: fly 4s ease-in-out infinite;
		filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.1));
		z-index: 5;
	}

	@keyframes float {
		0%, 100% { transform: rotate(-1deg) translateY(0); }
		50% { transform: rotate(-1deg) translateY(-8px); }
	}

	@keyframes fly {
		0% { transform: translate(0, 0) rotate(0deg); }
		25% { transform: translate(-10px, -15px) rotate(-10deg); }
		50% { transform: translate(-5px, 0px) rotate(0deg); }
		75% { transform: translate(10px, -10px) rotate(15deg); }
		100% { transform: translate(0, 0) rotate(0deg); }
	}

	
	.fade-in-up {
		opacity: 0;
		transform: translateY(20px);
		animation: fadeInUp 0.8s ease forwards;
	}

	@keyframes fadeInUp {
		to { opacity: 1; transform: translateY(0); }
	}
</style>

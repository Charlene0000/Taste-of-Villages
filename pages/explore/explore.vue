<template>
	<view class="container">
		
		<view class="watercolor-bg"></view>
		<view class="watercolor-bg-2"></view>
		 
		<view class="header">
			<text class="title">寻找乡村美食</text>
			<view class="gallery-entry" @click="goToGallery">
				<text>进入万物长廊</text>
				<text class="arrow">→</text>
			</view>
		</view>

		<view class="card-list">
            <block v-if="loading">
                <view style="text-align:center; padding:50px; color:#aaa;">加载中...</view>
            </block>
			
            <block v-else>
                <view v-if="villageList.length === 0" style="text-align:center; padding:50px; color:#aaa;">
                    <text>暂无数据</text>
                    <view style="font-size:12px; margin-top:10px;">请检查云数据库 'init_food_data' 是否有数据</view>
                </view>
                <view 
                    class="card" 
                    v-for="(item, index) in villageList" 
                    :key="index"
                    @click="handleCardClick(item)"
                >
                    <view class="card-img-box">
                        <image :src="item.location_image" mode="aspectFill" class="card-img"></image>
                    </view>
                    <view class="card-content">
                        <view class="card-header-row">
                            
                            <text class="tag" :style="{ background: getThemeColor(index) }">
                                {{ item.tags && item.tags.length > 0 ? item.tags[0].replace('#', '').trim() : '特色' }}
                            </text>
                            <text class="card-title-text">{{ item.name }}</text> 
                        </view>
                        <view style="margin-bottom:4px;">
                             <text class="card-subtitle-text">{{ extractVillageName(item.location) }}</text>
                        </view>
                        
                        
                        
                        <view class="card-progress-row">
                            <text class="progress-label">已打卡{{ item.checkedCount || 0 }}个地点</text>
                            <text class="progress-value">{{ item.progress || 0 }}%</text>
                        </view>
                    </view>
                    
                    
                    <view class="card-action">
                        <view class="action-btn" :style="{ color: getThemeColor(index), borderColor: getThemeColor(index) }">
                            <text>开始</text>
                            <text>探索</text>
                        </view>
                        
                    </view>
                </view>
            </block>
			
			<view style="height: 100px;"></view>
		</view>

        
        <custom-tab-bar :current="1" @change="onTabChange" />

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
				villageList: [],
                loading: true,
                colors: ['#E6A496', '#E8C37E', '#95B6A8', '#89A3B2', '#BCAAA4']
			}
		},
        onLoad() {
            this.fetchData();
        },
        onShow() {
            
            if (this.villageList.length > 0) {
                this.fetchProgress();
            }
        },
		methods: {
			onTabChange(index) {},
            async fetchData() {
                try {
                    this.loading = true;
                    
                    const listRes = await uniCloud.callFunction({ name: 'get_villages_list' });
                    if (listRes.result && listRes.result.code === 200) {
                        
                        this.villageList = (listRes.result.data || []).map(v => ({
                            ...v,
                            checkedCount: 0,
                            progress: 0
                        }));
                    }
                    
                    
                    await this.fetchProgress();
                    
                } catch (e) {
                    console.error('Fetch error:', e);
                } finally {
                    this.loading = false;
                }
            },
            async fetchProgress() {
                
                
                
                
                let openid = '';
                try {
                    const info = uni.getStorageSync('uni_id_token_expired') > Date.now() ? uni.getStorageSync('uni_id_token') : '';
                    
                    
                    
                    
                    
                    
                    
                    const userRes = await uniCloud.getCurrentUserInfo();
                    openid = userRes.uid;
                } catch(e) {}

                if (!openid) return; 

                const progressRes = await uniCloud.callFunction({
                    name: 'getCheckInRecords',
                    data: { openid }
                });

                if (progressRes.result && progressRes.result.code === 200) {
                    const records = progressRes.result.data;
                    
                    this.villageList = this.villageList.map(v => {
                        const rec = records.find(r => r.slug === v.slug);
                        if (rec) {
                            
                            const checkedCount = rec.status ? Object.values(rec.status).filter(b => b).length : 0;
                            return { ...v, progress: rec.progress, checkedCount };
                        }
                        return v;
                    });
                }
            },
            getThemeColor(index) {
                return this.colors[index % this.colors.length];
            },
            extractVillageName(locationStr) {
                if (!locationStr) return '';
                const match = locationStr.match(/[\u4e00-\u9fa5]{2,5}村/);
                return match ? match[0] : locationStr;
            },
			handleCardClick(item) {
                if (!item || !item.slug) return;
				
                
                const COORDINATES_MAP = {
                    'shaqima': { lat: 22.786961, lng: 115.565232, id: 101 },
                    'caibaoguo': { lat: 23.013, lng: 115.75, id: 102 },
                    'taohuaguo': { lat: 22.97, lng: 115.39, id: 103 },
                    'chenzhouhao': { lat: 22.75, lng: 115.25, id: 104 },
                    'paiguxianfan': { lat: 22.85, lng: 115.80, id: 105 },
                    'shaqima_test': { lat: 23.140422, lng: 113.351711, id: 999 } 
                };

                
                const mapping = COORDINATES_MAP[item.slug] || {};
                const targetLat = item.latitude || mapping.lat || 0;
                const targetLng = item.longitude || mapping.lng || 0;
                const targetId = item._id || mapping.id || '';

				uni.showToast({ title: '准备出发...', icon: 'none' });
                
                setTimeout(() => {
                    const params = [
                        `slug=${item.slug}`,
                        `locationId=${targetId}`,
                        `lat=${targetLat}`,
                        `lng=${targetLng}`,
                        `name=${encodeURIComponent(item.name || '')}`
                    ].join('&');
                    
                    uni.navigateTo({
                        url: `/pages/choosedaka/choosedaka?${params}`
                    });
                }, 500);
			},
			goToGallery() {
				uni.navigateTo({
					url: '/pages/gallery/gallery'
				})
			}
		}
	}
</script>

<style scoped lang="scss">
	
	.container {
		background-color: #FFFBF0; 
		min-height: 100vh;
		padding: 20px;
		box-sizing: border-box;
		position: relative;
        
		font-family: "Songti SC", "Noto Serif SC", "SimSun", serif;
	}
	
	
	.watercolor-bg {
		position: absolute;
		top: -50px; left: -50px;
		width: 300px; height: 300px;
		background: radial-gradient(circle, #FFE082 0%, transparent 70%);
		opacity: 0.6;
		filter: blur(40px);
		z-index: 0;
	}
	.watercolor-bg-2 {
		position: absolute;
		bottom: 100px; right: -50px;
		width: 250px; height: 250px;
		background: radial-gradient(circle, #FFCCBC 0%, transparent 70%);
		opacity: 0.6;
		filter: blur(30px);
		z-index: 0;
	}

	
	.header {
		text-align: center;
		padding: 20px 0 30px;
		position: relative;
		z-index: 1;
	}

	.title {
		font-size: 22px;
		letter-spacing: 2px;
		color: #5D4037;
		font-weight: 600;
		display: block;
        margin-top: 28rpx; 
	}

	.gallery-entry {
		margin-top: 20rpx;
		background: #FFF;
		padding: 15rpx 30rpx;
		border-radius: 40rpx;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4rpx 15rpx rgba(139, 69, 19, 0.1);
		border: 1px solid #FFE0B2;
		
		text { font-size: 24rpx; color: #DC825E; font-weight: bold; }
		.arrow { margin-left: 10rpx; }
		
		&:active { transform: scale(0.98); }
	}
	
	
	.card-list {
		display: flex;
		flex-direction: column;
		gap: 20px;
		position: relative;
		z-index: 1;
		max-width: 600px;
		margin: 0 auto;
	}

	
	.card {
		background: #fff;
		border-radius: 20px;
		box-shadow: 0 8px 20px rgba(139, 69, 19, 0.06);
		display: flex;
		height: 160px; 
		overflow: hidden;
		position: relative;
		border: 1px solid rgba(139, 69, 19, 0.05);
	}

	.card:active {
		transform: translateY(2px);
	}

	
	.card-img-box {
		width: 35%; 
		position: relative;
		overflow: hidden;
		
		clip-path: ellipse(140% 100% at 0% 50%);
		-webkit-clip-path: ellipse(140% 100% at 0% 50%);
	}

	.card-img {
		width: 100%;
		height: 100%;
		object-fit: cover; 
	}

	
	.card-content {
		flex: 1;
		padding: 15px 5px 15px 10px; 
		display: flex;
		flex-direction: column;
		justify-content: flex-start; 
	}

	.card-header-row {
        display: flex;
        align-items: center;
        margin-bottom: 6px;
        flex-wrap: wrap; 
    }

	.card-title-text {
		font-size: 16px;
		font-weight: bold;
		color: #5D4037;
        margin-right: 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
	}
    
    .card-subtitle-text {
        font-size: 12px;
        color: #888;
        margin-left: 2px;
    }
	
	.tag {
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 8px;
		margin-right: 6px;
		color: #fff;
		font-weight: normal;
        display: inline-block;
        white-space: nowrap; 
        flex-shrink: 0;
	}

	.card-desc {
		font-size: 12px;
		color: #8D6E63;
		line-height: 1.5;
		margin-top: 4px;
		
		display: -webkit-box;
		-webkit-line-clamp: 3; 
        line-clamp: 3; 
		-webkit-box-orient: vertical;
		overflow: hidden;
        text-overflow: ellipsis;
	}

    
    .card-progress-row {
        margin-top: auto; 
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding-top: 10rpx;
    }
    
    .progress-label {
        font-size: 12px;
        color: #8D6E63;
    }
    
    .progress-value {
        font-size: 14px;
        font-weight: bold;
        color: #5D4037;
    }

	
	.card-action {
		width: 70px; 
        min-width: 70px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding-right: 10px;
		position: relative;
	}

	
	.action-btn {
		width: 50px;
		height: 50px;
		border-radius: 50%;
		border: 3px solid; 
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #fff;
		font-size: 10px;
		font-weight: bold;
		line-height: 1.2;
		box-shadow: 0 4px 10px rgba(0,0,0,0.05);
		position: relative;
		z-index: 5;
	}
	
    .action-btn::after {
        content: '';
        position: absolute;
        bottom: -3px;
        right: -3px;
        width: 10px;
        height: 10px;
        background: currentColor;
        border-radius: 50%;
    }

	
	.deco-circle {
		position: absolute;
		right: -15px;
		bottom: -15px;
		width: 80px;
		height: 80px;
		border-radius: 50%;
		opacity: 0.1;
		pointer-events: none;
	}

</style>

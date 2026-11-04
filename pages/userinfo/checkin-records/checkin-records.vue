<template>
	<view class="container">
        
        <view class="bg-wrapper">
            <view class="blob blob-1"></view>
            <view class="blob blob-2"></view>
        </view>

        
		<view class="nav-bar">
			<view class="back-btn" @click="goBack">
                <text class="back-icon">❮</text>
            </view>
            <text class="nav-title">打卡记录</text>
		</view>

        
		<scroll-view scroll-y class="content-scroll" v-if="!loading">
            

            <view class="records-list">
                <block v-for="(item, index) in records" :key="index">
                    <view class="village-card fade-in-up" :style="{ animationDelay: index * 0.1 + 's' }">
                        <view class="village-info">
                            <image class="village-img" :src="item.image" mode="aspectFill"></image>
                            <view class="village-text">
                                <text class="v-name">{{ item.name }}</text>
                                <view class="progress-bar-bg">
                                    <view class="progress-bar-fill" :style="{ width: item.progress + '%' }"></view>
                                </view>
                                <text class="progress-text">探索度 {{ item.progress }}%</text>
                            </view>
                        </view>
                        
                        <view class="task-grid">
                            <view class="task-item" :class="{ done: item.status.quiz }">
                                <view class="icon-circle">
                                    <image class="task-icon-img" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/daka1.png" mode="aspectFit"></image>
                                </view>
                                <text>答题</text>
                                <view class="status-badge" v-if="item.status.quiz">✓</view>
                            </view>
                            <view class="task-item" :class="{ done: item.status.location }">
                                <view class="icon-circle">
                                    <image class="task-icon-img" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/map1.png" mode="aspectFit"></image>
                                </view>
                                <text>定位</text>
                                <view class="status-badge" v-if="item.status.location">✓</view>
                            </view>
                            <view class="task-item" :class="{ done: item.status.photo }">
                                <view class="icon-circle">
                                    <image class="task-icon-img" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/photo.png" mode="aspectFit"></image>
                                </view>
                                <text>拍照</text>
                                <view class="status-badge" v-if="item.status.photo">✓</view>
                            </view>
                            <view class="task-item" :class="{ done: item.status.make }">
                                <view class="icon-circle">
                                    <image class="task-icon-img" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/game.png" mode="aspectFit"></image>
                                </view>
                                <text>制作</text>
                                <view class="status-badge" v-if="item.status.make">✓</view>
                            </view>
                        </view>
                    </view>
                </block>
            </view>
            
            <view class="footer-spacer"></view>
		</scroll-view>
        
        <view class="loading-view" v-else>
            <text>加载中...</text>
        </view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				records: [],
                loading: true,
                totalChecked: 0,
                totalScore: 0 
			}
		},
		onShow() {
            this.fetchData();
            this.fetchUserScore();
		},
		methods: {
			goBack() {
				uni.navigateBack();
			},
            async fetchUserScore() {
                
                const userInfo = uni.getStorageSync('uni-id-pages-userInfo');
                if (userInfo && userInfo._id) {
                     const res = await uniCloud.callFunction({
                        name: 'userInit',
                        data: { openid: userInfo._id } 
                    });
                    if (res.result && res.result.data) {
                        this.totalScore = res.result.data.points;
                    }
                }
            },
            async fetchData() {
                try {
                    this.loading = true;
                    const userInfo = uni.getStorageSync('uni-id-pages-userInfo');
                    if (!userInfo) {
                        uni.showToast({ title: '请先登录', icon: 'none' });
                        return;
                    }
                    
                    const res = await uniCloud.callFunction({
                        name: 'getCheckInRecords',
                        data: { openid: userInfo._id }
                    });
                    
                    if (res.result.code === 200) {
                        this.records = res.result.data;
                        
                        
                        this.totalChecked = this.records.filter(r => r.progress > 0).length;
                    }
                } catch (e) {
                    console.error(e);
                    uni.showToast({ title: '加载失败', icon:'none' });
                } finally {
                    this.loading = false;
                }
            }
		}
	}
</script>

<style scoped lang="scss">
    $primary: #5D4037;
    $accent: #FF7043;
    $bg: #FFF9F0;
    
    .container {
        min-height: 100vh;
        background-color: $bg;
        position: relative;
        overflow: hidden;
        font-family: "PingFang SC", sans-serif;
    }
    
    .bg-wrapper {
        position: absolute; width: 100%; height: 100%; z-index: 0;
        .blob { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.5; }
        .blob-1 { top: -50px; left: -50px; width: 300px; height: 300px; background: #FFE0B2; }
        .blob-2 { bottom: 100px; right: -50px; width: 250px; height: 250px; background: #FFCCBC; }
    }
    
    .nav-bar {
        position: relative; z-index: 10;
        padding-top: calc(var(--status-bar-height) + 20px);
        padding-left: 20px;
        height: 44px;
        display: flex; align-items: center; justify-content: center;
        margin-top: -10rpx;
        
        .back-btn {
            width: 40px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 50%;
            position: absolute;
            left: 20px;
        }
        .back-icon {
            font-size: 20px;
            color: #5D4037;
        }
        .nav-title {
            font-size: 24px; font-weight: bold; color: $primary;
            font-family: "Songti SC", "SimSun", serif;
        }
    }
    
    .content-scroll {
        position: relative; z-index: 1; height: 100vh;
        padding: 20px; box-sizing: border-box;
    }
    
    .stats-header {
        display: flex; justify-content: space-around; align-items: center;
        background: rgba(255,255,255,0.8);
        border-radius: 20px;
        padding: 20px;
        margin-bottom: 30px;
        box-shadow: 0 4px 15px rgba(93, 64, 55, 0.05);
        
        .stats-card {
            text-align: center;
            .stats-num { font-size: 24px; font-weight: 800; color: $primary; }
            .stats-num.highlight { color: $accent; }
            .stats-label { font-size: 12px; color: #8D6E63; margin-top: 5px; }
        }
        .stats-divider { width: 1px; height: 30px; background: #EFEBE9; }
    }
    
    .records-list {
        display: flex; flex-direction: column; gap: 20px;
    }
    
    .village-card {
        background: rgba(255, 255, 255, 0.9);
        border-radius: 24px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(161, 140, 119, 0.08);
        
        .village-info {
            display: flex; align-items: center; margin-bottom: 20px;
            .village-img {
                width: 60px; height: 60px; border-radius: 16px; margin-right: 15px;
                background: #eee;
            }
            .village-text {
                flex: 1;
                .v-name { font-size: 18px; font-weight: bold; color: $primary; display: block; margin-bottom: 8px; }
                .progress-bar-bg {
                    width: 100%; height: 6px; background: #F5E8E0; border-radius: 3px; overflow: hidden;
                    .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #FFCCBC, #FF7043); transition: width 0.5s ease; }
                }
                .progress-text { font-size: 10px; color: #A1887F; margin-top: 4px; display: block; }
            }
        }
        
        .task-grid {
            display: flex; justify-content: space-between;
            padding: 0 10px;
            
            .task-item {
                display: flex; flex-direction: column; align-items: center; opacity: 0.5;
                position: relative;
                
                &.done { opacity: 1; .icon-circle { background: #FFF3E0; color: #E65100; border: 1px solid #FFCCBC; } }
                
                .icon-circle {
                    width: 44px; height: 44px; border-radius: 50%;
                    background: #F5F5F5; color: #BCAAA4;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 20px; margin-bottom: 6px;
                    transition: all 0.3s;
                    
                    .task-icon-img {
                        width: 24px; height: 24px;
                    }
                }
                text { font-size: 11px; color: #8D6E63; }
                
                .status-badge {
                    position: absolute; top: -2px; right: -2px;
                    width: 14px; height: 14px; background: #4CAF50;
                    color: white; border-radius: 50%;
                    font-size: 9px; display: flex; align-items: center; justify-content: center;
                    border: 1px solid white;
                }
            }
        }
    }
    
    .loading-view {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; justify-content: center; align-items: center;
        color: #8D6E63;
    }
    
    .fade-in-down { animation: fadeInDown 0.8s ease forwards; opacity: 0; transform: translateY(-20px); }
    .fade-in-up { animation: fadeInUp 0.8s ease forwards; opacity: 0; transform: translateY(20px); }
    
    @keyframes fadeInDown { to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }
    
    .footer-spacer { height: 40px; }
</style>

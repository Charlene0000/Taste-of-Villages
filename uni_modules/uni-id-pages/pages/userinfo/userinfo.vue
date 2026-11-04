<template>
	<view class="app-container">
		
		<view class="bg-layer">
			<view class="sun-glow"></view>
			<view class="blob blob-1"></view>
			<view class="blob blob-2"></view>
		</view>

		
		<view class="header-section">
			<view class="avatar-wrapper">
				<view class="avatar-ring"></view>
				<uni-id-pages-avatar class="avatar-component" width="192rpx" height="192rpx"></uni-id-pages-avatar>
				
				<button class="avatar-btn-overlay" open-type="chooseAvatar" @chooseavatar="onChooseAvatar"></button>
			</view>
			<text class="user-name" @click="editNickname">{{ userInfo.nickname || '未设置昵称' }}</text>
		</view>

		
		<view class="stats-container">
			<view class="stats-card">
				<view class="stat-item">
					<text class="stat-num">{{ points }}</text>
					<view class="stat-label">积分</view>
				</view>
				<view class="stat-item" @click="goToCheckInRecords">
					<text class="stat-num">{{ exploredCount }}</text>
					<view class="stat-label">已探索</view>
				</view>
			</view>
		</view>

		
		<view class="menu-list">
            
			<view class="menu-item" @click="goToCheckInRecords">
				<view class="menu-item-left">
					<view class="icon-wrapper">
                        <image src="/static/icon/daka1.png" mode="aspectFit" class="menu-icon"></image>
                    </view>
					<text class="menu-title">打卡记录</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>

			<view class="menu-item" @click="goToJournal">
				<view class="menu-item-left">
					<view class="icon-wrapper">
                        <image src="/static/icon/about.png" mode="aspectFit" class="menu-icon"></image>
                    </view>
					<text class="menu-title">旅途手账</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>

			<view class="menu-item" @click="goToAchievements">
				<view class="menu-item-left">
					<view class="icon-wrapper">
                        <image src="/static/icon/setting.png" mode="aspectFit" class="menu-icon"></image>
                    </view>
					<text class="menu-title">共生勋章</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>

			<view class="menu-item" @click="goToMyLikes">
				<view class="menu-item-left">
					<view class="icon-wrapper">
                        <image src="/static/icon/like.png" mode="aspectFit" class="menu-icon"></image>
                    </view>
					<text class="menu-title">我的收藏</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>

			

            <view class="menu-item" @click="goToMyPhotos">
				<view class="menu-item-left">
					<view class="icon-wrapper">
                        <image src="/static/icon/photo.png" mode="aspectFit" class="menu-icon"></image>
                    </view>
					<text class="menu-title">我的相册</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>

			<view class="menu-item" @click="goToAbout">
				<view class="menu-item-left">
					<view class="icon-wrapper">
                        <image src="/static/icon/about.png" mode="aspectFit" class="menu-icon"></image>
                    </view>
					<text class="menu-title">关于我们</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>
            
            <view class="menu-item" @click="goToSettings">
				<view class="menu-item-left">
					<view class="icon-wrapper">
                        <image src="/static/icon/setting.png" mode="aspectFit" class="menu-icon"></image>
                    </view>
					<text class="menu-title">设置</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>
            
            
            <view style="height: 300rpx; width: 100%;"></view>
		</view>

        
		<uni-popup ref="dialog" type="dialog">
			<uni-popup-dialog mode="input" :value="userInfo.nickname" @confirm="setNickname" :inputType="setNicknameIng?'nickname':'text'" title="设置昵称" placeholder="请输入要设置的昵称" />
		</uni-popup>
        
        <uni-popup ref="bioDialog" type="dialog">
			<uni-popup-dialog mode="input" :value="userInfo.comment" @confirm="setBio" title="设置个性签名" placeholder="请输入个性签名" />
		</uni-popup>

        
        <view class="settings-mask" :class="{ 'visible': showSettings }" @click="closeSettings">
            <view class="settings-popup" @click.stop :class="{ 'slide-up': showSettings }">
                
                <view class="deco deco-flower"></view>
                <view class="deco deco-leaf"></view>
                <view class="deco deco-wheat"></view>
                <view class="deco deco-cloud"></view>
                <view class="deco deco-sparkle-1"></view>
                <view class="deco deco-sparkle-2"></view>

                <view class="settings-header">
                    <text class="settings-title">设置</text>
                </view>

                <view class="settings-list">
                    <view class="settings-item" @click="clearCache">
                        <view class="item-left">
                            <text class="item-icon">🧹</text>
                            <text class="item-label">清除缓存</text>
                        </view>
                        <text class="item-value">{{ cacheSize }}</text>
                    </view>
                    
                    <view class="settings-item logout-item" @click="logout">
                        <view class="item-left">
                            <text class="item-icon">🚪</text>
                            <text class="item-label">退出登录</text>
                        </view>
                        <text class="item-arrow">›</text>
                    </view>
                </view>

                
            </view>
        </view>
        
        
        <custom-tab-bar :current="3" @change="onTabChange" />
	</view>
</template>

<script>
	const uniIdCo = uniCloud.importObject("uni-id-co")
	import {
		store,
		mutations
	} from '@/uni_modules/uni-id-pages/common/store.js'
	import CustomTabBar from '@/components/custom-tab-bar/index.vue'

	export default {
		components: {
			CustomTabBar
		},
		computed: {
			userInfo() {
				return store.userInfo
			}
		},
		data() {
			return {
				setNicknameIng: false,
                points: 0,
                exploredCount: 0,
                showSettings: false,
                cacheSize: '0 KB'
			}
		},
		async onShow() {
            this.fetchUserPoints();
		},
		methods: {
            checkLogin() {
                try {
                    const userInfo = uni.getStorageSync('uni-id-pages-userInfo') || uni.getStorageSync('uni_id_userinfo')
                    if (userInfo && userInfo._id) {
                        return userInfo._id
                    }
                } catch (e) { console.error('检查登录失败', e) }
                return '';
            },

            async fetchUserPoints() {
                
                const openid = this.userInfo._id || this.checkLogin();
                
                if (!openid) return;
                
                try {
                    
                    const res = await uniCloud.callFunction({ name: 'userInit', data: { openid: openid } })
                    if (res && res.result && res.result.code === 200) {
                        this.points = Number(res.result.data.points) || 0;
                    }
                    
                    
                    const recordRes = await uniCloud.callFunction({ name: 'getCheckInRecords', data: { openid: openid } });
                    if (recordRes.result.code === 200) {
                        const records = recordRes.result.data;
                        
                        this.exploredCount = records.filter(r => r.progress > 0).length;
                    }
                    
                } catch (e) { console.error('获取数据失败', e) }
            },
			onChooseAvatar(e) {
			const avatarUrl = e.detail.avatarUrl;
            if (!avatarUrl) return;
            
            uni.showLoading({ title: '更新中...' });
            
            
            this.uploadAvatarToCOS(avatarUrl);
		},
        
        async uploadAvatarToCOS(tempPath) {
            try {
                console.log('开始上传头像到 COS...');
                
                
                const authRes = await uniCloud.callFunction({
                    name: 'getCosAuth',
                    data: { folder: 'avatar-photo' } 
                });
                
                console.log('getCosAuth 返回:', authRes);
                
                if (!authRes.result || !authRes.result.url) {
                    console.error('getCosAuth 失败:', authRes);
                    throw new Error('获取签名失败，请检查云函数是否已部署');
                }
                
                const auth = authRes.result;
                const cosUrl = `${auth.url}/${auth.formData.key}`;
                
                console.log('准备上传到 COS:', cosUrl);
                
                
                await new Promise((resolve, reject) => {
                    uni.uploadFile({
                        url: auth.url,
                        filePath: tempPath,
                        name: 'file',
                        formData: auth.formData,
                        success: (res) => {
                            console.log('COS 上传响应:', res);
                            if (res.statusCode === 200 || res.statusCode === 204) {
                                resolve(cosUrl);
                            } else {
                                console.error('COS 上传失败，状态码:', res.statusCode);
                                reject(new Error(`上传失败: ${res.statusCode}`));
                            }
                        },
                        fail: (err) => {
                            console.error('COS 上传失败:', err);
                            reject(err);
                        }
                    });
                });
                
                console.log('COS 上传成功，准备更新数据库...');
                
                
                const updateData = {
                    avatar_file: {
                        url: cosUrl
                    }
                };
                
                console.log('更新数据:', updateData);
                
                
                await mutations.updateUserInfo(updateData);
                
                uni.hideLoading();
                
                
            } catch (err) {
                console.error('上传头像失败详细信息:', err);
                uni.hideLoading();
                
                
                let errorMsg = '更新失败';
                if (err.message) {
                    errorMsg = err.message;
                } else if (err.errMsg) {
                    errorMsg = err.errMsg;
                }
                
                uni.showToast({ 
                    title: errorMsg, 
                    icon: 'none',
                    duration: 3000
                });
            }
        },
			setNickname(nickname) {
				if (nickname) {
					mutations.updateUserInfo({
						nickname
					})
					this.setNicknameIng = false
					this.$refs.dialog.close()
				} else {
					this.$refs.dialog.open()
				}
			},
			editNickname() {
				this.$refs.dialog.open()
			},
            setBio(comment) {
                if (comment) {
                    mutations.updateUserInfo({
                        comment
                    })
                    this.$refs.bioDialog.close()
                }
            },
            editBio() {
                this.$refs.bioDialog.open()
            },
            goToCheckInRecords() {
                console.log('点击打卡记录')
				uni.navigateTo({
					url: '/pages/userinfo/checkin-records/checkin-records',
					fail: (err) => {
						console.error('跳转失败:', err)
						uni.showToast({
							title: '页面跳转失败',
							icon: 'none'
						})
					}
				})
            },
			goToMyLikes() {
				console.log('点击我的点赞')
				uni.navigateTo({
					url: '/pages/userinfo/my-likes/my-likes',
					fail: (err) => {
						console.error('跳转失败:', err)
						uni.showToast({
							title: '页面跳转失败',
							icon: 'none'
						})
					}
				})
			},
			goToMyOrders() {
				console.log('点击我的订单')
				uni.navigateTo({
					url: '/pages/userinfo/my-orders/my-orders',
					fail: (err) => {
						console.error('跳转失败:', err)
						uni.showToast({
							title: '页面跳转失败',
							icon: 'none'
						})
					}
				})
			},
            goToMyPhotos() {
				console.log('点击我的相册')
				uni.navigateTo({
					url: '/pages/userinfo/my-photos/my-photos',
					fail: (err) => {
						console.error('跳转失败:', err)
						uni.showToast({
							title: '页面跳转失败',
							icon: 'none'
						})
					}
				})
			},
			goToAbout() {
				console.log('点击关于我们')
				uni.navigateTo({
					url: '/pages/userinfo/about/about',
					fail: (err) => {
						console.error('跳转失败:', err)
						uni.showToast({
							title: '页面跳转失败',
							icon: 'none'
						})
					}
				})
			},
			goToJournal() {
				uni.navigateTo({
					url: '/pages/journal/journal'
				})
			},
			goToAchievements() {
				uni.navigateTo({
					url: '/pages/achievements/achievements'
				})
			},
            goToSettings() {
                console.log('点击设置')
				this.openSettings();
            },
			onTabChange(index) {
				console.log('TabBar切换到:', index);
			},
            
            
            openSettings() {
                try {
                    const res = uni.getStorageInfoSync();
                    
                    if (res.currentSize > 1024) {
                        this.cacheSize = (res.currentSize / 1024).toFixed(2) + ' MB';
                    } else {
                        this.cacheSize = res.currentSize + ' KB';
                    }
                } catch (e) {
                    this.cacheSize = '0 KB';
                }
                this.showSettings = true;
            },
            closeSettings() {
                this.showSettings = false;
            },
            clearCache() {
                uni.showModal({
                    title: '清除缓存',
                    content: '确定要清除所有本地缓存吗？',
                    success: (res) => {
                        if (res.confirm) {
                            try {
                                uni.clearStorageSync();
                                this.cacheSize = '0 KB';
                                uni.showToast({ title: '清理完成', icon: 'success' });
                                
                                
                                
                                setTimeout(() => {
                                    this.logout();
                                }, 1000);
                            } catch (e) {
                                uni.showToast({ title: '清理失败', icon: 'none' });
                            }
                        }
                    }
                });
            },
            logout() {
                uni.showModal({
                    title: '退出登录',
                    content: '确定要退出当前账号吗？',
                    success: (res) => {
                        if (res.confirm) {
                            mutations.logout();
                            
                            uni.reLaunch({
                                url: '/pages/index/index' 
                            });
                        }
                    }
                });
            }
		}
	}
</script>

<style lang="scss" scoped>
	

	.app-container {
		width: 100vw;
		min-height: 100vh;
		background-color: #FFFDF9;
		position: relative;
		display: flex;
		flex-direction: column;
	}

	
	.bg-layer {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
		pointer-events: none;
	}

	.sun-glow {
		position: absolute;
		top: -180px;
		left: -20%;
		width: 140%;
		height: 450px;
		background: radial-gradient(circle, #FBDDAB 0%, rgba(251, 221, 171, 0) 70%);
		border-radius: 50%;
		opacity: 0.6;
		filter: blur(20px);
	}

	.blob {
		position: absolute;
		border-radius: 50%;
		filter: blur(40px);
		opacity: 0.6;
	}

	.blob-1 {
		width: 200px;
		height: 200px;
		background: #FBBD72;
		top: -40px;
		right: -60px;
		animation: breathe 6s infinite ease-in-out;
	}

	.blob-2 {
		width: 180px;
		height: 180px;
		background: #DF7D1C;
		top: 100px;
		left: -80px;
		opacity: 0.15;
		animation: breathe 8s infinite ease-in-out reverse;
	}

	@keyframes breathe {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.1); }
	}

	
	.header-section {
		position: relative;
		z-index: 1;
		padding-top: 190rpx; 
		padding-bottom: 60rpx; 
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.avatar-wrapper {
		position: relative;
		margin-bottom: 24rpx;
        width: 192rpx;
        height: 192rpx;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: visible; 
	}
    
    .avatar-btn-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        outline: none;
        z-index: 10;
    }
    .avatar-btn-overlay::after { border: none; }
    
    .avatar-component {
        width: 192rpx !important;
        height: 192rpx !important;
        border-radius: 50% !important;
        border: 8rpx solid #fff;
        box-shadow: 0 16rpx 40rpx rgba(223, 125, 28, 0.2);
        box-sizing: border-box;
        overflow: hidden;
    }
    
    
    .avatar-component ::v-deep .image, 
    .avatar-component ::v-deep image {
        border-radius: 50% !important;
        width: 100% !important;
        height: 100% !important;
    }

	.avatar-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 230rpx;
		height: 230rpx;
		border-radius: 50%;
		border: 4rpx dashed rgba(223, 125, 28, 0.3);
		animation: spin 20s linear infinite;
		z-index: -1;
	}

	@keyframes spin {
		100% { transform: translate(-50%, -50%) rotate(360deg); }
	}

	.vip-badge {
		position: absolute;
		bottom: 10rpx;
		right: 0;
		z-index: 3;
		background: linear-gradient(45deg, #FFB74D, #FF9800);
		color: #fff;
		font-size: 20rpx;
		padding: 6rpx 16rpx;
		border-radius: 24rpx;
		border: 4rpx solid #fff;
		box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.1);
	}

	.user-name {
		font-size: 52rpx;
		color: #5D4037;
		font-weight: 800;
		margin-bottom: 12rpx;
		letter-spacing: 1rpx;
	}

	.user-bio {
		font-size: 26rpx;
		color: #A1887F;
		background-color: rgba(255, 255, 255, 0.4);
		padding: 10rpx 32rpx;
		border-radius: 40rpx;
		border: 2rpx solid rgba(255, 255, 255, 0.6);
        max-width: 80%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
	}

	
	.stats-container {
		margin: -50rpx 40rpx 24rpx; 
		position: relative;
		z-index: 2;
	}

	.stats-card {
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(20rpx);
		border-radius: 40rpx;
		padding: 32rpx; 
		display: flex;
		justify-content: space-around;
		box-shadow: 0 10rpx 30rpx rgba(223, 125, 28, 0.15);
		border: 2rpx solid rgba(255, 255, 255, 1);
	}

	.stat-item {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-num {
		font-size: 44rpx; 
		font-weight: 800;
		color: #DF7D1C;
		font-family: sans-serif;
		margin-bottom: 4rpx;
	}

	.stat-label {
		font-size: 24rpx;
		color: #8D6E63;
	}

	
	.menu-list {
		flex: 1;
		padding: 0 48rpx; 
        box-sizing: border-box;
	}

	.menu-item {
		background-color: #fff;
		margin-bottom: 20rpx; 
		padding: 28rpx 32rpx; 
		border-radius: 32rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-shadow: 0 8rpx 30rpx rgba(141, 110, 99, 0.05);
		transition: all 0.2s;
	}

	.menu-item:active {
		transform: scale(0.98);
		background-color: #FDFBF7;
	}
    
    .menu-item-left {
        display: flex;
        align-items: center;
    }

	.icon-wrapper {
		width: 72rpx; 
		height: 72rpx;
		border-radius: 20rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 28rpx;
		font-size: 36rpx;
	}

	.bg-orange { background: #FFF3E0; color: #EF6C00; }
	.bg-yellow { background: #FFF8E1; color: #FBC02D; }
	.bg-pink { background: #FCE4EC; color: #EC407A; }
    .bg-green { background: #E8F5E9; color: #43A047; }
    .bg-blue { background: #E3F2FD; color: #1E88E5; }
    .bg-gray { background: #F5F5F5; color: #757575; }

	.menu-icon {
        width: 48rpx;
        height: 48rpx;
    }

	.menu-title {
		font-size: 28rpx;
		color: #4E342E;
		font-weight: 600;
	}

	.menu-arrow {
		color: #D7CCC8;
		font-size: 32rpx;
		font-weight: bold;
	}

    
    .settings-mask {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 10000;
        display: flex;
        align-items: flex-end;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
    }
    .settings-mask.visible {
        opacity: 1;
        pointer-events: auto;
    }

    .settings-popup {
        width: 100%;
        height: auto;
        min-height: 50vh;
        
        background: linear-gradient(180deg, #FFF0E6 0%, #FFFAF0 100%);
        border-top-left-radius: 40rpx;
        border-top-right-radius: 40rpx;
        display: flex;
        flex-direction: column;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
        box-shadow: 0 -10rpx 40rpx rgba(0,0,0,0.05);
        position: relative;
        overflow: hidden;
        font-family: "Songti SC", "SimSun", serif;
        padding-bottom: 60rpx;
    }

    .slide-up { transform: translateY(0); }

    
    .deco { position: absolute; pointer-events: none; z-index: 0; opacity: 0.6; filter: blur(2px); }
    .deco-flower {
        top: -20rpx; right: -20rpx; width: 150rpx; height: 150rpx;
        background: radial-gradient(circle at 30% 30%, #FFCCBC, #FFAB91);
        border-radius: 50% 40% 60% 50%; transform: rotate(15deg);
    }
    .deco-leaf {
        top: 100rpx; right: -10rpx; width: 80rpx; height: 120rpx;
        background: linear-gradient(135deg, #C8E6C9 0%, #A5D6A7 100%);
        border-radius: 0 80% 0 80%; transform: rotate(-15deg);
    }
    .deco-wheat {
        bottom: 120rpx; left: -20rpx; width: 100rpx; height: 180rpx;
        background: radial-gradient(ellipse at center, #FFE082 0%, #FFD54F 100%);
        border-radius: 40% 40% 60% 60%; transform: rotate(20deg); opacity: 0.4;
    }
    .deco-cloud {
        top: 40rpx; left: -30rpx; width: 120rpx; height: 80rpx;
        background: #E3F2FD; border-radius: 40% 40% 40% 40%; opacity: 0.5; filter: blur(4px);
    }
    .deco-sparkle-1 {
        top: 200rpx; right: 40rpx; width: 20rpx; height: 20rpx;
        background: #FFF9C4; border-radius: 50%; opacity: 0.8; box-shadow: 0 0 10rpx #FFF9C4;
    }
    .deco-sparkle-2 {
        bottom: 300rpx; left: 30rpx; width: 15rpx; height: 15rpx;
        background: #FFCCBC; border-radius: 50%; opacity: 0.6;
    }

    .settings-header {
        position: relative; z-index: 2;
        padding: 40rpx; text-align: center;
    }
    .settings-title { font-size: 36rpx; font-weight: bold; color: #5D4037; }

    .settings-list {
        position: relative; z-index: 2; padding: 0 40rpx; flex: 1;
    }
    .settings-item {
        background: rgba(255,255,255,0.8);
        border: 2rpx solid #FFF5E6;
        border-radius: 24rpx;
        padding: 30rpx;
        margin-bottom: 24rpx;
        display: flex; justify-content: space-between; align-items: center;
        box-shadow: 0 4rpx 10rpx rgba(139, 69, 19, 0.05);
    }
    .settings-item:active { transform: scale(0.99); background: #FFF; }
    
    .item-left { display: flex; align-items: center; gap: 20rpx; }
    .item-icon { font-size: 36rpx; }
    .item-label { font-size: 30rpx; color: #5D4037; font-weight: 500; }
    .item-value { font-size: 26rpx; color: #A1887F; }
    .item-arrow { color: #D7CCC8; font-size: 32rpx; }

    .logout-item {
        margin-top: 40rpx;
        border-color: #FFCCBC;
        background: rgba(255, 240, 240, 0.8);
    }
    .logout-item .item-label { color: #D84315; }

    .settings-footer {
        position: relative; z-index: 2; 
        padding: 30rpx; text-align: center;
        font-size: 30rpx; color: #8D6E63;
        margin-bottom: 40rpx;
    }
</style>

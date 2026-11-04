<template>
	<view class="shop-container">
		
		<view class="watercolor-bg"></view>
		<view class="watercolor-bg-2"></view>

		
		<view class="header">
			<view class="header-left">
				
				<text class="page-title">藏品小铺</text>
                
                <view class="points-pill">
                    <view class="coin-icon">¥</view>
                    <text class="points-num">{{ displayPoints }}</text>
                </view>
			</view>
		</view>

		
		<view class="daily-checkin" @click="handleCheckin">
			<view class="checkin-info">
				<text class="checkin-title">每日品鉴</text>
				<text class="checkin-desc">签到领 20 美食币</text>
			</view>
			<view class="checkin-btn">签到</view>
		</view>

		
		<view class="tabs">
			<view 
				class="tab-btn" 
				:class="{ active: currentTab === 'market' }" 
				@click="switchTab('market')"
			>美味集市</view>
			<view 
				class="tab-btn" 
				:class="{ active: currentTab === 'records' }" 
				@click="switchTab('records')"
			>我的背包</view>
		</view>

		
		<scroll-view scroll-y class="content-scroll">
			
			
			<view v-if="currentTab === 'market'" class="grid">
				<view 
                    class="nft-card" 
                    v-for="(item, index) in goods" 
                    :key="index"
                >
					<view class="img-box">
                        <image 
                            v-if="item.img_url" 
                            :src="item.img_url" 
                            class="nft-image" 
                            mode="aspectFill"
                            @error="onImageError($event, index)"
                        ></image>
						<block v-else>
                            <view class="img-blob" :style="{ background: item.bg_color || '#FFE0B2' }"></view>
                            <text class="img-emoji">{{ item.emoji || '🎁' }}</text>
                        </block>
					</view>
					<view class="nft-info">
						<text class="nft-name">{{ item.name }}</text>
						<text class="stock-tag">{{ item.description || '限量发售' }}</text>
						<view class="nft-footer">
							<text class="price">{{ item.cost }}</text>
							<view 
								class="btn-redeem" 
								:class="{ disabled: !canBuy(item) }"
								@click="buy(index)"
							>兑换</view>
						</view>
					</view>
				</view>
				
				<view v-if="loading" class="loading-state">
					<text>加载中...</text>
				</view>
			</view>

			
			<view v-if="currentTab === 'records'" class="record-list">
                <block v-if="myItems.length > 0">
                    <view class="my-item-card" v-for="(item, idx) in myItems" :key="idx">
                        <view class="my-item-left">
                            <view class="my-item-icon">
                                <image 
                                    v-if="item.item_image && (item.item_image.startsWith('/') || item.item_image.startsWith('http'))"
                                    :src="item.item_image" 
                                    style="width:100%;height:100%;border-radius:12px;"
                                    mode="aspectFit"
                                ></image>
                                <text v-else style="font-size:24px;">{{ item.item_image || '🎁' }}</text>
                            </view>
                            <view class="my-item-details">
                                <text class="my-item-name">{{ item.item_name }}</text>
                                <text class="my-item-date">{{ new Date(item.create_time).toLocaleDateString() }} 兑换</text>
                            </view>
                        </view>
                        <view class="my-item-badge">已拥有</view>
                    </view>
                </block>
				<view v-else class="empty-state">
					<text>背包空空如也~</text>
					<text class="empty-sub">快去集市看看吧</text>
				</view>
			</view>

		</scroll-view>

        
        
		<custom-tab-bar :current="2" />
        
        
        <daily-signin :visible="showSignin" @update:visible="showSignin = $event" @signed="onSigned" />
	</view>
</template>

<script>
import { businessApi } from '@/utils/auth.js'
import CustomTabBar from '@/components/custom-tab-bar/index.vue'
import DailySignin from '@/components/daily-signin/daily-signin.vue'

export default {
    components: {
        CustomTabBar,
        DailySignin
    },
	data() {
		return {
			openid: '',
			points: 0,
            displayPoints: 0,
            showSignin: false, 
			goods: [],
            myItems: [],
			currentTab: 'market',
			loading: false
		}
	},
	onLoad() {
		this.checkLogin()
		this.fetchData()
	},
	methods: {
        animatePoints(start, end) {
            const diff = end - start;
            if (diff === 0) {
                this.displayPoints = end;
                return;
            }
            const duration = 1000;
            const startTime = Date.now();
            const tick = () => {
                const now = Date.now();
                const progress = Math.min((now - startTime) / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 4); 
                this.displayPoints = Math.floor(start + diff * ease);
                
                if (progress < 1) {
                    setTimeout(tick, 20);
                } else {
                    this.displayPoints = end;
                }
            };
            tick();
        },

        onSigned(newScore) {
            
            if (newScore) {
                this.animatePoints(this.displayPoints || this.points || 0, newScore);
                this.points = newScore;
            }
            this.fetchPoints(); 
        },
		switchTab(tab) {
			this.currentTab = tab;
            if (tab === 'records') {
                this.fetchMyItems();
            }
		},

		checkLogin() {
			try {
				const userInfo = uni.getStorageSync('app_user_info') || uni.getStorageSync('app_user_info')
				if (userInfo && userInfo._id) this.openid = userInfo._id
			} catch (e) { console.error('检查登录失败', e) }
		},

		async fetchData() {
			await this.fetchPoints();
			await this.fetchGoods();
		},
        
        async fetchMyItems() {
            if (!this.openid) return;
            try {
                const res = await businessApi.get_user_orders({ openid: this.openid });
                if (res && res.code === 200) {
                    this.myItems = res.data || [];
                }
            } catch (e) {
                console.error('Fetch My Items Error:', e);
            }
        },

		async fetchPoints() {
			if (!this.openid) return
			try {
				const res = await businessApi.userInit({ openid: this.openid })
				if (res && res && res.code === 200) {
					const p = Number(res.data.points) || 0;
                    this.points = p;
                    
                    if (this.displayPoints === 0) {
                        this.displayPoints = p;
                    }
				}
			} catch (e) { console.error('获取积分失败', e) }
		},

		async fetchGoods() {
			this.loading = true;
			try {
				const res = await businessApi.get_shop_goods();
				if (res && res.code === 200) {
					
					const rawData = res.data || [];
					this.goods = rawData.filter(item => item && typeof item === 'object');
				}
                
                
                if (this.goods.length === 0) throw new Error('Empty Data');

			} catch (e) {
				console.error('获取商品失败或为空，使用本地兜底数据', e);
				
				this.goods = [
					{ _id: '1', name: '特产沙琪玛', cost: 500, img_url: '/static/shop/shaqima.png', description: '限量 500 份' },
                    { _id: '2', name: '趣味贴纸', cost: 80, img_url: '/static/shop/tiezhi.jpg', description: '手账贴纸套装' }
				];
			} finally {
				this.loading = false;
			}
		},

		canBuy(item) {
            if (!item) return false; 
			return this.points >= item.cost
		},

		handleCheckin() {
			this.showSignin = true;
		},

		async buy(index) {
            
            
            const item = this.goods[index];
            
            console.log('Attempting to buy item at index:', index, 'Item:', item);
            
            if (!item) {
                uni.showToast({ title: '商品信息无效', icon: 'none' });
                return;
            }

			if (!this.openid) { 
                uni.showToast({ title: '请先登录', icon: 'none' });
                 setTimeout(() => {
                    uni.navigateTo({ url: '/pages/login/login' })
                 }, 1000);
                return;
            }
			if (!this.canBuy(item)) { uni.showToast({ title: '美食币不足', icon: 'none' }); return }

			uni.showLoading({ title: '兑换中...' })
			try {
				const res = await businessApi.purchaseItem({
						openid: this.openid,
						itemId: item._id,
						itemName: item.name,
						cost: item.cost,
						imgUrl: item.img_url || item.emoji
					})

				const r = res
				if (r && r.code === 200) {
					uni.showToast({ title: '兑换成功!', icon: 'success' })

					// Sprint 5.1 修复：
					// 后端 purchaseItem 返回的是 { code, message, data: order }，
					// **没有 newPoints 字段**。
					// 原代码读 r.data.newPoints → undefined，
					// 于是 this.points 被赋成 undefined，积分显示直接消失。
					//
					// 现在：优先用服务端返回的余额；没有则用本地值减去花费。
					const serverPoints = r.data && typeof r.data.newPoints === 'number'
						? r.data.newPoints
						: (typeof r.data && typeof r.data.points === 'number'
							? r.data.points
							: null)

					const nextPoints = serverPoints !== null
						? serverPoints
						: Math.max(0, (this.points || 0) - (item.cost || 0))

					console.log('[shop] 兑换成功:', {
						服务端余额: serverPoints,
						本地扣减后余额: nextPoints
					})

					this.animatePoints(this.displayPoints || this.points || 0, nextPoints)
					this.points = nextPoints
					this.displayPoints = nextPoints

					// 刷新订单与积分（服务端是权威来源）
					this.fetchMyItems()
					this.fetchPoints()
				} else {
					uni.showToast({ title: r.message || '兑换失败', icon: 'none' })
				}
			} catch (e) {
				console.error('兑换异常', e)
				uni.showToast({ title: '兑换失败，请重试', icon: 'none' })
			} finally { uni.hideLoading() }
		},

        onImageError(e, index) {
            console.error('Image Load Error at index ' + index + ':', e.detail.errMsg);
            
            
        }
	}
}
</script>

<style scoped>

.shop-container {
	width: 100vw;
	height: 100vh;
	background-color: #FFFBF0; 
	position: relative;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	
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
	padding: calc(var(--status-bar-height) + 20px) 20px 10px;
	display: flex;
	justify-content: space-between;
	align-items: center;
	z-index: 10;
}

.header-left {
	display: flex;
	align-items: center;
	gap: 15px;
}

.page-title {
	font-size: 24px;
	color: #5D4037;
	font-weight: normal; 
}

.points-pill {
	background: rgba(255, 255, 255, 0.8);
	padding: 5px 12px;
	border-radius: 50px;
	display: flex;
	align-items: center;
	gap: 5px;
	border: 2px solid #FFD180;
	color: #5D4037;
	font-weight: bold;
	box-shadow: 0 4px 10px rgba(255, 209, 128, 0.3);
}

.coin-icon {
	width: 20px; height: 20px;
	background: #FFD700;
	border-radius: 50%;
	display: flex; align-items: center; justify-content: center;
	font-size: 12px;
	color: #fff;
	box-shadow: inset 0 -2px 0 rgba(0,0,0,0.1);
}


.daily-checkin {
	margin: 10px 20px;
	background: linear-gradient(135deg, #FFAB91, #FFCCBC);
	border-radius: 20px;
	padding: 15px;
	color: white;
	display: flex;
	justify-content: space-between;
	align-items: center;
	position: relative;
	overflow: hidden;
	z-index: 5;
	box-shadow: 0 5px 15px rgba(255, 171, 145, 0.4);
}

.daily-checkin::after {
	content: '🎁';
	position: absolute;
	right: -10px; bottom: -10px;
	font-size: 80px;
	opacity: 0.2;
	transform: rotate(-20deg);
}

.checkin-info {
	display: flex;
	flex-direction: column;
}

.checkin-title { font-size: 16px; font-weight: bold; }
.checkin-desc { font-size: 12px; opacity: 0.9; }

.checkin-btn {
	background: white;
	color: #FF9E80;
	padding: 5px 10px;
	border-radius: 10px;
	font-size: 12px;
	font-weight: bold;
}


.tabs {
	display: flex;
	padding: 0 20px;
	margin-top: 10px;
	gap: 15px;
	z-index: 10;
}

.tab-btn {
	background: transparent;
	border: none;
	font-size: 18px; 
	color: #8D6E63;
	padding-bottom: 5px;
	position: relative;
	transition: all 0.3s;
}

.tab-btn.active {
	color: #5D4037;
	font-size: 20px; 
}

.tab-btn.active::after {
	content: '';
	position: absolute;
	bottom: 0; left: 50%;
	transform: translateX(-50%);
	width: 20px; height: 4px;
	background-color: #FF9E80;
	border-radius: 10px;
}


.content-scroll {
	flex: 1;
	height: 0; 
	box-sizing: border-box;
	padding: 20px;
}


.grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 15px;
	padding-bottom: 120px; 
}

.nft-card {
	background: #FFFFFF;
	border-radius: 20px;
	padding: 10px;
	box-shadow: 0 8px 20px rgba(93, 64, 55, 0.08);
	display: flex;
	flex-direction: column;
	position: relative;
	border: 1px solid #FFF5E5;
	box-sizing: border-box;
	transition: transform 0.2s;
}

.nft-card:active {
	transform: scale(0.98);
}

.img-box {
	width: 100%;
	aspect-ratio: 1;
	border-radius: 15px;
	background: #FFF8E1;
	position: relative;
	overflow: hidden;
	margin-bottom: 10px;
}

.nft-image {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 15px;
}

.img-blob {
	position: absolute;
	width: 80%; height: 80%;
	border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
	opacity: 0.5;
	z-index: 0;
	transform: rotate(0deg);
}

.img-emoji {
	z-index: 1;
	filter: drop-shadow(0 5px 5px rgba(0,0,0,0.1));
}

.nft-info {
	display: flex;
	flex-direction: column;
}

.nft-name {
	font-size: 15px;
	color: #5D4037;
	font-weight: bold;
	margin-bottom: 5px;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.stock-tag {
	font-size: 10px;
	color: #AAA;
	background: #F5F5F5;
	padding: 2px 6px;
	border-radius: 4px;
	align-self: flex-start;
	margin-bottom: 8px; 
}

.nft-footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 5px; 
}

.price {
	color: #FF9E80;
	font-weight: bold;
	font-size: 16px;
}

.btn-redeem {
	background-color: #FFD180;
	color: white;
	padding: 5px 12px;
	border-radius: 12px;
	font-size: 12px;
	font-weight: bold;
	box-shadow: 0 4px 10px rgba(255, 209, 128, 0.4);
}

.btn-redeem.disabled {
	background-color: #EEE;
	color: #AAA;
	box-shadow: none;
}

.loading-state {
	grid-column: 1 / -1; 
	text-align: center;
	color: #AAA;
	font-size: 14px;
	margin-top: 20px;
}


.record-list {
	display: flex;
	flex-direction: column;
	gap: 15px;
	padding-bottom: 120px;
}

.my-item-card {
    background: #FFF;
    padding: 15px;
    border-radius: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 12px rgba(93, 64, 55, 0.05);
    border: 1px solid #FFF5E5;
}

.my-item-left {
    display: flex;
    align-items: center;
    gap: 15px;
}

.my-item-icon {
    width: 50px;
    height: 50px;
    background: #FFF8E1;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
}

.my-item-details {
    display: flex;
    flex-direction: column;
}

.my-item-name {
    font-size: 16px;
    color: #5D4037;
    font-weight: bold;
}

.my-item-date {
    font-size: 12px;
    color: #BCAAA4;
    margin-top: 4px;
}

.my-item-badge {
    font-size: 12px;
    color: #FF9E80;
    background: #FFF3E0;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid #FFE0B2;
}

.empty-state {
	padding: 50px 0;
	text-align: center;
	color: #D7CCC8;
}
.empty-sub {
	display: block;
	font-size: 12px;
	margin-top: 10px;
	color: #EFEBE9;
}
</style>

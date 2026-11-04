<template>
	<view class="signin-modal" v-if="visible" @touchmove.stop.prevent>
		<view class="mask" @click="close"></view>
		<view class="modal-content">
			<view class="close-btn" @click="close">×</view>
			<text class="title">七日签到，美食相伴</text>

			<view class="path-container">
                
                
                <image class="svg-bg" :src="svgUrl" mode="scaleToFill"></image>

				
                <view 
                    class="node" 
                    v-for="(item, index) in nodesList" 
                    :key="index"
                    :style="{ top: item.top, left: item.left }"
                    :class="item.className"
                >
                    <view class="icon-box" :class="{ big: item.day === 7 }">
                        <text class="icon">{{ item.icon }}</text>
                        <view class="check-badge" v-if="item.isSigned">✔</view>
                    </view>
                    <text class="day-text">Day {{ item.day }}</text>
                    <text class="score-text">+{{ item.score }}</text>
                </view>
			</view>

			<view class="btn-wrap">
				<button class="sign-btn" :class="{ disabled: signedInToday }" @click="handleSign">
                    {{ buttonText }}
                </button>
			</view>
		</view>
	</view>
</template>

<script>
	export default {
		name: 'DailySignin',
		props: {
			visible: {
				type: Boolean,
				default: false
			}
		},
		data() {
			return {
                signedInToday: false,
                cycleDay: 1,
                
                icons: ['🥖', '🥐', '☕️', '🍰', '🍜', '🍣', '🥩']
			}
		},
        computed: {
            svgUrl() {
                
                const color = '%23FFE0B2'; 
                
                
                
                
                
                
                
                
                
                
                const path = `M 90 80 L 300 80 L 510 80 Q 560 80 560 130 L 560 210 Q 560 260 510 260 L 300 260 L 90 260 Q 40 260 40 310 L 40 410 Q 40 460 90 460 L 300 460`;
                
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><path d='${path}' fill='none' stroke='${color}' stroke-width='4' stroke-dasharray='10,10' stroke-linecap='round'/></svg>`;
                return 'data:image/svg+xml;utf8,' + svg.replace(/#/g, '%23');
            },
            nodesList() {
                const list = [];
                
                
                const positions = [
                    { t: '40rpx', l: '50rpx' },   
                    { t: '40rpx', l: '260rpx' },  
                    { t: '40rpx', l: '470rpx' },  
                    
                    { t: '220rpx', l: '470rpx' }, 
                    { t: '220rpx', l: '260rpx' }, 
                    { t: '220rpx', l: '50rpx' },  
                    
                    { t: '420rpx', l: '260rpx' }  
                ];

                for (let i = 1; i <= 7; i++) {
                    const idx = i - 1;
                    let className = 'future';
                    let isSigned = false;

                    
                    if (i < this.cycleDay) className = 'signed';
                    else if (i === this.cycleDay) className = this.signedInToday ? 'signed' : 'active';
                    
                    
                    if (i < this.cycleDay) isSigned = true;
                    else if (i === this.cycleDay && this.signedInToday) isSigned = true;

                    
                    let score = 5;
                    if (i >= 3 && i <= 5) score = 10;
                    if (i >= 6) score = 20;

                    list.push({
                        day: i,
                        score,
                        icon: this.icons[idx],
                        className,
                        isSigned,
                        top: positions[idx].t,
                        left: positions[idx].l
                    });
                }
                return list;
            },
            buttonText() {
                if (this.signedInToday) return '今日已签到';
                const day = this.cycleDay || 1;
                let score = 5;
                if (day >= 3 && day <= 5) score = 10;
                if (day >= 6 && day <= 7) score = 20;
                return `立即签到 +${score}分`;
            }
        },
        watch: {
            visible(val) {
                if (val) this.checkStatus();
            }
        },
		methods: {
            close() {
                this.$emit('update:visible', false);
                this.$emit('close');
            },
            async checkStatus() {
                const openid = this.getOpenId();
                if (!openid) return;
                try {
                    const res = await uniCloud.callFunction({ name: 'dailySignIn', data: { action: 'get', openid } });
                    if (res.result.code === 200) {
                        this.signedInToday = res.result.data.signedInToday;
                        this.cycleDay = res.result.data.cycleDay;
                    }
                } catch (e) { console.error(e); }
            },
            async handleSign() {
                if (this.signedInToday) return;
                const openid = this.getOpenId();
                if (!openid) {
                    uni.showModal({
                        title: '提示',
                        content: '打卡签到需要先登录，是否前往登录？',
                        success: (res) => {
                            if (res.confirm) {
                                uni.navigateTo({
                                    url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd?uniIdRedirectUrl=' + encodeURIComponent('/pages/home/show')
                                });
                            }
                        }
                    });
                    return;
                }
                
                uni.showLoading({title:'签到中...'});
                try {
                    const res = await uniCloud.callFunction({ name: 'dailySignIn', data: { action: 'sign', openid } });
                    if (res.result.code === 200) {
                        uni.showToast({title: `签到 +${res.result.data.reward}`, icon: 'success'});
                        this.signedInToday = true;
                        this.checkStatus();
                        this.$emit('signed', res.result.data.newScore);
                    } else {
                        uni.showToast({title: res.result.message || '签到失败', icon:'none'});
                    }
                } catch (e) { uni.showToast({title:'网络错误', icon:'none'}); }
                finally { uni.hideLoading(); }
            },
            getOpenId() {
                try {
                    const u = uni.getStorageSync('uni-id-pages-userInfo') || uni.getStorageSync('uni_id_userinfo');
                    if (u && u._id) return u._id;
                } catch(e){}
                return null;
            }
		}
	}
</script>

<style scoped>
    .signin-modal {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 9999;
        display: flex; justify-content: center; align-items: center;
        font-family: "Songti SC", "Noto Serif SC", serif;
    }
    .mask {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    }
    .modal-content {
        position: relative; width: 620rpx; height: 900rpx;
        background-color: #FFFDF5; border-radius: 30rpx;
        box-shadow: 0 10rpx 40rpx rgba(0,0,0,0.2);
        display: flex; flex-direction: column; align-items: center;
        padding: 40rpx 0rpx;
    }
    .close-btn { position: absolute; top: 20rpx; right: 30rpx; font-size: 50rpx; color: #AAA; padding: 10rpx; z-index: 10; }
    .title {
        font-size: 40rpx; color: #8B5E3C; font-weight: bold; margin-bottom: 20rpx;
        text-shadow: 2rpx 2rpx 0 rgba(200, 150, 100, 0.1);
    }

    .path-container {
        position: relative; width: 100%; flex: 1;
        overflow: hidden; 
    }
    
    .svg-bg {
        width: 600rpx; height: 600rpx;
        position: absolute; top: 0; left: 50%;
        transform: translateX(-50%);
        z-index: 0;
        opacity: 0.8;
    }

    .node {
        position: absolute;
        width: 100rpx;
        display: flex; flex-direction: column; align-items: center;
        z-index: 2;
        transition: all 0.3s;
    }
    
    .icon-box {
        width: 90rpx; height: 90rpx; background: #fff; border-radius: 50%;
        display: flex; justify-content: center; align-items: center;
        box-shadow: 0 6rpx 16rpx rgba(139, 94, 60, 0.15);
        border: 4rpx solid transparent; position: relative;
    }
    .icon-box.big { width: 120rpx; height: 120rpx; border: 6rpx solid transparent; }
    .icon { font-size: 40rpx; }
    .icon-box.big .icon { font-size: 56rpx; }

    .check-badge {
        position: absolute; top: -4rpx; right: -4rpx; width: 32rpx; height: 32rpx;
        background: #4CAF50; color: #fff; border-radius: 50%;
        font-size: 20rpx; display: flex; justify-content: center; align-items: center;
        border: 2rpx solid #fff;
    }

    .day-text { font-size: 22rpx; color: #8B5E3C; margin-top: 6rpx; font-weight: bold; }
    .score-text { font-size: 18rpx; color: #FFAB91; font-weight: bold; margin-top: 2rpx; }

    
    .node.signed .icon-box { background: #FFF8DC; border-color: #FFE0B2; opacity: 1; filter: none; }
    .node.signed .day-text { color: #8B5E3C; }
    
    .node.active .icon-box {
        background: #fff; border-color: #FF9A8B;
        transform: scale(1.15);
        box-shadow: 0 0 30rpx rgba(255, 154, 139, 0.5);
    }
    .node.active .day-text { color: #D84315; }
    
    .node.future { opacity: 0.7; filter: grayscale(0.6); }

    
    .btn-wrap { width: 100%; display: flex; justify-content: center; margin-bottom: 20rpx; position: relative; z-index: 10; }
    .sign-btn {
        background: linear-gradient(135deg, #FABD72, #DF7D1C);
        color: white; border-radius: 50rpx; padding: 0 100rpx; height: 90rpx; line-height: 90rpx;
        font-size: 34rpx; font-weight: bold; box-shadow: 0 10rpx 20rpx rgba(255, 106, 136, 0.25);
    }
    .sign-btn.disabled { background: #CFD8DC; color: #90A4AE; box-shadow: none; }
</style>

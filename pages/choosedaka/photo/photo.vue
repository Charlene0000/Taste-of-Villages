<template>
  <view class="photo-page">
    
    <view class="blob blob-1"></view>
    <view class="blob blob-2"></view>

    
    <view class="nav-bar">
        <view class="left-container">
             <view class="back-icon" @click="goBack"></view>
        </view>
        <text class="nav-title">拍照打卡</text>
        <view class="right-placeholder"></view>
    </view>

    <view class="content">
      <view class="location-tag">{{ currentLocationName || '未知地点' }}</view>

      
      <view class="polaroid-wrapper">
        <view class="sticker-tape"></view>
        <view class="sticker sticker-1">🍋</view>
        <view class="sticker sticker-2">✨</view>

        
        <view class="upload-area" @click="takePhoto">
            <view v-if="images.length === 0" class="upload-placeholder">
                <text class="upload-icon">📷</text>
                <text class="upload-text">点击拍摄 / 上传</text>
                <text class="upload-hint">记录这一刻的美味</text>
            </view>
            <image v-else :src="images[0]" class="preview-main" mode="aspectFill"></image>
        </view>
        
        <view class="polaroid-footer">
            <text class="date-display">{{ currentDate }}</text>
        </view>
      </view>

      
      <view class="preview-list" v-if="images.length > 1">
        <block v-for="(img, idx) in images" :key="idx">
            <image v-if="idx > 0" :src="img" @click="previewImage(idx)" class="preview-thumb" mode="aspectFill"></image>
        </block>
      </view>

      
      <view class="congmei-review-card" v-if="aiResult" :class="{ 'card-show': aiResult }">
        <view class="review-header">
            <image class="congmei-avatar" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/congmei-static.gif" mode="aspectFit"></image>
            <view class="review-title-box">
                <text class="review-title">饼饼品鉴报告</text>
                <text class="review-score">美味指数: {{ aiResult.score }}</text>
            </view>
        </view>
        <view class="review-body">
            <view class="review-quote-start">“</view>
            <text class="review-content">{{ aiResult.comment }}</text>
            <view class="review-quote-end">”</view>
            
            <view class="review-tags" v-if="aiResult.tags && aiResult.tags.length">
                <text class="review-tag" v-for="(tag, tIdx) in aiResult.tags" :key="tIdx">#{{ tag }}</text>
            </view>
        </view>
      </view>

      
      <view class="actions">
        <button v-if="images.length > 0" @click="takePhoto" :disabled="isProcessing" class="action-btn secondary-btn">重拍</button>
        <button @click="uploadAndCheckin" :disabled="!images.length || isProcessing" class="action-btn primary-btn">
            {{ isProcessing ? '打卡中...' : (isCheckedPhoto ? '再次打卡' : '完成打卡') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { businessApi } from '@/utils/auth.js'
import { checkAuth } from '@/utils/router-guard.js'

import { upload } from '@/utils/request.js'
export default {
  data() {
    return {
      openid: '',
      images: [], 
      isCheckedPhoto: false,
      isProcessing: false, 
      locationId: null,
      targetLocation: { latitude: 0, longitude: 0 },
      currentLocationName: '',
      maxDistance: 10000,
      location: {},
      currentDate: '',
      aiResult: null,
      lastPoints: 0 
    }
  },
  onLoad(options) {
    // 路由守卫：未登录访问受保护页面时跳登录
    if (!checkAuth({ route: 'pages/choosedaka/photo/photo' })) return

    if (options) {
      if (options.locationId) this.locationId = options.locationId
      if (options.lat && options.lng && !isNaN(parseFloat(options.lat)) && !isNaN(parseFloat(options.lng))) {
        this.targetLocation = { latitude: parseFloat(options.lat), longitude: parseFloat(options.lng) }
      }
      if (options.name) this.currentLocationName = decodeURIComponent(options.name)
      if (options.maxDistance) this.maxDistance = parseInt(options.maxDistance) || this.maxDistance
    }
    
    
    const now = new Date();
    this.currentDate = `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`;
    
    this.checkLoginStatus();
  },
  onShow() {
    
    if (this.openid && !this.isCheckedPhoto) {
      this.checkPhotoStatus();
    }
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },
    checkLoginStatus() {
      try {
        const userInfo = uni.getStorageSync('app_user_info') 
          || uni.getStorageSync('app_user_info');
        if (userInfo && userInfo._id) {
          this.openid = userInfo._id;
          this.lastPoints = userInfo.score || 0; 
        }
      } catch (e) {
        console.error('检查登录失败', e)
      }
    },
    async takePhoto() {
      try {
        const [err, res] = await uni.chooseImage({
          count: 3,
          sizeType: ['compressed'],
          sourceType: ['camera','album']
        });
        if (err) throw err;
        this.images = res.tempFilePaths || [];
        this.aiResult = null; 
      } catch (e) {
        console.error('选择图片失败', e)
      }
    },
    previewImage(idx) {
      uni.previewImage({ urls: this.images, current: this.images[idx] })
    },
    calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const radLat1 = (lat1 * Math.PI) / 180;
      const radLat2 = (lat2 * Math.PI) / 180;
      const deltaLat = radLat2 - radLat1;
      const deltaLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(radLat1) * Math.cos(radLat2) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    
    async uploadAndCheckin() {
      if (!this.openid) return uni.showToast({ title: '请先登录', icon: 'none' });
      if (this.isProcessing) return; 

      this.isProcessing = true; 
      uni.showLoading({ title: '正在处理...', mask: true });

      try {
        
        const [geoErr, loc] = await uni.getLocation({ type: 'gcj02' });
        if (geoErr) throw new Error('获取定位失败');
        this.location = { latitude: loc.latitude, longitude: loc.longitude };
        
        
        const cloudUrls = [];
        for (let path of this.images) {
          // 上传到本地后端（替代原腾讯云 COS 直传）
          const upRes = await upload(path)
          if (!upRes || !upRes.url) throw new Error('上传失败');
          cloudUrls.push(upRes.url);
        }

        
        uni.showLoading({ title: '饼饼品鉴中...' });
        const aiRes = await businessApi.analyzeFoodPhoto({ fileID: cloudUrls[0] });

        if (aiRes && aiRes.code === 200) {
          this.aiResult = aiRes.data;
          
          if (!this.aiResult.isFood) {
            this.isProcessing = false;
            uni.hideLoading();
            return uni.showModal({ title: '品鉴失败', content: this.aiResult.comment, showCancel: false });
          }
        }

        
        await businessApi.saveUserPhotos({
            openid: this.openid,
            photos: [{
              url: cloudUrls[0],
              images: cloudUrls,
              locationName: this.currentLocationName,
              createTime: Date.now()
            }]
          });

        
        const checkRes = await businessApi.checkIn({
            openid: this.openid,
            location: this.location,
            targetLocation: this.targetLocation,
            locationId: this.locationId,
            maxDistance: 10000000, 
            checkType: 'photo',
            images: cloudUrls
          });

        uni.hideLoading();
        this.isProcessing = false; 

        if (checkRes && checkRes.code === 200) {
          
          const currentPoints = checkRes.data.currentPoints || 0;
          const msg = (currentPoints > this.lastPoints) ? '打卡成功，+70积分' : '打卡成功';
          this.lastPoints = currentPoints; 
          
          uni.showToast({ title: msg, icon: 'success' });
          this.isCheckedPhoto = true;
          uni.setStorageSync('needRefreshPhotos', true);
          
          
          this.$nextTick(() => {
            uni.pageScrollTo({ scrollTop: 9999, duration: 300 });
          });
        } else {
          uni.showToast({ title: checkRes.message || '打卡失败', icon: 'none' });
        }

      } catch (e) {
        this.isProcessing = false;
        uni.hideLoading();
        uni.showToast({ title: '操作失败: ' + (e.message || '网络异常'), icon: 'none' });
      }
    },
    
    async checkPhotoStatus() {
      if (!this.openid || this.locationId == null) return;
      try {
        const res = await businessApi.userInit({ openid: this.openid, locationId: this.locationId, checkType: 'photo' });
        if (res && res.code === 200) {
          this.isCheckedPhoto = !!res.data.alreadyCheckedPlace;
        }
      } catch (e) {
        console.error('检查状态失败', e)
      }
    }
  }
}
</script>

<style scoped>

.photo-page {
    min-height: 100vh;
    background-color: #FFFBF0;
    position: relative;
    overflow: hidden;
    font-family: "Nunito", "ZCOOL KuaiLe", sans-serif;
    
    background-image: radial-gradient(#FFECB3 2px, transparent 2px);
    background-size: 20px 20px;
}


.blob {
    position: absolute;
    filter: blur(50px);
    z-index: 0;
    opacity: 0.6;
    pointer-events: none;
}
.blob-1 { top: -60px; left: -40px; width: 300px; height: 300px; background: #FFCCBC; border-radius: 40%; }
.blob-2 { bottom: 100px; right: -60px; width: 200px; height: 200px; background: #FFE082; border-radius: 50%; }


.nav-bar {
    padding-top: calc(var(--status-bar-height) + 12px); 
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    z-index: 10;
    margin-bottom: 20px; 
    padding-left: 15px;
    padding-right: 15px;
}

.left-container {
    width: 32px;
    z-index: 11;
}

.back-icon {
    width: 32px;
    height: 32px;
    background-image: url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%233E2723' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='19' y1='12' x2='5' y2='12'%3E%3C/line%3E%3Cpolyline points='12 19 5 12 12 5'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    cursor: pointer;
    transform: translateY(8px); 
}

.nav-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%) translateY(8px);
    font-size: 24px;
    font-weight: bold;
    color: #3E2723;
    font-family: "Songti SC", "Noto Serif SC", serif; 
    letter-spacing: 3px;
}

.right-placeholder {
    width: 32px;
}

.content {
    padding: 20px;
    z-index: 5;
    position: relative;
    display: flex;
    flex-direction: column;
}

.location-tag {
    align-self: center;
    background: rgba(255, 255, 255, 0.8);
    color: #5D4037;
    padding: 5px 15px;
    border-radius: 20px;
    font-size: 14px;
    margin-bottom: 5px;
    border: 1px solid #FFCCBC;
}

.info {
    text-align: center;
    font-size: 12px;
    color: #8D6E63;
    margin-bottom: 20px;
}


.polaroid-wrapper {
    background: white;
    padding: 15px 15px 40px 15px;
    border-radius: 4px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.05);
    transform: rotate(-2deg);
    margin: 10px 10px 30px;
    position: relative;
    transition: transform 0.3s;
}

.sticker-tape {
    position: absolute;
    top: -15px; left: 50%; transform: translateX(-50%) rotate(2deg);
    width: 120px; height: 35px;
    background: rgba(255, 224, 178, 0.6);
    border-radius: 2px;
    backdrop-filter: blur(2px);
    z-index: 20;
    pointer-events: none;
}

.sticker {
    position: absolute;
    font-size: 30px;
    z-index: 10;
    pointer-events: none;
}
.sticker-1 { top: -10px; right: -10px; transform: rotate(15deg); }
.sticker-2 { bottom: 10px; left: -10px; transform: rotate(-10deg); }

.upload-area {
    width: 100%;
    aspect-ratio: 1;
    background-color: #FFF8E1;
    border: 2px dashed #FFD54F;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: relative;
    z-index: 5;
    min-height: 200px;
    overflow: hidden;
}

.upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.upload-icon { font-size: 40px; margin-bottom: 10px; }
.upload-text { font-size: 16px; color: #5D4037; margin-bottom: 5px; }
.upload-hint { font-size: 12px; color: #8D6E63; }

.preview-main {
    width: 100%;
    height: 100%;
}

.polaroid-footer {
    text-align: center;
    margin-top: 15px;
}

.date-display {
    font-size: 20px;
    color: #555;
    
     
}


.actions {
    margin-top: 20px;
    display: flex;
    gap: 15px;
}

.action-btn {
    flex: 1;
    border: none;
    padding: 15px;
    border-radius: 50px;
    font-size: 16px;
    font-weight: bold;
    box-shadow: 0 5px 15px rgba(255, 158, 128, 0.4);
}

.primary-btn {
    background: linear-gradient(135deg, #FFD180, #FF9E80);
    color: white;
}
.primary-btn[disabled] {
    background: #E0E0E0;
    color: #999;
    box-shadow: none;
}

.secondary-btn {
    background: white;
    color: #5D4037;
    border: 1px solid #FFCCBC;
}

.preview-list {
    display: flex;
    gap: 10px;
    margin-top: 20px;
    justify-content: center;
}
.preview-thumb {
    width: 60px; height: 60px;
    border-radius: 8px;
    border: 2px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}


.congmei-review-card {
    background: white;
    border-radius: 16px;
    padding: 20px;
    margin: 10px 10px 20px;
    box-shadow: 0 8px 20px rgba(255, 112, 67, 0.15);
    border: 2px solid #FFCCBC;
    animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
    from { opacity: 0; transform: scale(0.9) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}

.review-header {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 2px dashed #FFECB3;
}

.congmei-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 3px solid #FFF;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    background: #FFF;
    margin-right: 15px;
}

.review-title-box {
    display: flex;
    flex-direction: column;
}

.review-title {
    font-size: 18px;
    font-weight: bold;
    color: #3E2723;
    font-family: "Songti SC", serif;
    margin-bottom: 4px;
}

.review-score {
    font-size: 14px;
    color: #FF5722;
    font-weight: bold;
    background: #FBE9E7;
    padding: 2px 8px;
    border-radius: 10px;
    display: inline-block;
    align-self: flex-start;
}

.review-body {
    position: relative;
    padding: 10px 5px;
}

.review-quote-start, .review-quote-end {
    font-size: 40px;
    color: #FFCCBC;
    position: absolute;
    font-family: serif;
    height: 30px;
    line-height: 30px;
}
.review-quote-start { top: -10px; left: -10px; }
.review-quote-end { bottom: -20px; right: 0px; }

.review-content {
    font-size: 16px;
    color: #5D4037;
    line-height: 1.6;
    display: block;
    text-indent: 2em;
    font-weight: 500;
}

.review-tags {
    margin-top: 15px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.review-tag {
    font-size: 12px;
    color: #E65100;
    background: #FFF3E0;
    padding: 4px 12px;
    border-radius: 20px;
}
</style>
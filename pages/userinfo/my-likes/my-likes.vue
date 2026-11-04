<template>
  <view class="likes-container">
    
    <view class="blob blob-1"></view>
    <view class="blob blob-2"></view>

    <view class="header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">❮</text>
      </view>
      <text class="title">我的收藏</text>
    </view>
    
    <view class="content">
      <view class="empty-state" v-if="likesList.length === 0">
        <view class="empty-icon">❤️</view>
        <text class="empty-text">还没收藏过美食</text>
        <text class="empty-desc">去“探索”页面发现更多美味吧</text>
      </view>
      
      <view class="likes-grid" v-else>
        <view class="like-item" v-for="(item, index) in likesList" :key="index" @click="goToDetail(item.id)">
           <view class="img-wrapper">
              <image class="item-image" :src="item.image" mode="aspectFill"></image>
           </view>
          <view class="item-info">
            <text class="item-title">{{ item.title }}</text>
            <view class="item-meta">
                <text class="item-desc">{{ item.description }}</text>
            </view>
            <text class="item-date">{{ item.time }}</text>
          </view>
          
          <view class="like-action" @click.stop="unlike(index)">
            <view class="heart-btn active">
              <text>❤️</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { checkAuth } from '@/utils/router-guard.js'

export default {
  data() {
    return {
      likesList: []
    }
  },
  onLoad() {
    // Sprint 5.1：接入路由守卫（未登录时跳登录页）
    if (!checkAuth({ route: 'pages/userinfo/my-likes/my-likes' })) return
    this.loadLikesList()
  },
  onShow() {
    this.loadLikesList()
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },
    loadLikesList() {
      try {
        const savedLikes = uni.getStorageSync('myLikesList')
        if (savedLikes && Array.isArray(savedLikes)) {
          this.likesList = savedLikes
        } else {
          this.likesList = []
        }
      } catch (e) {
        console.error('加载收藏列表失败:', e)
        this.likesList = []
      }
    },
    unlike(index) {
      uni.showModal({
          title: '取消收藏',
          content: '确定要取消收藏吗？',
          success: (res) => {
              if (res.confirm) {
                  this.likesList.splice(index, 1);
                  uni.setStorageSync('myLikesList', this.likesList);
                  uni.showToast({ title: '已取消', icon: 'none' });
              }
          }
      })
    },
    goToDetail(slug) {
        if (!slug) return;
        uni.navigateTo({
            url: `/pages/food/detail?slug=${slug}`
        });
    }
  }
}
</script>

<style scoped>
.likes-container {
  min-height: 100vh;
  background-color: #FFFBF0;
  position: relative;
  overflow-x: hidden;
  font-family: "Nunito", "PingFang SC", sans-serif;
  
  background-image: radial-gradient(#FFECB3 2px, transparent 2px);
  background-size: 20px 20px;
  display: flex;
  flex-direction: column;
}


.blob {
    position: absolute;
    filter: blur(50px);
    z-index: 0;
    opacity: 0.6;
}
.blob-1 { top: -60px; left: -40px; width: 300px; height: 300px; background: #FFCCBC; border-radius: 40%; }
.blob-2 { bottom: 100px; right: -60px; width: 200px; height: 200px; background: #FFE082; border-radius: 50%; }

.header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--status-bar-height) + 20px) 20px 10px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  z-index: 10;
  position: relative;
  margin-top: -5rpx;
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  position: absolute;
  left: 20px;
}

.back-icon {
  font-size: 20px;
  color: #5D4037;
}

.title {
  font-size: 24px;
  font-weight: bold;
  color: #5D4037;
  font-family: "Songti SC", "SimSun", serif;
}

.content {
  padding: 20px;
  z-index: 5;
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
  background: transparent;
  width: 100%;
  box-sizing: border-box;
  margin: auto;
}

.empty-icon {
  font-size: 140rpx;
  margin-bottom: 30rpx;
  opacity: 0.8;
}

.empty-text {
  font-size: 40rpx;
  color: #5D4037;
  font-weight: bold;
  margin-bottom: 16rpx;
  font-family: "Songti SC", serif;
}

.empty-desc {
  font-size: 30rpx;
  color: #8D6E63;
}

.likes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.like-item {
  position: relative;
  background: white;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 5px 15px rgba(93, 64, 55, 0.08);
  border: 1px solid #FFF5E5;
  transition: transform 0.2s;
}

.like-item:active {
    transform: scale(0.98);
}

.img-wrapper {
    width: 100%;
    height: 140px;
    background: #FFF8E1;
}

.item-image {
  width: 100%;
  height: 100%;
}

.item-info {
    padding: 12px;
}

.item-title {
  display: block;
  font-size: 15px;
  color: #5D4037;
  font-weight: bold;
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
    margin-bottom: 6px;
}

.item-desc {
    font-size: 12px;
    color: #8D6E63;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.item-date {
  font-size: 10px;
  color: #BCAAA4;
  display: block;
  text-align: right;
  margin-top: 4px;
}

.like-action {
  position: absolute;
  top: 10px;
  right: 10px;
}

.heart-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.heart-btn text {
    font-size: 16px;
}
</style>

<template>
  <view class="tabbar-container">
    <view class="tabbar-box">
      
      <view class="menu-group">
        <view 
          v-for="(item, index) in leftMenu" 
          :key="index" 
          class="menu-item" 
          :class="{ active: currIndex === index }" 
          @click="tabClick(index)"
        >
          <image class="icon-image" :src="currIndex === index ? item.selectedIconPath : item.iconPath" mode="aspectFit"></image>
        </view>
      </view>

      
      <view class="center-spacer"></view>

      
      <view class="menu-group">
        <view 
          v-for="(item, index) in rightMenu" 
          :key="item.name" 
          class="menu-item" 
          :class="{ active: currIndex === (index + 2) }" 
          @click="tabClick(index + 2)"
        >
          <image class="icon-image" :src="currIndex === (index + 2) ? item.selectedIconPath : item.iconPath" mode="aspectFit"></image>
        </view>
      </view>
    </view>
    
    
    <view class="center-image-box" @click="openAiChat">
      
      <view class="speech-bubble" v-if="currIndex === 0">
        <view class="bubble-tag">今天吃什么？</view>
        <view class="bubble-text">饼饼来啦！(๑´ڡ`๑)</view>
        <view class="bubble-arrow"></view>
      </view>
      <image class="center-image" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/congmei-static.gif" mode="aspectFit"></image>
    </view>
    
    
    <ai-chat-popup ref="aiPopup" />
  </view>
</template>

<script>
import AiChatPopup from '@/components/ai-chat-mask/index.vue';

export default {
  name: 'CustomTabBar',
  components: {
    AiChatPopup
  },
  props: {
    current: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      menu: [
        {
          name: '首页',
          iconPath: '/static/icon/map.png',
          selectedIconPath: '/static/icon/map-active.png',
          pagePath: '/pages/home/show'
        },
        {
          name: '探索',
          iconPath: '/static/icon/daka.png',
          selectedIconPath: '/static/icon/daka-active.png',
          pagePath: '/pages/explore/explore'
        },
        {
          name: '商城',
          iconPath: '/static/icon/shop.png',
          selectedIconPath: '/static/icon/shop-active.png',
          pagePath: '/pages/shop/shop'
        },
        {
          name: '我的',
          iconPath: '/static/icon/mine.png',
          selectedIconPath: '/static/icon/mine-active.png',
          pagePath: '/pages/userinfo/userinfo'
        }
      ],
      currIndex: 0
    }
  },
  computed: {
    leftMenu() {
      return this.menu.slice(0, 2);
    },
    rightMenu() {
      return this.menu.slice(2, 4);
    }
  },
  watch: {
    current: {
      handler(newVal) {
        this.currIndex = newVal;
      },
      immediate: true
    }
  },
  methods: {
    openAiChat() {
      this.$refs.aiPopup.open();
    },
    tabClick(index) {
      if (this.currIndex === index) return;
      
      this.currIndex = index;
      this.$emit('change', index);
      
      const tabItem = this.menu[index];
      if (tabItem.pagePath) {
        
        uni.reLaunch({
          url: tabItem.pagePath,
          fail: (err) => {
            console.error('Tab Nav Failed:', err);
             
             uni.redirectTo({ url: tabItem.pagePath });
          }
        });
      }
    }
  }
}
</script>

<style scoped>
.tabbar-container {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  pointer-events: none; 
}

.tabbar-box {
  position: absolute;
  left: 50%;
  bottom: 30rpx;
  transform: translateX(-50%);
  width: 680rpx;
  height: 100rpx;
  
  
  background: rgba(255, 248, 240, 0.9); 
  backdrop-filter: blur(10rpx);
  -webkit-backdrop-filter: blur(20rpx);
  
  
  
  mask-image: radial-gradient(circle at 50% -30rpx, transparent 60rpx, black 61rpx);
  -webkit-mask-image: radial-gradient(circle at 50% -30rpx, transparent 60rpx, black 61rpx);
  
  border-radius: 20rpx;
  border-top-left-radius: 30rpx;
  border-top-right-radius: 30rpx;
  border-bottom-left-radius: 30rpx;
  border-bottom-right-radius: 30rpx;
  
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20rpx;
  pointer-events: auto;
  
  
  filter: drop-shadow(0 4rpx 10rpx rgba(0, 0, 0, 0.1));
}

.menu-group {
  display: flex;
  flex: 1;
  justify-content: space-around;
  align-items: center;
}

.center-spacer {
  width: 140rpx; 
  height: 100%;
}

.menu-item {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 80rpx;
  height: 80rpx;
  transition: all 0.2s;
  border-radius: 50%; 
}

.icon-image {
  width: 50rpx;
  height: 50rpx;
}


.menu-item.active {
    background-color: #FFF3E0; 
}

.menu-item.active .icon-image {
  width: 54rpx;
  height: 54rpx;
}

.center-image-box {
  position: absolute;
  left: 50%;
  bottom: 50rpx; 
  transform: translateX(-50%);
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  
  
  background-color: #FFFFFF;
  
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: auto;
  
  
  box-shadow: 0 -4rpx 10rpx rgba(0, 0, 0, 0.1); 
  
  z-index: 10000;
  
  overflow: visible; 
}

.center-image {
  width: 110rpx; 
  height: 110rpx;
  border-radius: 50%;
}


.speech-bubble {
    position: absolute;
    bottom: 140rpx; 
    left: 50%;
    transform: translateX(-50%);
    background-color: white;
    padding: 16rpx 24rpx;
    border-radius: 20rpx;
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.15);
    white-space: nowrap;
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 2rpx solid #D3663D; 
    animation: floatBubble 3s ease-in-out infinite;
    z-index: 10001;
}

.bubble-tag {
    position: absolute;
    top: -24rpx;
    background-color: #DC825E; 
    color: white;
    font-size: 24rpx;
    font-weight: bold;
    padding: 4rpx 12rpx;
    border-radius: 12rpx;
    transform: rotate(-2deg);
    border: 2rpx solid white;
}

.bubble-text {
    font-size: 30rpx;
    color: #333;
    font-weight: bold;
    margin-top: 4rpx;
}

.bubble-arrow {
    position: absolute;
    bottom: -12rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 12rpx solid transparent;
    border-right: 12rpx solid transparent;
    border-top: 12rpx solid #D3663D; 
}

.bubble-arrow::after {
    content: '';
    position: absolute;
    top: -14rpx;
    left: -10rpx;
    width: 0;
    height: 0;
    border-left: 10rpx solid transparent;
    border-right: 10rpx solid transparent;
    border-top: 10rpx solid white;
}

@keyframes floatBubble {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50% { transform: translateX(-50%) translateY(-6rpx); }
}
</style>

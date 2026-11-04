<template>
  <view class="container">
    
    <view class="watercolor-bg"></view>
    <view class="watercolor-bg-2"></view>

    
    <view class="nav-bar">
        <view class="back-btn" @click="goBack">
            <text class="back-icon">❮</text>
        </view>
    </view>

    
    <scroll-view scroll-y class="content-scroll">
      
      
      <view class="brand-section">
        <view class="logo-box">
          <image class="logo-img" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/logo.png" mode="aspectFill"></image> 
        </view>
        <text class="app-name">舌尖上的村落</text>
        <view class="version-tag">
          <text>Version 1.0.0 · 暖心上线</text>
        </view>
      </view>

      
      <view class="card story-card fade-in-up" style="background: transparent; box-shadow: none; border: none; backdrop-filter: none;">
        <view class="card-title">关于小村落</view>
        <view class="card-text">
          嗨，欢迎来到这片藏在地图折痕里的美味天地。
        </view>
        <view class="card-text">
          <text class="highlight">“舌尖上的村落”</text> 不只是一个冷冰冰的导航工具，而是一张带着锅气的手绘藏宝图。我们把那些散落在村口巷尾的隐秘美食，变成了一个个发光的坐标。
        </view>
        
        <view class="feature-grid">
          <view class="feature-item">
            <view class="f-icon">
                <image src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/map1.png" mode="aspectFit" class="feature-img"></image>
            </view>
            <text>手绘地图</text>
          </view>
          <view class="feature-item">
            <view class="f-icon">
                <image src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/game.png" mode="aspectFit" class="feature-img"></image>
            </view>
            <text>趣味打卡</text>
          </view>
          <view class="feature-item">
            <view class="f-icon">
                <image src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/gift.png" mode="aspectFit" class="feature-img"></image>
            </view>
            <text>积分换礼</text>
          </view>
        </view>

        <view class="card-text footer-text">
          在这里，没有复杂的支付账单，只有单纯的<text class="warm-text">探索、打卡、攒积分</text>。希望每一次点击，都能唤醒你味蕾上的乡愁。
        </view>
      </view>

      
      <view class="footer-copyright fade-in-up" style="animation-delay: 0.1s;">
        <text class="copyright-year">© 2025 舌尖上的村落 · All Rights Reserved</text>
        <text class="slogan">Made with ❤️ for Foodies</text>
        <text class="icp-text" @click="copyICP">粤ICP备2025503949号</text>
        <text class="contact-email">联系我们：965304723@qq.com</text>
      </view>

      
      <view style="height: 60px;"></view>

    </scroll-view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      statusBarHeight: 20, 
    };
  },
  onLoad() {
    const systemInfo = uni.getSystemInfoSync();
    this.statusBarHeight = systemInfo.statusBarHeight || 20;
  },
  methods: {
    goBack() {
        uni.navigateBack();
    },
    copyICP() {
        uni.setClipboardData({ data: '粤ICP备2025503949号' });
    }
  }
};
</script>

<style lang="scss" scoped>
$text-color: #5D4037;
$bg-color: #FFFbf5;


.nav-bar {
    padding-top: calc(var(--status-bar-height) + 10px);
    height: 44px;
    display: flex;
    align-items: center;
    position: fixed;
    top: 0; left: 0; width: 100%;
    z-index: 100;
    padding-left: 20px;
}

.back-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 10px rgba(93, 64, 55, 0.1);
}

.back-icon {
    font-size: 20px;
    color: #5D4037;
}

.container {
  min-height: 100vh;
  background-color: $bg-color;
  position: relative;
  overflow: hidden;
  color: $text-color;
  font-family: "PingFang SC", sans-serif;
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

.content-scroll {
  position: relative;
  z-index: 1;
  height: 100vh;
  padding-top: 80px; 
}


.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40rpx;
  margin-bottom: 60rpx;
  
  .logo-box {
    width: 160rpx;
    height: 160rpx;
    margin-bottom: 24rpx;
    background: #fff;
    border-radius: 40rpx;
    padding: 10rpx;
    box-shadow: 0 10rpx 20rpx rgba(93, 64, 55, 0.1);

    .logo-img {
      width: 100%;
      height: 100%;
      border-radius: 30rpx;
    }
  }

  .app-name {
    font-size: 44rpx;
    font-weight: 800;
    letter-spacing: 2rpx;
    color: $text-color;
    margin-bottom: 10rpx;
  }

  .version-tag {
    font-size: 24rpx;
    color: #8D6E63;
    background: #FFF3E0;
    padding: 6rpx 24rpx;
    border-radius: 20rpx;
  }
}


.card {
  margin: 0 40rpx 40rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 40rpx;
  padding: 50rpx 40rpx;
  box-shadow: 0 8rpx 30rpx rgba(161, 140, 119, 0.08);

  .card-title {
    font-size: 36rpx;
    font-weight: bold;
    margin-bottom: 30rpx;
    color: $text-color;
    text-align: center;
    position: relative;
    display: inline-block;
    left: 50%;
    transform: translateX(-50%);
    
    &::after {
        content: '';
        display: block;
        width: 100%;
        height: 8rpx;
        background: #FFAB91;
        opacity: 0.4;
        position: absolute;
        bottom: 2rpx;
        left: 0;
        z-index: -1;
    }
  }
  
  .card-text {
    font-size: 30rpx;
    line-height: 1.8;
    color: #6D4C41;
    margin-bottom: 24rpx;
    text-align: justify;
    
    .highlight { color: #D84315; font-weight: bold; }
    .warm-text { color: #EC407A; font-weight: bold; }
  }

  .footer-text {
      margin-top: 30rpx;
      font-size: 28rpx;
      color: #8D6E63;
      padding-top: 20rpx;
      border-top: 1px dashed #EFEBE9;
  }
}

.feature-grid {
  display: flex;
  justify-content: space-around;
  margin: 40rpx 0;
  
  .feature-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    
    .f-icon {
      font-size: 56rpx;
      margin-bottom: 12rpx;
    }
    text {
      font-size: 26rpx;
      color: #795548;
      font-weight: bold;
    }
  }
}


.footer-copyright {
  text-align: center;
  opacity: 0.7;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  
  text {
    font-size: 22rpx;
    color: #A1887F;
  }
  .icp-text {
      margin-top: 4rpx;
      text-decoration: underline;
  }
}


.fade-in-up {
    animation: fadeInUp 0.8s ease-out forwards;
    opacity: 0;
    transform: translateY(20px);
}
@keyframes fadeInUp {
    to { opacity: 1; transform: translateY(0); }
}


.container {
  min-height: 100vh;
  background-color: $bg-color;
  position: relative;
  overflow: hidden;
  color: $text-color;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
}


.watercolor-bg {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  z-index: 0;
  pointer-events: none;
  
  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.6;
  }
  .blob-1 { top: -100rpx; left: -100rpx; width: 400rpx; height: 400rpx; background: #ffe2e2; }
  .blob-2 { top: 30%; right: -50rpx; width: 300rpx; height: 300rpx; background: #fff4d6; }
  .blob-3 { bottom: 0; left: 20%; width: 500rpx; height: 400rpx; background: linear-gradient(to top, #ffd1ff, transparent); opacity: 0.4; }
}

.content-scroll {
  position: relative;
  z-index: 1;
  height: 100vh;
}

.nav-placeholder {
  height: 88rpx; 
}


.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
  
  .logo-box {
    position: relative;
    width: 180rpx;
    height: 180rpx;
    margin-bottom: 30rpx;
    animation: floatLogo 6s ease-in-out infinite;

    .logo-img {
      width: 100%;
      height: 100%;
      border-radius: 30rpx;
      border: 6rpx solid #fff;
      
      background-color: #fff; 
    }
    
    .logo-shadow {
      position: absolute;
      bottom: -20rpx;
      left: 10%;
      width: 80%;
      height: 20rpx;
      background: rgba(93, 64, 55, 0.1);
      border-radius: 50%;
      filter: blur(5px);
    }
  }

  .app-name {
    font-size: 40rpx;
    font-weight: bold;
    letter-spacing: 2rpx;
    margin-bottom: 12rpx;
    color: $text-color;
  }

  .version-tag {
    font-size: 24rpx;
    color: rgba($text-color, 0.6);
    background: rgba(255,255,255,0.6);
    padding: 6rpx 20rpx;
    border-radius: 20rpx;
    
    .dot { margin: 0 8rpx; }
  }
}

@keyframes floatLogo {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10rpx); }
}


.card {
  margin: 0 40rpx 40rpx 40rpx;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 32rpx;
  padding: 40rpx;
  box-shadow: 0 8rpx 30rpx rgba(161, 140, 119, 0.08);
  border: 2rpx solid rgba(255,255,255,0.8);
  
  .card-title {
    font-size: 32rpx;
    font-weight: 600;
    margin-bottom: 24rpx;
    color: $text-color;
    display: flex;
    align-items: center;
    &::after {
      content: '';
      display: block;
      width: 60rpx;
      height: 6rpx;
      background: #FFCCBC;
      border-radius: 4rpx;
      margin-left: 20rpx;
      opacity: 0.6;
    }
  }
  
  .card-text {
    font-size: 28rpx;
    line-height: 1.7;
    color: #795548;
    margin-bottom: 20rpx;
    text-align: justify;
    
    .highlight {
      color: #FF7043;
      font-weight: bold;
    }
    .warm-text {
      color: #ffb349;
      font-weight: bold;
    }
  }

  .footer-text {
    margin-top: 20rpx;
    font-size: 26rpx;
    color: #8D6E63;
  }
}


.feature-grid {
  display: flex;
  justify-content: space-around;
  margin: 30rpx 0;
  
  .feature-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    
    .f-icon {
      margin-bottom: 10rpx;
      background: #FFF3E0;
      width: 80rpx;
      height: 80rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      
      .feature-img {
          width: 48rpx;
          height: 48rpx;
          border-radius: 0;
      }
    }
    text {
      font-size: 24rpx;
      color: #8D6E63;
    }
  }
}


.team-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  
  .team-member {
    display: flex;
    align-items: center;
    background: rgba(255,255,255,0.5);
    padding: 20rpx;
    border-radius: 20rpx;
    
    .avatar {
      width: 80rpx;
      height: 80rpx;
      border-radius: 50%;
      background: #eee;
      margin-right: 20rpx;
    }
    
    .info {
      display: flex;
      flex-direction: column;
      
      .name {
        font-size: 28rpx;
        font-weight: bold;
        color: $text-color;
      }
      .role {
        font-size: 24rpx;
        color: #A1887F;
        margin-top: 4rpx;
      }
    }
  }
}


.contact-area {
  margin: 0 40rpx 40rpx;
  text-align: center;
  
  .contact-btn {
    background: linear-gradient(135deg, #FF9A9E, #FECFEF);
    color: #fff;
    border-radius: 50rpx;
    font-size: 30rpx;
    font-weight: 600;
    border: none;
    box-shadow: 0 10rpx 20rpx rgba(255, 154, 158, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20rpx 0;
    
    &::after { border: none; }
    
    .icon { margin-right: 10rpx; font-size: 34rpx; }
  }

  .email-copy {
    margin-top: 30rpx;
    font-size: 24rpx;
    color: #A1887F;
    padding: 10rpx;
    
    .copy-hint {
      color: #FF8A65;
    }
  }
}


.footer-copyright {
  text-align: center;
  padding-bottom: 20rpx;
  opacity: 0.6;
  
  text {
    display: block;
    font-size: 20rpx;
    color: #8D6E63;
    line-height: 1.5;
  }
  .slogan {
    font-family: cursive; 
    margin-top: 4rpx;
  }
}
</style>
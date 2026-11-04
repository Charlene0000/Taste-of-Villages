<template>
  <view class="cover-container" :class="{ 'fade-in': isLoaded, 'fade-out': isFading }" @click="goToHome">
    <image src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/fengmian.jpg" class="cover-img" mode="aspectFill" />
  </view>
</template>

<script>
export default {
  data() {
    return {
      isLoaded: false,
      isFading: false,
      hasJumped: false 
    }
  },
  mounted() {
    console.log('封面页已加载，开始淡进动画')
    console.log('当前页面路径:', getCurrentPages()[getCurrentPages().length - 1].route)
    
    
    this.$nextTick(() => {
      this.isLoaded = true
    })
    
    
    setTimeout(() => {
      console.log('开始淡出动画')
      this.isFading = true
      
      
      setTimeout(() => {
        console.log('淡出完成，准备跳转到首页')
        
        
        uni.reLaunch({ 
          url: '/pages/home/show',
          success: () => {
            console.log('跳转成功')
          },
          fail: (err) => {
            console.log('跳转失败:', err)
            
            uni.redirectTo({ 
              url: '/pages/home/show',
              success: () => {
                console.log('redirectTo跳转成功')
              },
              fail: (err2) => {
                console.log('redirectTo也失败:', err2)
              }
            })
          }
        })
      }, 2000)
      
    }, 2500) 
  },
  methods: {
    goToHome() {
      
      if (this.hasJumped) {
        return
      }
      this.hasJumped = true
      
      
      uni.reLaunch({ 
        url: '/pages/home/show',
        success: () => {
          console.log('点击跳转成功')
        },
        fail: (err) => {
          console.log('点击跳转失败:', err)
          
          uni.redirectTo({ 
            url: '/pages/home/show',
            success: () => {
              console.log('redirectTo跳转成功')
            },
            fail: (err2) => {
              console.log('redirectTo也失败:', err2)
            }
          })
        }
      })
    }
  }
}
</script>

<style scoped>
.cover-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  left: 0; top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #000;
  z-index: 9999;
  opacity: 0;
  transition: opacity 1s ease-in-out;
}

.cover-container.fade-in {
  opacity: 1;
}

.cover-container.fade-out {
  opacity: 0;
  transition: opacity 2s ease-in-out;
}

.cover-img {
  width: 100vw;
  height: 100vh;
  object-fit: cover;
}
</style> 
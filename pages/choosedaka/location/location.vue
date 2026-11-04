<template>
  <view class="container">
    
    <view class="blob blob-1"></view>
    <view class="blob blob-2"></view>
    <view class="blob blob-3"></view>

    
    <view class="nav-bar">
        <view class="left-container">
             <view class="back-icon" @click="goBack"></view>
        </view>
        <text class="nav-title">定位打卡</text>
        <view class="right-placeholder"></view>
    </view>

    
    <scroll-view scroll-y class="content-scroll">
        
        
        <view class="postcard-section" v-if="villageData && villageData.name">
            <view class="tape"></view>
            <view class="postcard-frame">
                <image 
                    class="hero-img" 
                    :src="villageData.location_image" 
                    mode="aspectFill"
                ></image>
                <view class="postcard-caption">
                    {{ villageData.location || '汕尾·红海湾' }}
                </view>
            </view>
        </view>

        
        <view v-if="!villageData.name && !loading" class="info-card" style="text-align: center;">
            <text class="desc-text">未找到村庄信息</text>
            <button size="mini" @click="fetchVillageData" style="margin-top:20rpx;">重试</button>
        </view>
        <view v-if="loading" class="info-card" style="text-align: center;">
            <text class="desc-text">加载中...</text>
        </view>

        
        <view class="info-card" v-if="villageData && villageData.name">
            <view class="main-title-row">
                <text class="main-title">{{ villageData.location }}</text>
                <text class="title-deco">❀</text>
            </view>
             <view class="desc-text">
                <text>{{ villageData.location_desc }}</text>
            </view>
        </view>
        
        
        <view class="section-header" v-if="attractions.length > 0">
            <view class="section-title">
                <text></text> 附近探险
            </view>
        </view>

        <view class="timeline-container" v-if="attractions.length > 0">
            <view 
                class="attraction-card" 
                v-for="(item, index) in attractions" 
                :key="index"
                @click="toggleExpand(index)"
                :class="{'expanded': item.expanded}"
            >
                
                <view class="attraction-thumb-box"
                      :style="!item.expanded ? 'border-radius:' + getBorderRadius(index) : ''"
                >
                    <view class="thumb-badge" v-if="!item.expanded">{{ index + 1 }}</view>
                    <view class="thumb-badge-large" v-else>{{ index + 1 }}</view>
                    <image 
                        class="attraction-thumb" 
                        :src="item.image" 
                        mode="aspectFill"
                    ></image>
                </view>
                
                
                <view class="attraction-info">
                    <view class="attraction-name">{{ item.name }}</view>
                    <view class="attraction-desc" :class="{'full-text': item.expanded}">{{ item.expanded ? item.desc : '点击查看更多' }}</view>
                    
                    
                </view>
                
                
                <view 
                  class="checkin-btn" 
                  :class="{'checked': item.checked, 'expanded-btn': item.expanded}"
                  @click.stop="handleCheckIn(item)"
                >
                  
                  <block v-if="!item.expanded">
                      <text class="btn-emoji" v-if="!item.checked">🚩</text>
                      <text class="btn-emoji" v-else>✅</text>
                      <text class="checkin-text-sm">{{ item.checked ? '已打卡' : '打卡' }}</text>
                  </block>
                  
                  
                  <block v-else>
                      <text class="btn-emoji-row" v-if="item.checked">√</text>
                      <text class="checkin-text-lg">{{ item.checked ? '已打卡' : '立即打卡' }}</text>
                  </block>
                </view>
            </view>
        </view>
        
        
        <view style="height: 100px;"></view>
    </scroll-view>
  </view>
</template>

<script>
import { businessApi } from '@/utils/auth.js'
import { checkAuth } from '@/utils/router-guard.js'


export default {
  data() {
    return {
      loading: true,
      villageData: {},
      attractions: [], 
      
      
      openid: '',
      latitude: null,
      longitude: null,
      address: '',
      
      
      targetLocation: {
        latitude: 0,
        longitude: 0
      },
      
      
      slug: '',
      id: '',
      locationId: '' 
    }
  },
  onLoad(options) {
    // 路由守卫：未登录访问受保护页面时跳登录
    if (!checkAuth({ route: 'pages/choosedaka/location/location' })) return

    this.slug = options.slug || '';
    
    this.locationId = options.locationId || options.id || '';
    this.id = this.locationId;
    
    
    if (options.lat && options.lng) {
        this.targetLocation.latitude = parseFloat(options.lat);
        this.targetLocation.longitude = parseFloat(options.lng);
    }
    
    this.checkLoginStatus();
    this.fetchVillageData();
    this.getLocation();
  },
  methods: {
    goBack() {
        uni.navigateBack();
    },
    
    async fetchVillageData() {
      this.loading = true;
      let query = {};
      
      if (this.slug) {
          query.slug = this.slug;
      } else if (this.id && this.id.length > 5) { 
          query.id = this.id;
      }
      
      if (Object.keys(query).length === 0) {
        this.loading = false;
        return;
      }

      uni.showLoading({ title: '加载中...' });
      try {
        const res = await businessApi.get_village_info(query);
        
        if (res && res.code === 200) {
          this.villageData = res.data;
          
          if (!this.locationId && this.villageData._id) {
              this.locationId = this.villageData._id;
              this.id = this.villageData._id;
          }
          
          const COORDINATES_MAP = {
              'shaqima': { latitude: 22.667528, longitude: 115.550222 },
              'caibaoguo': { latitude: 23.083, longitude: 115.65 },
              'taohuaguo': { latitude: 22.97, longitude: 115.35 },
              'chenzhouhao': { latitude: 22.82, longitude: 115.25 }, 
              'paiguxianfan': { latitude: 22.85, longitude: 115.80 },
              'wei_zai': { latitude: 22.667528, longitude: 115.550222 }, 
              'honghaiwan': { latitude: 22.667528, longitude: 115.550222 } 
          };

           
          if (this.villageData.latitude && this.villageData.longitude) {
              this.targetLocation.latitude = parseFloat(this.villageData.latitude);
              this.targetLocation.longitude = parseFloat(this.villageData.longitude);
          } else if (this.slug && COORDINATES_MAP[this.slug]) {
              
               this.targetLocation = COORDINATES_MAP[this.slug];
          } else {
              
              
              
              console.warn('No coordinates found for slug:', this.slug);
          }
          this.processAttractions();
        } else {
          uni.showToast({ title: '获取数据失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '网络错误', icon: 'none' });
      } finally {
        uni.hideLoading();
        this.loading = false;
      }
    },
    
    processAttractions() {
      const data = this.villageData;
      if (!data.attraction) return;
      
      this.attractions = data.attraction.map((name, index) => {
        return {
          name: name,
          desc: data.attraction_desc ? data.attraction_desc[index] : '',
          image: data.attraction_image ? data.attraction_image[index] : '',
          checked: false, 
          id: index,
          expanded: false 
        };
      });
      
      this.fetchUserStatus();
    },

    async fetchUserStatus() {
        if (!this.openid || !this.locationId) return;
        try {
            const res = await businessApi.getUserCheckedSpots({
                    openid: this.openid,
                    locationId: this.locationId
                });
            if (res && res.code === 200) {
                const logs = res.data;
                
                this.attractions.forEach(item => {
                    const spotType = `spot_${item.name}`;
                    
                    
                    
                    const isChecked = logs.some(log => log.type === spotType);
                    if (isChecked) {
                        item.checked = true;
                    }
                });
            }
        } catch (e) {
            console.error('Fetch status failed', e);
        }
    },

    toggleExpand(index) {
        
        
        
        
        this.attractions[index].expanded = !this.attractions[index].expanded;
    },
    
    getBorderRadius(index) {
        const shapes = [
            '30% 70% 70% 30% / 30% 30% 70% 70%',
            '60% 40% 30% 70% / 60% 30% 70% 40%', 
            '40% 60% 60% 40% / 40% 50% 50% 60%',
            '50% 50% 30% 70% / 50% 30% 70% 50%'
        ];
        return shapes[index % shapes.length];
    },

    async checkLoginStatus() {
        
        const userInfo = uni.getStorageSync('app_user_info') 
          || uni.getStorageSync('app_user_info');
        if (userInfo && userInfo._id) {
            this.openid = userInfo._id;
        }
    },

    async getLocation() {
      try {
        const res = await new Promise((resolve, reject) => {
            uni.getLocation({
                type: 'gcj02',
                success: resolve,
                fail: reject
            });
        });
        this.latitude = res.latitude;
        this.longitude = res.longitude;
      } catch (e) {
        console.error('Location error:', e);
      }
    },

    async handleCheckIn(item) {
        if (!this.openid) {
            uni.showToast({ title: '请先登录', icon: 'none' });
             uni.navigateTo({
                url: '/pages/login/login'
              });
            return;
        }
        
        
        if (!this.latitude) {
            await this.getLocation();
            if (!this.latitude) {
                 uni.showToast({ title: '请开启定位', icon: 'none' });
                 return;
            }
        }
        
        if (!this.locationId) {
             uni.showToast({ title: '参数缺失', icon: 'none' });
             return;
        }

        uni.showLoading({ title: '打卡中', mask: true });
        
        try {
            const uniqueType = `spot_${item.name}`;

            const res = await businessApi.checkIn({
                    openid: this.openid,
                    checkType: uniqueType, 
                    locationName: this.villageData.name,
                    spotName: item.name,
                    locationId: this.locationId, 
                    location: {
                        latitude: this.latitude,
                        longitude: this.longitude
                    },
                    targetLocation: this.targetLocation, 
                    timestamp: Date.now()
                });

            uni.hideLoading();
            
            if (res && (res.code === 200 || res.code === 0)) {
                item.checked = true;
                uni.showToast({ title: '打卡成功 +35积分', icon: 'success' });
            } else {
                 uni.showToast({ 
                     title: res.message || '打卡失败', 
                     icon: 'none' 
                 });
            }
        } catch (e) {
            uni.hideLoading();
            uni.showToast({ title: '服务器错误', icon: 'none' });
        }
    }
  }
}
</script>

<style scoped>

.container {
    width: 100vw;
    height: 100vh;
    --bg-paper: #FFF9F0;
    --primary-brown: #5D4037;
    --accent-orange: #D87A46;
    background-color: var(--bg-paper);
    color: var(--primary-brown);
    position: relative;
    overflow: hidden;
    font-family: "Songti SC", "Noto Serif SC", "SimSun", serif;
    
    background-image:
        radial-gradient(circle at 10% 10%, rgba(255, 200, 150, 0.3) 0%, transparent 50%),
        radial-gradient(circle at 90% 60%, rgba(255, 240, 200, 0.4) 0%, transparent 40%),
        url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
}


.blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(40px);
    z-index: 0;
    opacity: 0.6;
}
.blob-1 { top: -50px; right: -50px; width: 200px; height: 200px; background: #FFCCBC; }
.blob-2 { top: 300px; left: -80px; width: 250px; height: 250px; background: #FFE082; }
.blob-3 { bottom: 50px; right: -20px; width: 180px; height: 180px; background: #C8E6C9; }


.nav-bar {
    padding-top: calc(var(--status-bar-height) + 12px); 
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    z-index: 10;
    margin-bottom: 30px; 
    padding-left: 15px;
    padding-right: 15px;
}

.left-container { width: 32px; }
.back-icon {
    width: 32px; height: 32px;
    background-image: url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%233E2723' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='19' y1='12' x2='5' y2='12'%3E%3C/line%3E%3Cpolyline points='12 19 5 12 12 5'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    cursor: pointer;
    transform: translateY(8px);
}
.nav-title {
    font-size: 24px; font-weight: bold; color: #3E2723;
    font-family: "Songti SC", "Noto Serif SC", serif; 
    letter-spacing: 3px;
    transform: translateY(8px);
}
.right-placeholder { width: 32px; }


.content-scroll {
    width: 100%;
    height: calc(100vh - 100px);
    box-sizing: border-box;
    padding: 0 20px 20px 20px;
    z-index: 5;
    position: relative;
}


.postcard-section {
    position: relative;
    margin-bottom: 25px;
    margin-top: 10px;
    transform: rotate(-1deg);
}
.postcard-frame {
    background: white;
    padding: 8px;
    border-radius: 12px;
    box-shadow: 0 8px 20px rgba(93, 64, 55, 0.08);
}
.hero-img {
    width: 100%; height: 200px; border-radius: 8px; background-color: #eee;
}
.postcard-caption {
    text-align: center; margin-top: 8px; color: #5D4037; font-size: 14px; font-weight: bold;
}
.tape {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
    width: 100px; height: 30px; background: rgba(255, 224, 178, 0.7);
    z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}


.info-card {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 24px;
    padding: 20px;
    margin-bottom: 25px;
    border: 1px solid rgba(255,255,255,0.5);
    box-shadow: 0 4px 15px rgba(93, 64, 55, 0.03);
}
.main-title-row { display: flex; align-items: center; margin-bottom: 12px; }
.main-title { font-size: 24px; font-weight: 900; color: #3E2723; letter-spacing: 1px; }
.title-deco { display: inline-block; color: #FBC02D; font-size: 18px; transform: rotate(20deg); margin-left: 5px; }
.desc-text { font-size: 15px; color: #6D5E55; line-height: 1.8; text-align: justify; font-family: "PingFang SC", sans-serif; }


.section-header { margin-bottom: 20px; padding-left: 10px; }
.section-title {
    font-size: 20px; color: #5D4037; font-weight: bold;
    padding-left: 10px; border-left: 5px solid #FFAB91;
    display: flex; align-items: center; gap: 5px;
}


.timeline-container { position: relative; padding-left: 15px; }
.timeline-container::before {
    content: ''; position: absolute; left: 29px; top: 20px; bottom: 20px; width: 2px;
    background-image: linear-gradient(to bottom, #FF8A65 33%, transparent 0%);
    background-position: right; background-size: 1px 12px; background-repeat: repeat-y;
    opacity: 0.3; z-index: 0;
}





.attraction-card {
    background: #fff;
    border-radius: 24px;
    padding: 15px;
    margin-bottom: 20px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.03);
    position: relative;
    z-index: 1;
    border: 1px solid #FFF8E1;
    
    
    display: flex;
    flex-wrap: wrap;
    align-items: center; 
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.attraction-card.expanded {
    background-color: #ffffff;
    align-items: flex-start; 
    padding: 20px;
    box-shadow: 0 10px 40px rgba(93, 64, 55, 0.1);
}


.attraction-thumb-box {
    width: 80px; 
    height: 80px;
    flex-shrink: 0;
    position: relative;
    margin-right: 15px;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    overflow: hidden; 
}


.attraction-card.expanded .attraction-thumb-box {
    width: 100%;
    height: 200px;
    margin-right: 0;
    margin-bottom: 20px;
    border-radius: 12px; 
}

.attraction-thumb {
    width: 100%;
    height: 100%;
    background: #eee;
}



.thumb-badge {
    position: absolute; top: -5px; left: -5px;
    width: 24px; height: 24px; background: #FFE082;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 12px; color: #5D4037; font-weight: bold; border: 2px solid #fff; z-index: 2;
}

.thumb-badge-large {
    position: absolute; top: 10px; left: -10px;
    width: 40px; height: 40px; background: #FFE082;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 20px; color: #5D4037; font-weight: bold; border: 3px solid #fff; z-index: 2;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}



.attraction-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
    transition: all 0.3s;
}

.attraction-card.expanded .attraction-info {
    width: 100%;
    flex: none;
    margin-bottom: 20px; 
}

.attraction-name {
    font-size: 16px; font-weight: bold; color: #5D4037;
    transition: font-size 0.3s;
}
.attraction-card.expanded .attraction-name {
    font-size: 20px; 
    margin-bottom: 10px;
}

.attraction-desc {
    font-size: 14px; color: #9E8D86;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    line-height: 1.5;
    transition: all 0.3s;
}

.attraction-desc.full-text {
    -webkit-line-clamp: 999;
    display: block;
    color: #6D5E55;
    font-size: 15px;
    line-height: 1.8;
}

.click-hint {
    margin-top: 10px;
    color: #FFAB91;
    font-size: 12px;
    font-weight: bold;
    text-align: center;
    animation: fadeIn 0.5s ease-in-out;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }



.checkin-btn {
    width: 55px; height: 55px;
    border-radius: 50%;
    background: linear-gradient(135deg, #FFCCBC, #FFAB91);
    border: 3px solid #fff;
    box-shadow: 0 4px 15px rgba(255, 171, 145, 0.4);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    flex-shrink: 0; cursor: pointer; color: white;
    transform: rotate(10deg);
    transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    margin-left: 10px;
}

.checkin-btn.checked {
    background: linear-gradient(135deg, #A5D6A7, #81C784);
    box-shadow: none;
    transform: rotate(0deg);
}


.checkin-btn.expanded-btn {
    width: auto;
    height: 48px;
    padding: 0 24px;
    border-radius: 24px;
    background: #FF8A65; 
    transform: rotate(0deg);
    margin-left: auto; 
    
    
    margin-top: 10px;
    flex-direction: row;
    gap: 8px;
}

.checkin-btn.expanded-btn.checked {
	
    background: #81C784; 
    box-shadow: 0 4px 15px rgba(129, 199, 132, 0.3);
}

.btn-emoji { font-size: 18px; margin-bottom: -2px; }
.checkin-text-sm { font-size: 10px; font-weight: bold; }

.btn-emoji-row { font-size: 18px; font-weight: bold; }
.checkin-text-lg { font-size: 16px; font-weight: bold; }
</style>

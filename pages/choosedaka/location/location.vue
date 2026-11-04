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
        
        
        <view style="height: 10        </view>

        <!--
          Sprint 5.2：定位状态提示
          H5 端 uni.getLocation 依赖 HTTPS 与浏览器地理位置权限，
          失败时若无任何提示，用户点击打卡就是「没反应」。
          这里把定位状态显式呈现出来，并提供「模拟打卡」入口便于 Web 端联调。
        -->
        <view class="location-status" v-if="!locationOk">
            <view class="status-row">
                <text class="status-icon">📍</text>
                <view class="status-text-wrap">
                    <text class="status-title">{{ locationStatusTitle }}</text>
                    <text class="status-desc">{{ locationStatusDesc }}</text>
                </view>
                <button class="status-retry" size="mini" @click="getLocation">重试</button>
            </view>
            <button class="mock-btn" size="mini" @click="mockCheckIn">
                模拟打卡（跳过定位，仅用于 Web 端联调）
            </button>
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

      // Sprint 5.2：定位状态
      // locationOk      —— 是否已成功获取定位
      // locationError   —— 定位失败的原因（用于给出针对性提示）
      locationOk: false,
      locationError: '',
      locationLoading: false,

      targetLocation: {
        latitude: 0,
        longitude: 0
      },


      slug: '',
      id: '',
      locationId: ''
    }
  },

  computed: {
    /** 定位是否已就绪 */
    locationOk () {
      return !!(this.latitude && this.longitude)
    },

    /** 定位状态标题 */
    locationStatusTitle () {
      if (this.locationLoading) return '正在获取定位...'
      if (this.locationError) return '定位不可用'
      return '等待定位'
    },

    /** 定位状态说明（针对不同失败原因给出不同指引） */
    locationStatusDesc () {
      if (this.locationLoading) return '请稍候'
      if (!this.locationError) return '点击「重试」获取当前位置'

      const err = this.locationError
      // uni.getLocation 在 H5 端的典型失败原因
      if (/auth|permission|denied|deny/i.test(err)) {
        return '浏览器拒绝了定位权限，请在地址栏左侧的权限设置中允许定位'
      }
      if (/https|secure/i.test(err)) {
        return 'H5 端定位要求 HTTPS 环境，本地 http 调试请改用真机或配置 HTTPS'
      }
      if (/timeout/i.test(err)) {
        return '定位超时，请在开阔地方重试，或检查系统定位服务是否开启'
      }
      if (/not support|unsupported/i.test(err)) {
        return '当前平台不支持定位，请使用真机或小程序端'
      }
      return '请在真机环境或 HTTPS 下使用定位'
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
                const logs = res.data || [];
                
                this.attractions.forEach(item => {
                    const spotType = `spot_${item.name}`;
                    
                    
                    
                    // Sprint 5.2：后端 checkIn 的 type 是固定值 'location'
                    // （location/photo/make 三选一，用于进度统计），
                    // 具体是哪个景点靠 checkType 区分。
                    // 所以判断「该景点是否已打卡」需同时看两个字段。
                    const isChecked = logs.some(log =>
                        log.type === spotType ||
                        log.checkType === spotType ||
                        (item.name && log.address === item.name)
                    );
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

    /**
     * 获取当前位置
     *
     * Sprint 5.2 修复：
     * 原实现的 catch 只 console.error，用户点击打卡「没反应」。
     * 现在：
     *   ① 记录失败原因到 locationError（用于界面提示）
     *   ② 失败时弹出明确 toast
     *   ③ 成功时清空错误状态
     */
    async getLocation() {
      this.locationLoading = true;
      console.log('[location] 开始获取定位...');
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
        this.locationOk = true;
        this.locationError = '';
        console.log('[location] 定位成功:', res);
      } catch (e) {
        this.locationOk = false;
        this.locationError = (e && (e.errMsg || e.message)) || '定位失败';
        console.error('[location] 定位失败:', this.locationError);

        // Sprint 5.2：给出明确反馈，而不是静默失败
        uni.showToast({
          title: '定位失败，请查看页面提示',
          icon: 'none',
          duration: 2500
        });
      } finally {
        this.locationLoading = false;
      }
    },

    /**
     * 模拟打卡（跳过真实定位）
     *
     * Sprint 5.2 新增：
     * H5 端定位受 HTTPS 与浏览器权限限制，无法在浏览器里完成真实定位打卡。
     * 这个按钮让开发者能在 Web 端直接联调「打卡 → 落库 → 进度更新」链路，
     * 不必每次都拿真机测试。
     *
     * 走的是与真实打卡**完全相同**的后端接口与参数，
     * 因此它验证的是真实链路，只是跳过了定位这一步。
     */
    async mockCheckIn() {
      if (!this.openid) {
        uni.showToast({ title: '请先登录', icon: 'none' });
        uni.navigateTo({ url: '/pages/login/login' });
        return;
      }

      if (!this.locationId) {
        uni.showToast({ title: '参数缺失', icon: 'none' });
        return;
      }

      uni.showLoading({ title: '模拟打卡中', mask: true });

      try {
        const res = await businessApi.checkIn({
          openid: this.openid,
          // 后端 checkIn 读取的字段：
          locationId: this.locationId,
          address: this.villageData.name || this.villageData.location || '模拟位置',
          type: 'location',
          // 以下为业务侧的附加信息（后端暂未使用，保留语义）
          checkType: 'location',
          locationName: this.villageData.name,
          mock: true
        });

        uni.hideLoading();

        console.log('[location] 模拟打卡响应:', res);

        if (res && res.code === 200) {
          // 标记所有景点为已打卡（模拟态）
          this.attractions.forEach(a => { a.checked = true; });
          uni.showToast({ title: '模拟打卡成功', icon: 'success' });
          // 刷新记录，让进度同步更新
          this.fetchUserStatus && this.fetchUserStatus();
        } else {
          uni.showToast({
            title: (res && (res.errMsg || res.message)) || '模拟打卡失败',
            icon: 'none'
          });
        }
      } catch (e) {
        uni.hideLoading();
        console.error('[location] 模拟打卡失败:', e);
        uni.showToast({
          title: (e && e.message) ? e.message : '模拟打卡失败',
          icon: 'none'
        });
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

            // Sprint 5.2 修复：后端参数对齐
            //
            // 后端 checkIn 实际读取的字段只有三个：
            //   const { locationId, address, type = 'photo' } = req.body
            //
            // 原前端传的是：
            //   { openid, checkType, locationName, spotName, locationId,
            //     location:{lat,lng}, targetLocation, timestamp }
            //
            // → address 缺失 → 打卡记录没有地址
            //   → type 缺失 → 后端默认成 'photo'，
            //     而定位打卡应为 'location'，
            //     导致进度统计把定位打卡误判为拍照打卡
            //
            // 现在把后端真正需要的字段补齐，附加字段继续保留。
            const res = await businessApi.checkIn({
                    openid: this.openid,
                    // —— 后端必读 ——
                    locationId: this.locationId,
                    // address 带上景点名：后端 CheckInPlace 模型没有 checkType 字段，
                    // 而 checkType 存的是 'spot_xxx'，
                    // 所以把景点名写进 address，状态回显时按 address 匹配。
                    address: (item && item.name ? item.name : (this.villageData.name || '')),
                    type: 'location',
                    // —— 业务附加信息 ——
                    checkType: uniqueType,
                    locationName: this.villageData.name,
                    spotName: item.name,
                    location: {
                        latitude: this.latitude,
                        longitude: this.longitude
                    },
                    targetLocation: this.targetLocation,
                    timestamp: Date.now()
                });

            uni.hideLoading();

            console.log('[location] 打卡响应:', res);

            if (res && (res.code === 200 || res.code === 0)) {
                item.checked = true;
                uni.showToast({ title: '打卡成功 +35积分', icon: 'success' });
            } else {
                 uni.showToast({
                     title: (res && (res.errMsg || res.message)) || '打卡失败',
                     icon: 'none'
                 });
            }
        } catch (e) {
            uni.hideLoading();
            console.error('[location] 打卡失败:', e);
            uni.showToast({
                title: (e && e.message) ? e.message : '服务器错误',
                icon: 'none'
            });
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


/* Sprint 5.2：定位状态提示卡 */
.location-status {
	background-color: #FFF8E1;
	border: 1rpx dashed #FFE082;
	border-radius: 20rpx;
	padding: 24rpx 24rpx 20rpx;
	margin: 24rpx 32rpx 8rpx;
}

.status-row {
	display: flex;
	align-items: flex-start;
}

.status-icon {
	font-size: 40rpx;
	margin-right: 16rpx;
	flex-shrink: 0;
}

.status-text-wrap {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.status-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #B08968;
	margin-bottom: 8rpx;
}

.status-desc {
	font-size: 23rpx;
	color: #A1887F;
	line-height: 1.6;
}

.status-retry {
	margin-left: 16rpx;
	flex-shrink: 0;
	background-color: #FFE082;
	color: #7A5C2E;
	font-size: 22rpx;
	padding: 0 22rpx;
	height: 56rpx;
	line-height: 56rpx;
	border-radius: 28rpx;
}

.mock-btn {
	margin-top: 18rpx;
	background-color: #FFFFFF;
	color: #D87A46;
	border: 1rpx solid #FFCCBC;
	font-size: 23rpx;
	height: 64rpx;
	line-height: 64rpx;
	border-radius: 32rpx;
}

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

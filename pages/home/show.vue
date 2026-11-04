<template>
  <view class="container">
    
    <map
      id="tencentMap"
      class="map-container"
      :latitude="latitude"
      :longitude="longitude"
      :scale="scale"
      :min-scale="minScale"
      :max-scale="maxScale"
      :markers="markers"
      :show-location="true"
      :enable-3D="false"
      :enable-overlooking="false"
      :enable-rotate="false"
      :enable-poi="false" 
      @markertap="onMarkerTap"
      @tap="onMapTap"
    ></map>

    
    <cover-image 
        class="map-title-img" 
        src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/title.png"
        mode="aspectFit"
    ></cover-image>
    
    
    <custom-tab-bar :current="0" class="tab-bar" />
    
    
    <daily-signin :visible="showSignin" @update:visible="showSignin = $event" />
  </view>
</template>

<script>
import CustomTabBar from '@/components/custom-tab-bar/index.vue';
import DailySignin from '@/components/daily-signin/daily-signin.vue';


const logoSrc = 'https://mp-b88a8047-5a18-4ba9-b43c-d93de4363320.cdn.bspapp.com/cloudstorage/init-data/logo.png';

export default {
  components: {
    CustomTabBar,
    DailySignin
  },
  data() {
    return {
      showSignin: false,
      latitude: 23.00, 
      longitude: 115.40,
      scale: 10.8, 
      minScale: 9.8,
      maxScale: 15,
      mapCtx: null,
      
      
      markers: [
        {
            id: 101,
            slug: 'shaqima',
            title: '遮浪玛仔',
            latitude: 22.786961,
            longitude: 115.565232,
            iconPath: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/shaqima.png',
            width: 150,
            height: 110,
            callout: { content: '遮浪玛仔\n红海湾遮浪街头东尾村', padding: 8, borderRadius: 5, display: 'BYCLICK' }
        },
        {
            id: 102,
            slug: 'caibaoguo',
            title: '石寨菜包粿',
            latitude: 23.013,
            longitude: 115.75,
            iconPath: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/caibaoguo.png',
            width: 120,
            height: 120,
            callout: { content: '石寨菜包粿\n陆丰市大安镇石寨村', padding: 8, borderRadius: 5, display: 'BYCLICK' }
        },
        {
            id: 103,
            slug: 'taohuaguo',
            title: '红桃粿',
            latitude: 22.97,
            longitude: 115.39,
            iconPath: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/hongtaoguo.png',
            width: 120,
            height: 120,
            callout: { content: '红桃粿\n海丰县附城镇新山村', padding: 8, borderRadius: 5, display: 'BYCLICK' }
        },
        {
            id: 104,
            slug: 'chenzhouhao',
            title: '清蒸晨洲蚝',
            latitude: 22.75,
            longitude: 115.25,
            iconPath: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/chenzhouhao.png',
            width: 120,
            height: 120,
            callout: { content: '清蒸晨洲蚝\n城区红草镇晨洲村', padding: 8, borderRadius: 5, display: 'BYCLICK' }
        },
        {
            id: 105,
            slug: 'paiguxianfan',
            title: '排骨咸饭',
            latitude: 22.85,
            longitude: 115.80,
            iconPath: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/paiguxianfan.png',
            width: 120,
            height: 150,
            callout: { content: '排骨咸饭\n陆丰市南塘镇建宁寨村', padding: 8, borderRadius: 5, display: 'BYCLICK' }
        },
        {
            id: 999,
            slug: 'shaqima',
            title: '华南师范大学(测试)',
            latitude: 23.140422,
            longitude: 113.351711,
            iconPath: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/shaqima.png',
            width: 120,
            height: 120,
            callout: { content: '华南师范大学\n测试打卡点', padding: 8, borderRadius: 5, display: 'BYCLICK' }
        }
      ],

      
      overlayConfig: {
        id: 1,
        src: logoSrc,
        bounds: {
          southwest: {
            latitude: 22.657906,
            longitude: 115.441123
          },
          northeast: {
            latitude: 22.791964,
            longitude: 115.578566
          }
        },
        opacity: 1,
        zIndex: 1000,
        visible: true
      }
    }
  },
  onShow() {
    this.checkDailySignin();
  },
  onReady() {
    this.initMap();
  },
  methods: {
    checkDailySignin() {
        const key = 'last_signin_popup_date';
        const now = new Date();
        const today = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`; 
        const lastDate = uni.getStorageSync(key);
        
        console.log('Checking Signin:', { today, lastDate });

        if (lastDate !== today) {
            this.showSignin = true;
            
            
            uni.setStorageSync(key, today);
        }
    },
    initMap() {
      
      this.mapCtx = uni.createMapContext('tencentMap', this);
      
      
      setTimeout(() => {
        
        this.addDongweiOverlay(); 
        this.addShizhaiOverlay(); 
        this.addXinshanOverlay(); 
        this.addChenzhouOverlay(); 
        this.addJianningOverlay(); 
        this.addCongmeiOverlay(); 
      }, 500);
    },
    
    

    addDongweiOverlay() {
      if (!this.mapCtx) return;
      console.log('Adding Dongwei Overlay...');
      
      this.mapCtx.addGroundOverlay({
        id: 2, 
        src: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/dongweicun.png?v=2',
        bounds: {
          southwest: {
            latitude: 22.657067,
            longitude: 115.339458
          },
          northeast: {
             latitude: 22.824907, 
             longitude: 115.588548
          }
        },
        opacity: 0.9,
        zIndex: 9999, 
        visible: true,
        success: (res) => {
            console.log('Dongwei Overlay Success', res);
        },
        fail: (err) => {
            console.error('Dongwei Overlay Failed', err);
            
            uni.showModal({
                title: '图层加载失败',
                content: JSON.stringify(err),
                showCancel: false
            });
        }
      });
    },

    addShizhaiOverlay() {
      if (!this.mapCtx) return;
      this.mapCtx.addGroundOverlay({
        id: 3,
        src: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/shizhaicun.png?v=2',
        bounds: {
          southwest: { latitude: 23.042795, longitude: 115.554267 },
          northeast: { latitude: 23.2200, longitude: 115.774979 }
        },
        opacity: 0.9,
        zIndex: 9999,
        visible: true,
        fail: (err) => console.error('Shizhai Overlay Failed', err)
      });
    },

    addXinshanOverlay() {
      if (!this.mapCtx) return;
      this.mapCtx.addGroundOverlay({
        id: 4,
        src: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/xinshancun.png?v=2',
        bounds: {
          southwest: { latitude: 22.874779, longitude: 115.319665 },
          northeast: { latitude: 23.052623, longitude: 115.490555 }
        },
        opacity: 0.9,
        zIndex: 9999,
        visible: true,
        fail: (err) => console.error('Xinshan Overlay Failed', err)
      });
    },

    addChenzhouOverlay() {
      if (!this.mapCtx) return;
      this.mapCtx.addGroundOverlay({
        id: 5,
        src: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/chenzhoucun.png?v=2',
        bounds: {
          southwest: { latitude: 22.794561, longitude: 115.120068 },
          northeast: { latitude: 22.969613, longitude: 115.308064 }
        },
        opacity: 0.9,
        zIndex: 9999,
        visible: true,
        fail: (err) => console.error('Chenzhou Overlay Failed', err)
      });
    },

    addJianningOverlay() {
      if (!this.mapCtx) return;
      this.mapCtx.addGroundOverlay({
        id: 6,
        src: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/jianningzhaicun.png?v=2',
        bounds: {
          southwest: { latitude: 22.812492, longitude: 115.821127 },
          northeast: { latitude: 22.990527, longitude: 116.077114 }
        },
        opacity: 0.9,
        zIndex: 9999,
        visible: true,
        fail: function(err) {
            console.error('Jianning Overlay Failed', err);
        }
      });
    },

    onMarkerTap(e) {
        const markerId = e.detail.markerId || e.markerId;
        const marker = this.markers.find(m => m.id === markerId);
        
        if (marker && marker.slug) {
            console.log('Clicked marker:', marker.title, marker.slug);
            
            uni.navigateTo({
                url: `/pages/food/detail?slug=${marker.slug}&lat=${marker.latitude}&lng=${marker.longitude}`,
                fail: (err) => {
                    console.error('Nav failed', err);
                    uni.showToast({ title: '页面跳转失败', icon: 'none' });
                }
            });
        }
    },

    onMapTap(e) {
      const lat = e.detail.latitude;
      const lng = e.detail.longitude;
      
      const bounds = this.overlayConfig.bounds;
      const sw = bounds.southwest;
      const ne = bounds.northeast;
      
      
      if (lat >= sw.latitude && lat <= ne.latitude && 
          lng >= sw.longitude && lng <= ne.longitude) {
            uni.navigateTo({
                url: '/pages/food/detail?slug=shaqima'
            });
      }
    }
  }
}
</script>

<style>
page {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.container {
  width: 100%;
  height: 100%;
  position: relative;
}

.map-container {
  width: 100%;
  height: 100%;
}

.tab-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 999;
}

.map-title-img {
    position: absolute;
    top: 5rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 350rpx;
    height: 300rpx; 
    z-index: 900;
}
</style>
<template>
  <view class="container">

    <!--
      Sprint 5.2：地图降级
      uni-app 的 <map> 在 H5 端需要腾讯位置服务 Key，没有 Key 时渲染成一块空白。
      本项目零配置可跑（不依赖任何云账号），所以 H5 无 Key 是预期状态。
      检测到不可用时改渲染「村庄列表」占位视图 —— 不是死图，
      每个村庄仍可点击进入打卡流程。
    -->
    <map
      v-if="mapAvailable"
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
      @error="onMapError"
    ></map>

    <!-- 地图不可用时的占位视图 -->
    <scroll-view v-else class="map-fallback" scroll-y="true">
      <view class="fallback-head">
        <text class="fallback-icon">🗺️</text>
        <text class="fallback-title">地图暂不可用</text>
        <text class="fallback-reason">{{ mapUnavailableReason }}</text>
        <text class="fallback-hint">下面是全部打卡点，点击即可前往</text>
      </view>

      <view
        class="village-item"
        v-for="v in fallbackVillages"
        :key="v.slug"
        hover-class="village-item-hover"
        @click="goVillage(v)"
      >
        <view class="village-info">
          <text class="village-name">{{ v.title }}</text>
          <text class="village-desc">{{ v.desc }}</text>
        </view>
        <text class="village-arrow">›</text>
      </view>

      <view class="fallback-foot">
        <text class="fallback-foot-text">
          H5 端配置腾讯地图 Key 后可恢复地图渲染
        </text>
      </view>
    </scroll-view>


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
import { detectMapCapability, readMapKey } from '@/utils/map-capability.js';


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

      // Sprint 5.2：地图可用性
      mapAvailable: true,
      mapUnavailableReason: '',

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
  computed: {
    /**
     * 地图不可用时的占位列表
     *
     * 直接从本地 marker 常量派生 —— 不依赖任何后端接口或云函数，
     * 保证离线/未启动后端时也能看到完整内容。
     */
    fallbackVillages () {
      return (this.markers || [])
        .filter(m => m && m.slug && m.id !== 999)   // 排除测试点
        .map(m => ({
          id: m.id,
          slug: m.slug,
          title: m.title,
          desc: (m.callout && m.callout.content ? m.callout.content.split('\n').slice(1).join(' · ') : '') || '乡村美食打卡点',
          latitude: m.latitude,
          longitude: m.longitude
        }))
    }
  },
  onLoad () {
    // Sprint 5.2：检测地图可用性
    // H5 端没有腾讯地图 Key 时 <map> 渲染为空白 —— 改用占位视图
    const cap = detectMapCapability({ mapKey: readMapKey() })
    this.mapAvailable = cap.available
    this.mapUnavailableReason = cap.reason
    console.log('[home] 地图能力检测:', cap)
  },
  onShow() {
    this.checkDailySignin();
  },
  onReady() {
    // 只有地图真正可用时才初始化地图上下文
    if (this.mapAvailable) {
      this.initMap();
    } else {
      console.log('[home] 地图不可用，跳过 initMap（改用占位视图）');
    }
  },
  methods: {
    /**
     * 地图渲染错误回调
     *
     * 即便检测逻辑判定可用，实际渲染仍可能失败（Key 失效、SDK 加载失败等）。
     * 此时降级为占位视图，而不是留一块空白。
     */
    onMapError (e) {
      console.error('[home] 地图渲染失败，降级为占位视图:', e);
      this.mapAvailable = false;
      this.mapUnavailableReason = '地图渲染失败：' + ((e && (e.errMsg || e.detail)) || '未知错误');
    },

    /**
     * 占位视图里点击村庄 → 进入打卡页
     *
     * 与地图 marker 点击走同一条路径，保证两种形态下行为一致。
     */
    goVillage (v) {
      if (!v || !v.slug) return;
      console.log('[home] 占位视图点击村庄:', v.title);
      uni.navigateTo({
        url: `/pages/choosedaka/choosedaka?slug=${v.slug}&locationId=${v.id}&lat=${v.latitude}&lng=${v.longitude}&name=${encodeURIComponent(v.title || '')}`,
        fail: (err) => {
          console.error('[home] 跳转打卡页失败:', err);
          uni.showToast({ title: '页面跳转失败', icon: 'none' });
        }
      });
    },
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

        // Sprint 5.1 修复：initMap 原本直接串行调用 6 个 add*Overlay，
        // 其中 addCongmeiOverlay **从未被定义**（该缺陷从 Sprint 0 初始版本
        // 就存在，git log -S 只命中初始提交）——
        // 一旦执行到它就抛 TypeError，导致后续逻辑全部中断，
        // 表现就是「首页 UI 元素消失、动态弹窗失效」。
        //
        // 现在做两件事：
        //   ① 补齐 addCongmeiOverlay（晨洲村地面图层）
        //   ② 用 safeAddOverlay 包装，单个图层失败不再影响其余图层
        this.safeAddOverlay('东围村', () => this.addDongweiOverlay());
        this.safeAddOverlay('石寨村', () => this.addShizhaiOverlay());
        this.safeAddOverlay('新山村', () => this.addXinshanOverlay());
        this.safeAddOverlay('陈洲村', () => this.addChenzhouOverlay());
        this.safeAddOverlay('建宁寨村', () => this.addJianningOverlay());
        this.safeAddOverlay('晨洲村', () => this.addCongmeiOverlay());
      }, 500);
    },

    /**
     * 安全地添加一个地面图层
     * 单个图层失败（资源 404、SDK 报错、方法缺失）时只记录日志，
     * 不影响其余图层渲染 —— 首页地图不再因为一个图层而整体崩溃。
     *
     * @param {string} name 图层名称（用于日志）
     * @param {Function} fn 实际添加逻辑
     */
    safeAddOverlay(name, fn) {
      try {
        fn();
        console.log('[home] 图层已添加:', name);
      } catch (err) {
        console.error('[home] 图层添加失败（已跳过）:', name, err && err.message);
      }
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

    /**
     * 晨洲村地面图层
     *
     * Sprint 5.1 补齐：这个方法在仓库的初始版本里就**只有调用没有实现**
     * （git log -S "addCongmeiOverlay" 只命中 Sprint 0 的首个提交），
     * 是项目遗留的半成品痕迹 —— 与审计报告中「ai-chat-mask 尾部语法损坏」
     * 属于同一类问题：文件曾被批量脚本改写而未做完整性校验。
     *
     * 资源说明：
     *   晨洲村（城区红草镇晨洲村）的地面图资源名为 chenzhoucun.png，
     *   与 addChenzhouOverlay 使用的同一张图（同属汕尾红草镇片区）。
     *   独立文件 congmeicun.png 在 COS 上不存在（HTTP 404，已实测），
     *   因此这里复用已验证可用的 chenzhoucun.png，并使用独立的 overlay id
     *   避免与 id=5 冲突。
     *
     * bounds 以 marker id=104「清蒸晨洲蚝」（lat 22.75 / lng 115.25）为中心，
     * 覆盖晨洲村行政范围。
     */
    addCongmeiOverlay() {
      if (!this.mapCtx) return;
      this.mapCtx.addGroundOverlay({
        id: 7,
        src: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/map/chenzhoucun.png?v=2',
        bounds: {
          southwest: { latitude: 22.706549, longitude: 115.178064 },
          northeast: { latitude: 22.794561, longitude: 115.328064 }
        },
        opacity: 0.9,
        zIndex: 9999,
        visible: true,
        success: function(res) {
            console.log('Congmei Overlay Success', res);
        },
        fail: function(err) {
            console.error('Congmei Overlay Failed', err);
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

/* Sprint 5.2：地图不可用时的占位视图 */
.map-fallback {
	width: 100%;
	height: 100%;
	background-color: #FFF9F0;
	padding: 40rpx 32rpx 200rpx;
	box-sizing: border-box;
}

.fallback-head {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 60rpx 20rpx 40rpx;
}

.fallback-icon {
	font-size: 72rpx;
	margin-bottom: 16rpx;
}

.fallback-title {
	font-size: 34rpx;
	font-weight: 600;
	color: #5D4037;
	margin-bottom: 12rpx;
}

.fallback-reason {
	font-size: 24rpx;
	color: #A1887F;
	text-align: center;
	line-height: 1.6;
	padding: 0 20rpx;
}

.fallback-hint {
	font-size: 26rpx;
	color: #D87A46;
	margin-top: 20rpx;
	font-weight: 500;
}

.village-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background-color: #FFFFFF;
	border-radius: 24rpx;
	padding: 28rpx 28rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(93, 64, 55, 0.06);
}

.village-item-hover {
	background-color: #FFF3E0;
}

.village-info {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.village-name {
	font-size: 30rpx;
	font-weight: 600;
	color: #5D4037;
	margin-bottom: 8rpx;
}

.village-desc {
	font-size: 24rpx;
	color: #A1887F;
}

.village-arrow {
	font-size: 44rpx;
	color: #D7CCC8;
	margin-left: 20rpx;
}

.fallback-foot {
	display: flex;
	justify-content: center;
	padding: 40rpx 0;
}

.fallback-foot-text {
	font-size: 22rpx;
	color: #BCAAA4;
	text-align: center;
	line-height: 1.6;
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
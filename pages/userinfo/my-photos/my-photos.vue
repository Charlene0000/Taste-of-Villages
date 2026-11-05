<template>
  <view class="photos-container">
    
    <view class="blob blob-1"></view>
    <view class="blob blob-2"></view>

    <view class="header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">❮</text>
      </view>
      <text class="title">我的食光相册</text>

    </view>
    
    <view class="content">
      <!--
        Sprint 5.2：区分「加载中 / 未登录 / 空相册 / 加载失败」四种状态
        原实现只有一个 v-if="photosList.length === 0"，
        未登录或加载失败时也显示「相册还是空的」—— 用户会误以为数据丢了。
        Sprint 5.4：加载态字段改由 listLoaderMixin 提供（photosList* 前缀）。
      -->
      <view class="empty-state" v-if="photosListLoading && photosList.length === 0">
        <view class="empty-icon">⏳</view>
        <text class="empty-text">加载中...</text>
        <text class="empty-desc">正在读取你的美食时光</text>
      </view>

      <view class="empty-state" v-else-if="!isLoggedIn">
        <view class="empty-icon">🔑</view>
        <text class="empty-text">请先登录</text>
        <text class="empty-desc">登录后即可查看你的美食相册</text>
        <button class="empty-btn" size="mini" @click="goLogin">去登录</button>
      </view>

      <view class="empty-state" v-else-if="photosListError">
        <view class="empty-icon">😢</view>
        <text class="empty-text">加载失败</text>
        <text class="empty-desc">{{ photosListError }}</text>
        <button class="empty-btn" size="mini" @click="loadPhotosList">重试</button>
      </view>

      <view class="empty-state" v-else-if="photosList.length === 0">
        <view class="empty-icon">🍽️</view>
        <text class="empty-text">相册还是空的</text>
        <text class="empty-desc">记录你的美食时光</text>
      </view>

      <view class="photos-grid" v-else>
        <view class="photo-item" v-for="(photo, index) in photosList" :key="index" @click="viewPhoto(photo, index)">
           <view class="img-wrapper">
              <image class="photo-image" :src="photo.url" mode="aspectFill"></image>
           </view>
          <view class="photo-info">
            <text class="photo-title">{{ photo.title || '美好食刻' }}</text>
            <view class="photo-meta">
                <text class="photo-date">{{ photo.date }}</text>
                <view class="like-badge">❤️ {{ photo.likes || 0 }}</view>
            </view>
          </view>

          <view class="photo-actions">
            <view class="action-icon" @click.stop="editPhoto(photo)">
              <text>✏️</text>
            </view>
            <view class="action-icon" @click.stop="deletePhoto(index)">
              <text>🗑️</text>
            </view>
          </view>
        </view>

        <!-- Sprint 5.4：触底加载状态 -->
        <view class="load-more" v-if="photosListLoadingMore">
          <text class="load-more-text">正在加载更多...</text>
        </view>
        <view class="load-more" v-else-if="!photosListHasMore && photosListTotal > 0">
          <text class="load-more-text">已展示全部 {{ photosListTotal }} 张</text>
        </view>
      </view>
    </view>
    
    
    <uni-popup ref="photoPopup" type="center">
      <view class="photo-preview">
        <image class="preview-image" :src="currentPhoto.url" mode="aspectFit"></image>
        <view class="preview-info">
          <text class="preview-title">{{ currentPhoto.title }}</text>
          <text class="preview-date">{{ currentPhoto.date }}</text>
          <text class="preview-desc">{{ currentPhoto.description }}</text>
        </view>
        <view class="preview-actions">
          <button class="preview-btn" @click="editPhoto(currentPhoto)">编辑</button>
          <button class="preview-btn close" @click="closePreview">关闭</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
import { businessApi } from '@/utils/auth.js'
import { upload } from '@/utils/request.js'
import { checkAuth } from '@/utils/router-guard.js'
import { listLoaderMixin } from '@/utils/list-loader.js'

/**
 * Sprint 5.4：长列表增量加载
 *
 * 原实现一次性拉取全部照片再渲染 —— 相册是「只增不减」的用户态数据，
 * 照片越多首屏越慢、DOM 节点越多、弱网下白屏越久。
 *
 * 现在改为：分页拉取 + 触底追加，首屏只渲染 PAGE_SIZE 张。
 */
const PAGE_SIZE = 12

/**
 * 时间戳格式化（模块级）
 *
 * mixin 的 mapItem 在组件上下文之外执行（它接收的是纯数据），
 * 因此不能调用 this.formatTimestamp —— 这里抽成独立函数。
 */
function formatTimestamp (ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default {
  mixins: [listLoaderMixin({
    listKey: 'photosList',
    pageSize: PAGE_SIZE,
    immediate: false,   // 交由 onShow 触发，避免与页面守卫重复加载
    fetcher: async (page, pageSize) => {
      const userInfo = uni.getStorageSync('app_user_info')
      if (!userInfo) {
        const err = new Error('请先登录')
        err.errCode = 'not-logged-in'
        throw err
      }
      return businessApi.getUserPhotos({
        openid: userInfo._id || userInfo.id,
        userId: userInfo._id || userInfo.id,
        page,
        pageSize
      })
    },
    mapItem: (p) => Object.assign({}, p, {
      date: formatTimestamp(p.createTime)
    })
  })],
  data() {
    return {
      currentPhoto: {},
      photosList: [],
      // Sprint 5.2：加载状态（列表加载态由 listLoaderMixin 提供 photosList* 字段）
      isLoggedIn: false
    }
  },
  onLoad() {
    // Sprint 5.1：接入路由守卫（未登录时跳登录页）
    if (!checkAuth({ route: 'pages/userinfo/my-photos/my-photos' })) return
  },
  onShow() {
    if (!checkAuth({ route: 'pages/userinfo/my-photos/my-photos' })) return
    this.loadPhotosList();
  },
  onReachBottom() {
    // 触底加载下一页
    this.loadMorePhotosList();
  },
  methods: {
    
    async loadPhotosList() {
      this.photosListError = '';
      const userInfo = uni.getStorageSync('app_user_info');
      if (!userInfo) {
        // Sprint 5.2：未登录 → 显示「请先登录」而不是「相册是空的」
        this.isLoggedIn = false;
        this.photosList = [];
        console.warn('[my-photos] 未登录，跳过加载');
        return;
      }
      this.isLoggedIn = true;

      // 分页重载（回到第一页）
      await this.reloadPhotosList();
    },

    /** Sprint 5.2：去登录 */
    goLogin() {
      uni.navigateTo({ url: '/pages/login/login' });
    },
    
    formatTimestamp(ts) {
        if (!ts) return '';
        const date = new Date(ts);
        return this.formatDate(date);
    },

    goBack() {
      uni.navigateBack()
    },

    uploadPhoto() {
      const userInfo = uni.getStorageSync('app_user_info') || uni.getStorageSync('app_user_info');
      if (!userInfo) {
          uni.showToast({ title: '请先登录', icon: 'none' });
          return;
      }

      uni.chooseImage({
        count: 1,
        success: async (res) => {
          const tempFilePath = res.tempFilePaths[0];
          
          uni.showLoading({ title: '上传中...' });
          
          try {
              
              // 上传到本地后端（替代 uniCloud.uploadFile）
              const uploadRes = await upload(tempFilePath);
              
              if (!uploadRes || !uploadRes.url) {
                  throw new Error('Upload failed');
              }
              const fileUrl = uploadRes.url;

              
              const newPhoto = {
                  url: fileUrl,
                  title: '美好食刻',
                  locationName: '未知地点', 
                  createTime: Date.now()
              };

              await businessApi.saveUserPhotos({ 
                      photos: [newPhoto],
                      openid: userInfo._id
                  });

              uni.showToast({ title: '上传成功', icon: 'success' });
              this.loadPhotosList(); 

          } catch (e) {
              console.error(e);
              uni.showToast({ title: '上传失败', icon: 'none' });
          } finally {
              uni.hideLoading();
          }
        }
      })
    },

    viewPhoto(photo, index) {
      this.currentPhoto = photo
      this.$refs.photoPopup.open()
    },
    closePreview() {
      this.$refs.photoPopup.close()
    },

    editPhoto(photo) {
      uni.showModal({
        title: '编辑照片',
        editable: true,
        placeholderText: '请输入照片标题',
        content: photo.title, 
        success: async (res) => {
          if (res.confirm) {
            const newTitle = res.content || '美好食刻';
            
            uni.showLoading({ title: '保存中' });
            try {
                
                await businessApi.updateUserPhoto({
                        _id: photo._id,
                        title: newTitle
                    });
                
                photo.title = newTitle; 
                uni.showToast({ title: '修改成功', icon: 'success' });
            } catch (e) {
                uni.showToast({ title: '修改失败', icon: 'none' });
            } finally {
                uni.hideLoading();
            }
          }
        }
      })
    },

    deletePhoto(index) {
      const photo = this.photosList[index];
      uni.showModal({
        title: '确认删除',
        content: '确定要删除这张照片吗？',
        success: async (res) => {
          if (res.confirm) {
            uni.showLoading({ title: '删除中' });
            try {
                
                await businessApi.deleteUserPhoto({ _id: photo._id });
                
                this.photosList.splice(index, 1);
                // Sprint 5.4：分页模式下总数需同步递减，否则「已展示全部 N 张」计数失真
                if (this.photosListTotal > 0) this.photosListTotal -= 1;
                this.$refs.photoPopup.close(); 
                uni.showToast({ title: '删除成功', icon: 'success' });
            } catch (e) {
                uni.showToast({ title: '删除失败', icon: 'none' });
            } finally {
                uni.hideLoading();
            }
          }
        }
      })
    },

    formatDate(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
}
</script>

<style scoped>
.photos-container {
  min-height: 100vh;
  background-color: #FFFBF0;
  position: relative;
  overflow-x: hidden;
  font-family: "Nunito", "ZCOOL KuaiLe", sans-serif;
  
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
  margin-top: -10rpx;
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

.back-icon, .upload-icon {
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
  box-shadow: none;
  margin: auto;
  width: 100%;
  box-sizing: border-box;
}

/* Sprint 5.2：空状态里的行动按钮 */
.empty-btn {
  margin-top: 32rpx;
  background-color: #DC825E;
  color: #FFFFFF;
  font-size: 26rpx;
  padding: 0 40rpx;
  height: 68rpx;
  line-height: 68rpx;
  border-radius: 34rpx;
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
  margin-bottom: 40rpx;
}

.upload-btn-large {
  background: linear-gradient(135deg, #FFD180, #FF9E80);
  color: #fff;
  font-size: 28rpx;
  border-radius: 50px;
  padding: 10px 40px;
  border: none;
  font-weight: bold;
  box-shadow: 0 5px 15px rgba(255, 158, 128, 0.4);
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

/* Sprint 5.4：触底加载状态条（跨两列） */
.load-more {
  grid-column: 1 / -1;
  text-align: center;
  padding: 30rpx 0 10rpx;
}

.load-more-text {
  font-size: 24rpx;
  color: #A1887F;
}

.photo-item {
  position: relative;
  background: white;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 5px 15px rgba(93, 64, 55, 0.08);
  border: 1px solid #FFF5E5;
  transition: transform 0.2s;
}

.photo-item:active {
    transform: scale(0.98);
}

.img-wrapper {
    width: 100%;
    aspect-ratio: 1;
    background: #FFF8E1;
}

.photo-image {
  width: 100%;
  height: 100%;
}

.photo-info {
    padding: 10px;
}

.photo-title {
  display: block;
  font-size: 14px;
  color: #5D4037;
  font-weight: bold;
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.photo-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.photo-date {
  font-size: 10px;
  color: #AAA;
}

.like-badge {
    font-size: 10px;
    color: #FF9E80;
    background: #FFF3E0;
    padding: 2px 6px;
    border-radius: 10px;
}

.photo-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
}

.action-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.action-icon text {
  font-size: 14px;
}


.photo-preview {
  width: 600rpx;
  background: #FFFBF0;
  border-radius: 24rpx;
  padding: 30rpx;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}

.preview-image {
  width: 100%;
  height: 400rpx;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  background-color: #EEE;
}

.preview-info {
  margin-bottom: 20rpx;
}

.preview-title {
  font-size: 32rpx;
  color: #5D4037;
  font-weight: bold;
  display: block;
  margin-bottom: 10rpx;
}

.preview-date {
  font-size: 24rpx;
  color: #8D6E63;
  display: block;
  margin-bottom: 10rpx;
}

.preview-desc {
  font-size: 26rpx;
  color: #5D4037;
  line-height: 1.5;
}

.preview-actions {
  display: flex;
  gap: 15rpx;
}

.preview-btn {
  flex: 1;
  font-size: 24rpx;
  padding: 15rpx 0;
  border-radius: 50px;
  border: none;
  background: #FFECB3;
  color: #5D4037;
  font-weight: bold;
}

.preview-btn.close {
  background: #EFEBE9;
  color: #8D6E63;
}
</style>

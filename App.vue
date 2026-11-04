<script>
	import { ensureSession } from '@/utils/session.js';
	export default {
		onLaunch: async function() {
			
			
			console.log('App Launch')
			
			// 冷启动会话健康检查（Sprint 1 自研，Sprint 5 改为本地 HTTP 后端）
			// 目的：token 若已过期，在用户操作前就完成刷新或引导重登，
			//       避免「打卡/下单」等关键操作静默失败。
			// 边界：后端服务不可用时保守放行，不阻断启动。
			try {
				const status = await ensureSession({ silent: true })
				console.log('[session] 冷启动检查:', JSON.stringify(status))
			} catch (e) {
				console.warn('[session] 冷启动检查异常:', e && e.message)
			}
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style>
	
	
	
	
	.tabbar-box {
		box-shadow: 0 -2rpx 16rpx rgba(0, 0, 0, 0.12), 0 4rpx 24rpx rgba(0, 0, 0, 0.08) !important;
		-webkit-box-shadow: 0 -2rpx 16rpx rgba(0, 0, 0, 0.12), 0 4rpx 24rpx rgba(0, 0, 0, 0.08) !important;
		filter: drop-shadow(0 4rpx 12rpx rgba(0, 0, 0, 0.1)) !important;
	}
</style>

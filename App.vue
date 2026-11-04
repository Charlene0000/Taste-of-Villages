<script>
	import uniIdPageInit from '@/uni_modules/uni-id-pages/init.js';
	export default {
		onLaunch: async function() {
			
			
			console.log('App Launch')
			await uniIdPageInit()
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

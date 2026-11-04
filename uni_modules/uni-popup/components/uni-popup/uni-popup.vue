<template>
	<view v-if="showPopup" class="uni-popup" :class="[popupstyle, isDesktop ? 'fixforpc-z-index' : '']">
		<view @touchstart="touchstart">
			<uni-transition key="1" v-if="maskShow" name="mask" mode-class="fade" :styles="maskClass"
				:duration="duration" :show="showTrans" @click="onTap" />
			<uni-transition key="2" :mode-class="ani" name="content" :styles="transClass" :duration="duration"
				:show="showTrans" @click="onTap">
				<view class="uni-popup__wrapper" :style="{ backgroundColor: bg }" :class="[popupstyle]" @click="clear">
					<slot />
				</view>
			</uni-transition>
		</view>
		
		<!-- #ifdef H5 -->
		<keypress v-if="maskShow" @esc="onTap" />
		<!-- #endif -->
		
	</view>
</template>

<script>
	
	// #ifdef H5
	import keypress from './keypress.js'
	// #endif
	

	

	export default {
		name: 'uniPopup',
		components: {
			// #ifdef H5
			keypress
			// #endif
		},
		emits: ['change', 'maskClick'],
		props: {
			
			animation: {
				type: Boolean,
				default: true
			},
			
			
			type: {
				type: String,
				default: 'center'
			},
			
			isMaskClick: {
				type: Boolean,
				default: null
			},
			
			maskClick: {
				type: Boolean,
				default: null
			},
			backgroundColor: {
				type: String,
				default: 'none'
			},
			safeArea: {
				type: Boolean,
				default: true
			},
			maskBackgroundColor: {
				type: String,
				default: 'rgba(0, 0, 0, 0.4)'
			},
		},

		watch: {
			
			type: {
				handler: function(type) {
					if (!this.config[type]) return
					this[this.config[type]](true)
				},
				immediate: true
			},
			isDesktop: {
				handler: function(newVal) {
					if (!this.config[newVal]) return
					this[this.config[this.type]](true)
				},
				immediate: true
			},
			
			maskClick: {
				handler: function(val) {
					this.mkclick = val
				},
				immediate: true
			},
			isMaskClick: {
				handler: function(val) {
					this.mkclick = val
				},
				immediate: true
			},
			
			showPopup(show) {
				
				
				document.getElementsByTagName('body')[0].style.overflow = show ? 'hidden' : 'visible'
				
			}
		},
		data() {
			return {
				duration: 300,
				ani: [],
				showPopup: false,
				showTrans: false,
				popupWidth: 0,
				popupHeight: 0,
				config: {
					top: 'top',
					bottom: 'bottom',
					center: 'center',
					left: 'left',
					right: 'right',
					message: 'top',
					dialog: 'center',
					share: 'bottom'
				},
				maskClass: {
					position: 'fixed',
					bottom: 0,
					top: 0,
					left: 0,
					right: 0,
					backgroundColor: 'rgba(0, 0, 0, 0.4)'
				},
				transClass: {
					position: 'fixed',
					left: 0,
					right: 0
				},
				maskShow: true,
				mkclick: true,
				popupstyle: this.isDesktop ? 'fixforpc-top' : 'top'
			}
		},
		computed: {
			isDesktop() {
				return this.popupWidth >= 500 && this.popupHeight >= 500
			},
			bg() {
				if (this.backgroundColor === '' || this.backgroundColor === 'none') {
					return 'transparent'
				}
				return this.backgroundColor
			}
		},
		mounted() {
			const fixSize = () => {
				const {
					windowWidth,
					windowHeight,
					windowTop,
					safeArea,
					screenHeight,
					safeAreaInsets
				} = uni.getSystemInfoSync()
				this.popupWidth = windowWidth
				this.popupHeight = windowHeight + (windowTop || 0)
				
				if (safeArea && this.safeArea) {
					
					this.safeAreaInsets = screenHeight - safeArea.bottom
					
					
					this.safeAreaInsets = safeAreaInsets.bottom
					
				} else {
					this.safeAreaInsets = 0
				}
			}
			fixSize()
			
			
			
			
			
			
		},
		
		
		destroyed() {
			this.setH5Visible()
		},
		
		
		
		unmounted() {
			this.setH5Visible()
		},
		
		created() {
			
			if (this.isMaskClick === null && this.maskClick === null) {
				this.mkclick = true
			} else {
				this.mkclick = this.isMaskClick !== null ? this.isMaskClick : this.maskClick
			}
			if (this.animation) {
				this.duration = 300
			} else {
				this.duration = 0
			}
			
			this.messageChild = null
			
			this.clearPropagation = false
			this.maskClass.backgroundColor = this.maskBackgroundColor
		},
		methods: {
			setH5Visible() {
				// #ifdef H5
				document.getElementsByTagName('body')[0].style.overflow = 'visible'
				// #endif
			},
			
			closeMask() {
				this.maskShow = false
			},
			
			disableMask() {
				this.mkclick = false
			},
			
			clear(e) {
				
				e.stopPropagation()
				
				this.clearPropagation = true
			},

			open(direction) {
				
				if (this.showPopup) {
					clearTimeout(this.timer)
					this.showPopup = false
				}
				let innerType = ['top', 'center', 'bottom', 'left', 'right', 'message', 'dialog', 'share']
				if (!(direction && innerType.indexOf(direction) !== -1)) {
					direction = this.type
				}
				if (!this.config[direction]) {
					console.error('缺少类型：', direction)
					return
				}
				this[this.config[direction]]()
				this.$emit('change', {
					show: true,
					type: direction
				})
			},
			close(type) {
				this.showTrans = false
				this.$emit('change', {
					show: false,
					type: this.type
				})
				clearTimeout(this.timer)
				
				
				this.timer = setTimeout(() => {
					this.showPopup = false
				}, 300)
			},
			
			touchstart() {
				this.clearPropagation = false
			},

			onTap() {
				if (this.clearPropagation) {
					
					this.clearPropagation = false
					return
				}
				this.$emit('maskClick')
				if (!this.mkclick) return
				this.close()
			},
			
			top(type) {
				this.popupstyle = this.isDesktop ? 'fixforpc-top' : 'top'
				this.ani = ['slide-top']
				this.transClass = {
					position: 'fixed',
					left: 0,
					right: 0,
					backgroundColor: this.bg
				}
				
				if (type) return
				this.showPopup = true
				this.showTrans = true
				this.$nextTick(() => {
					if (this.messageChild && this.type === 'message') {
						this.messageChild.timerClose()
					}
				})
			},
			
			bottom(type) {
				this.popupstyle = 'bottom'
				this.ani = ['slide-bottom']
				this.transClass = {
					position: 'fixed',
					left: 0,
					right: 0,
					bottom: 0,
					paddingBottom: this.safeAreaInsets + 'px',
					backgroundColor: this.bg
				}
				
				if (type) return
				this.showPopup = true
				this.showTrans = true
			},
			
			center(type) {
				this.popupstyle = 'center'
				this.ani = ['zoom-out', 'fade']
				this.transClass = {
					position: 'fixed',
					
					display: 'flex',
					flexDirection: 'column',
					
					bottom: 0,
					left: 0,
					right: 0,
					top: 0,
					justifyContent: 'center',
					alignItems: 'center'
				}
				
				if (type) return
				this.showPopup = true
				this.showTrans = true
			},
			left(type) {
				this.popupstyle = 'left'
				this.ani = ['slide-left']
				this.transClass = {
					position: 'fixed',
					left: 0,
					bottom: 0,
					top: 0,
					backgroundColor: this.bg,
					
					display: 'flex',
					flexDirection: 'column'
					
				}
				
				if (type) return
				this.showPopup = true
				this.showTrans = true
			},
			right(type) {
				this.popupstyle = 'right'
				this.ani = ['slide-right']
				this.transClass = {
					position: 'fixed',
					bottom: 0,
					right: 0,
					top: 0,
					backgroundColor: this.bg,
					
					display: 'flex',
					flexDirection: 'column'
					
				}
				
				if (type) return
				this.showPopup = true
				this.showTrans = true
			}
		}
	}
</script>
<style lang="scss">
	.uni-popup {
		position: fixed;
		
		z-index: 99;

		
		&.top,
		&.left,
		&.right {
			
			top: var(--window-top);
			
			
			top: 0;
			
		}

		.uni-popup__wrapper {
			
			display: block;
			
			position: relative;

			
			
			
			
			
			&.left,
			&.right {
				
				padding-top: var(--window-top);
				
				
				padding-top: 0;
				
				flex: 1;
			}
		}
	}

	.fixforpc-z-index {
		
		z-index: 999;
		
	}

	.fixforpc-top {
		top: 0;
	}
</style>

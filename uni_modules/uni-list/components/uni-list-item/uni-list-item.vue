<template>
	
	<cell :keep-scroll-position="keepScrollPosition">
		
		<view :class="{ 'uni-list-item--disabled': disabled }" :style="{'background-color':customStyle.backgroundColor}"
			:hover-class="(!clickable && !link) || disabled || showSwitch ? '' : 'uni-list-item--hover'"
			class="uni-list-item" @click="onClick">
			<view v-if="!isFirstChild" class="border--left" :class="{ 'uni-list--border': border }"></view>
			<view class="uni-list-item__container"
				:class="{ 'container--right': showArrow || link, 'flex--direction': direction === 'column'}"
				:style="{paddingTop:padding.top,paddingLeft:padding.left,paddingRight:padding.right,paddingBottom:padding.bottom}">
				<slot name="header">
					<view class="uni-list-item__header">
						<view v-if="thumb" class="uni-list-item__icon">
							<image :src="thumb" class="uni-list-item__icon-img" :class="['uni-list--' + thumbSize]" />
						</view>
						<view v-else-if="showExtraIcon" class="uni-list-item__icon">
							<uni-icons :customPrefix="extraIcon.customPrefix" :color="extraIcon.color" :size="extraIcon.size" :type="extraIcon.type" />
						</view>
					</view>
				</slot>
				<slot name="body">
					<view class="uni-list-item__content"
						:class="{ 'uni-list-item__content--center': thumb || showExtraIcon || showBadge || showSwitch }">
						<text v-if="title" class="uni-list-item__content-title"
							:class="[ellipsis !== 0 && ellipsis <= 2 ? 'uni-ellipsis-' + ellipsis : '']">{{ title }}</text>
						<text v-if="note" class="uni-list-item__content-note">{{ note }}</text>
					</view>
				</slot>
				<slot name="footer">
					<view v-if="rightText || showBadge || showSwitch" class="uni-list-item__extra"
						:class="{ 'flex--justify': direction === 'column' }">
						<text v-if="rightText" class="uni-list-item__extra-text">{{ rightText }}</text>
						<uni-badge v-if="showBadge" :type="badgeType" :text="badgeText" :custom-style="badgeStyle" />
						<switch v-if="showSwitch" :disabled="disabled" :checked="switchChecked"
							@change="onSwitchChange" />
					</view>
				</slot>
			</view>
			<uni-icons v-if="showArrow || link" :size="16" class="uni-icon-wrapper" color="#bbb" type="arrowright" />
		</view>
		
	</cell>
	
</template>

<script>
	
	export default {
		name: 'UniListItem',
		emits: ['click', 'switchChange'],
		props: {
			direction: {
				type: String,
				default: 'row'
			},
			title: {
				type: String,
				default: ''
			},
			note: {
				type: String,
				default: ''
			},
			ellipsis: {
				type: [Number, String],
				default: 0
			},
			disabled: {
				type: [Boolean, String],
				default: false
			},
			clickable: {
				type: Boolean,
				default: false
			},
			showArrow: {
				type: [Boolean, String],
				default: false
			},
			link: {
				type: [Boolean, String],
				default: false
			},
			to: {
				type: String,
				default: ''
			},
			showBadge: {
				type: [Boolean, String],
				default: false
			},
			showSwitch: {
				type: [Boolean, String],
				default: false
			},
			switchChecked: {
				type: [Boolean, String],
				default: false
			},
			badgeText: {
				type: String,
				default: ''
			},
			badgeType: {
				type: String,
				default: 'success'
			},
			badgeStyle: {
				type: Object,
				default () {
					return {}
				}
			},
			rightText: {
				type: String,
				default: ''
			},
			thumb: {
				type: String,
				default: ''
			},
			thumbSize: {
				type: String,
				default: 'base'
			},
			showExtraIcon: {
				type: [Boolean, String],
				default: false
			},
			extraIcon: {
				type: Object,
				default () {
					return {
						type: '',
						color: '#000000',
						size: 20,
						customPrefix: ''
					};
				}
			},
			border: {
				type: Boolean,
				default: true
			},
			customStyle: {
				type: Object,
				default () {
					return {
						padding: '',
						backgroundColor: '#FFFFFF'
					}
				}
			},
			keepScrollPosition: {
				type: Boolean,
				default: false
			}
		},
		watch: {
			'customStyle.padding': {
				handler(padding) {
					if(typeof padding == 'number'){
						padding += ''
					}
					let paddingArr = padding.split(' ')
					if (paddingArr.length === 1) {
						this.padding = {
							"top": padding,
							"right": padding,
							"bottom": padding,
							"left": padding
						}
					} else if (paddingArr.length === 2) {
						this.padding = {
							"top": padding[0],
							"right": padding[1],
							"bottom": padding[0],
							"left": padding[1]
						}
					} else if (paddingArr.length === 4) {
						this.padding = {
							"top": padding[0],
							"right": padding[1],
							"bottom": padding[2],
							"left": padding[3]
						}
					}
				},
				immediate: true
			}
		},
		
		data() {
			return {
				isFirstChild: false,
				padding: {
					top: "",
					right: "",
					bottom: "",
					left: ""
				}
			};
		},
		mounted() {
			this.list = this.getForm()
			
			if (this.list) {
				if (!this.list.firstChildAppend) {
					this.list.firstChildAppend = true;
					this.isFirstChild = true;
				}
			}
		},
		methods: {
			
			getForm(name = 'uniList') {
				let parent = this.$parent;
				let parentName = parent.$options.name;
				while (parentName !== name) {
					parent = parent.$parent;
					if (!parent) return false
					parentName = parent.$options.name;
				}
				return parent;
			},
			onClick() {
				if (this.to !== '') {
					this.openPage();
					return;
				}
				if (this.clickable || this.link) {
					this.$emit('click', {
						data: {}
					});
				}
			},
			onSwitchChange(e) {
				this.$emit('switchChange', e.detail);
			},
			openPage() {
				if (['navigateTo', 'redirectTo', 'reLaunch', 'switchTab'].indexOf(this.link) !== -1) {
					this.pageApi(this.link);
				} else {
					this.pageApi('navigateTo');
				}
			},
			pageApi(api) {
				let callback = {
					url: this.to,
					success: res => {
						this.$emit('click', {
							data: res
						});
					},
					fail: err => {
						this.$emit('click', {
							data: err
						});
					}
				}
				switch (api) {
					case 'navigateTo':
						uni.navigateTo(callback)
						break
					case 'redirectTo':
						uni.redirectTo(callback)
						break
					case 'reLaunch':
						uni.reLaunch(callback)
						break
					case 'switchTab':
						uni.switchTab(callback)
						break
					default:
						uni.navigateTo(callback)
				}
			}
		}
	};
</script>

<style lang="scss">
	$uni-font-size-sm:12px;
	$uni-font-size-base:14px;
	$uni-font-size-lg:16px;
	$uni-spacing-col-lg: 12px;
	$uni-spacing-row-lg: 15px;
	$uni-img-size-sm:20px;
	$uni-img-size-base:26px;
	$uni-img-size-lg:40px;
	$uni-border-color:#e5e5e5;
	$uni-bg-color-hover:#f1f1f1;
	$uni-text-color-grey:#999;
	$list-item-pd: $uni-spacing-col-lg $uni-spacing-row-lg;

	.uni-list-item {
		
		display: flex;
		
		font-size: $uni-font-size-lg;
		position: relative;
		justify-content: space-between;
		align-items: center;
		background-color: #fff;
		flex-direction: row;
		
		cursor: pointer;
		
	}

	.uni-list-item--disabled {
		opacity: 0.3;
	}

	.uni-list-item--hover {
		background-color: $uni-bg-color-hover !important;
	}

	.uni-list-item__container {
		position: relative;
		
		display: flex;
		
		flex-direction: row;
		padding: $list-item-pd;
		padding-left: $uni-spacing-row-lg;
		flex: 1;
		overflow: hidden;
		
	}

	.container--right {
		padding-right: 0;
	}

	
	
	
	.uni-list--border {
		position: absolute;
		top: 0;
		right: 0;
		left: 0;
		
		border-top-color: $uni-border-color;
		border-top-style: solid;
		border-top-width: 0.5px;
		
	}

	
	.uni-list--border:after {
		position: absolute;
		top: 0;
		right: 0;
		left: 0;
		height: 1px;
		content: '';
		-webkit-transform: scaleY(0.5);
		transform: scaleY(0.5);
		background-color: $uni-border-color;
	}

	
	.uni-list-item__content {
		
		display: flex;
		
		padding-right: 8px;
		flex: 1;
		color: #3b4144;
		
		flex-direction: column;
		justify-content: space-between;
		overflow: hidden;
	}

	.uni-list-item__content--center {
		justify-content: center;
	}

	.uni-list-item__content-title {
		font-size: $uni-font-size-base;
		color: #3b4144;
		overflow: hidden;
	}

	.uni-list-item__content-note {
		margin-top: 6rpx;
		color: $uni-text-color-grey;
		font-size: $uni-font-size-sm;
		overflow: hidden;
	}

	.uni-list-item__extra {
		
		
		display: flex;
		
		flex-direction: row;
		justify-content: flex-end;
		align-items: center;
	}

	.uni-list-item__header {
		
		display: flex;
		
		flex-direction: row;
		align-items: center;
	}

	.uni-list-item__icon {
		margin-right: 18rpx;
		flex-direction: row;
		justify-content: center;
		align-items: center;
	}

	.uni-list-item__icon-img {
		
		display: block;
		
		height: $uni-img-size-base;
		width: $uni-img-size-base;
		margin-right: 10px;
	}

	.uni-icon-wrapper {
		
		display: flex;
		
		align-items: center;
		padding: 0 10px;
	}

	.flex--direction {
		flex-direction: column;
		
		align-items: initial;
		
	}

	.flex--justify {
		
		justify-content: initial;
		
	}

	.uni-list--lg {
		height: $uni-img-size-lg;
		width: $uni-img-size-lg;
	}

	.uni-list--base {
		height: $uni-img-size-base;
		width: $uni-img-size-base;
	}

	.uni-list--sm {
		height: $uni-img-size-sm;
		width: $uni-img-size-sm;
	}

	.uni-list-item__extra-text {
		color: $uni-text-color-grey;
		font-size: $uni-font-size-sm;
	}

	.uni-ellipsis-1 {
		
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		
		
		lines: 1;
		text-overflow: ellipsis;
		
	}

	.uni-ellipsis-2 {
		
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		
		
		lines: 2;
		text-overflow: ellipsis;
		
	}
</style>
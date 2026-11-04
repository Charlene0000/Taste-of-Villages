<template>
	
	<cell>
		
		<view class="uni-list-ad">
			<view v-if="borderShow" :class="{'uni-list--border':border,'uni-list-item--first':isFirstChild}"></view>
			<ad style="width: 200px;height: 300px;border-width: 1px;border-color: red;border-style: solid;" adpid="1111111111"
			 unit-id="" appid="" apid="" type="feed" @error="aderror" @close="closeAd"></ad>
		</view>
		
	</cell>
	

</template>

<script>
	
	const dom = uni.requireNativePlugin('dom');
	
	export default {
		name: 'UniListAd',
		props: {
			title: {
				type: String,
				default: '',

			}
		},
		
		data() {
			return {
				isFirstChild: false,
				border: false,
				borderShow: true,
			}
		},

		mounted() {
			this.list = this.getForm()
			if (this.list) {
				if (!this.list.firstChildAppend) {
					this.list.firstChildAppend = true
					this.isFirstChild = true
				}
				this.border = this.list.border
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
			aderror(e) {
				console.log("aderror: " + JSON.stringify(e.detail));
			},
			closeAd(e) {
				this.borderShow = false
			}
		}
	}
</script>

<style lang="scss" >
	.uni-list-ad {
		position: relative;
		border: 1px red solid;
	}

	.uni-list--border {
		position: relative;
		padding-bottom: 1px;
		
		border-top-color: $uni-border-color;
		border-top-style: solid;
		border-top-width: 0.5px;
		
		margin-left: $uni-spacing-row-lg;
	}

	
	.uni-list--border:after {
		position: absolute;
		top: 0;
		right: 0;
		left: 0;
		height: 1px;
		content: '';
		-webkit-transform: scaleY(.5);
		transform: scaleY(.5);
		background-color: $uni-border-color;
	}

	.uni-list-item--first:after {
		height: 0px;
	}

	
</style>

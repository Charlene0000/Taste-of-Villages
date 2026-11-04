<template>
	
	<view class="uni-list uni-border-top-bottom">
		<view v-if="border" class="uni-list--border-top"></view>
		<slot />
		<view v-if="border" class="uni-list--border-bottom"></view>
	</view>
	
	
	<list class="uni-list" :class="{ 'uni-list--border': border }" :enableBackToTop="enableBackToTop" loadmoreoffset="15"><slot /></list>
	
</template>

<script>

export default {
	name: 'uniList',
	'mp-weixin': {
		options: {
			multipleSlots: false
		}
	},
	props: {
		enableBackToTop: {
			type: [Boolean, String],
			default: false
		},
		scrollY: {
			type: [Boolean, String],
			default: false
		},
		border: {
			type: Boolean,
			default: true
		}
	},
	
	
	
	
	
	created() {
		this.firstChildAppend = false;
	},
	methods: {
		loadMore(e) {
			this.$emit('scrolltolower');
		}
	}
};
</script>
<style lang="scss" scoped>
.uni-list {
	
	display: flex;
	
	background-color: $uni-bg-color;
	position: relative;
	flex-direction: column;
}

.uni-list--border {
	position: relative;
	
	border-top-color: $uni-border-color;
	border-top-style: solid;
	border-top-width: 0.5px;
	border-bottom-color: $uni-border-color;
	border-bottom-style: solid;
	border-bottom-width: 0.5px;
	
	z-index: -1;
}



.uni-list--border-top {
	position: absolute;
	top: 0;
	right: 0;
	left: 0;
	height: 1px;
	-webkit-transform: scaleY(0.5);
	transform: scaleY(0.5);
	background-color: $uni-border-color;
	z-index: 1;
}

.uni-list--border-bottom {
	position: absolute;
	bottom: 0;
	right: 0;
	left: 0;
	height: 1px;
	-webkit-transform: scaleY(0.5);
	transform: scaleY(0.5);
	background-color: $uni-border-color;
}


</style>

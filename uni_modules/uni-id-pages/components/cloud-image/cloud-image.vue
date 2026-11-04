<template>
	<view @click="onClick" :style="{width,height}" style="justify-content: center;">
		<image v-if="cSrc" :style="{width,height}" :src="cSrc" :mode="mode"></image>
	</view>
</template>

<script>
	
	export default {
		name: "cloud-image",
		emits:['click'],
		props: {
			mode: {
				type:String,
				default () {
					return 'widthFix'
				}
			},
			src: {
				
				default () {
					return ""
				}
			},
			width: {
				type:String,
				default () {
					return '100rpx'
				}
			},
			height: {
				type:String,
				default () {
					return '100rpx'
				}
			}
		},
		watch: {
			src:{
				handler(src) {
					if (src&&src.substring(0, 8) == "cloud://") {
						uniCloud.getTempFileURL({
							fileList: [src]
						}).then(res=>{
							this.cSrc = res.fileList[0].tempFileURL
						})
					}else{
						this.cSrc = src
					}
				},
				immediate: true
			}
		},
		methods:{
			onClick(){
				this.$emit('click')
			}
		},
		data() {
			return {
				cSrc:false
			};
		}
	}
</script>
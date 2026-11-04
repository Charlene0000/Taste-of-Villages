<template>
	<button open-type="chooseAvatar" @chooseavatar="bindchooseavatar" @click="uploadAvatarImg" class="box" :class="{'showBorder':border}"  :style="{width,height,lineHeight:height}">
		<cloud-image v-if="avatar_file" :src="avatar_file.url" :width="width" :height="height"></cloud-image>
		<uni-icons v-else :style="{width,height,lineHeight:height}" class="chooseAvatar" type="plusempty" size="30"
			color="#dddddd"></uni-icons>
	</button>
</template>

<script>
	import {
		store,
		mutations
	} from '@/uni_modules/uni-id-pages/common/store.js'
	
	export default {
		data() {
			return {
				isPC: false
			}
		},
		props: {
			
			width: {
				type: String,
				default () {
					return "50px"
				}
			},
			
			height: {
				type: String,
				default () {
					return "50px"
				}
			},
			border:{
				type: Boolean,
				default () {
					return false
				}
			}
		},
		async mounted() {
			
			this.isPC = !['ios', 'android'].includes(uni.getSystemInfoSync().platform);
			
		},
		computed: {
			hasLogin() {
				return store.hasLogin
			},
			userInfo() {
				return store.userInfo
			},
			avatar_file() {
				return store.userInfo.avatar_file
			}
		},
		methods: {
			setAvatarFile(avatar_file) {
				
				mutations.updateUserInfo({avatar_file})
			},
			async bindchooseavatar(res){
				let avatarUrl = res.detail.avatarUrl
				let avatar_file = {
					extname: avatarUrl.split('.')[avatarUrl.split('.').length - 1],
					name:'',
					url:''
				}
				
                
                if (!avatar_file.extname || avatar_file.extname.length > 5) {
                    avatar_file.extname = 'jpg';
                }

				
				let cloudPath = this.userInfo._id + '' + Date.now() + '.' + avatar_file.extname
				avatar_file.name = cloudPath
                
                
                setTimeout(async () => {
                    try{
                        uni.showLoading({
                            title: "更新中",
                            mask: true
                        });
                        let {
                            fileID
                        } = await uniCloud.uploadFile({
                            filePath:avatarUrl,
                            cloudPath,
                            fileType: "image"
                        });
                        avatar_file.url = fileID
                        uni.hideLoading()
                        this.setAvatarFile(avatar_file)
                    }catch(e){
                        console.error(e);
                        uni.hideLoading();
                        uni.showToast({ title: '上传失败', icon: 'none' });
                    }
                }, 200);

				console.log('avatar_file',avatar_file);
				
			},
			uploadAvatarImg(res) {
				
				return false 
				
				
				
				if(!this.hasLogin){
					return uni.navigateTo({
						url:'/uni_modules/uni-id-pages/pages/login/login-withoutpwd'
					})
				}
				const crop = {
					quality: 100,
					width: 600,
					height: 600,
					resize: true
				};
				uni.chooseImage({
					count: 1,
					crop,
					success: async (res) => {
						let tempFile = res.tempFiles[0],
							avatar_file = {
								
								extname: tempFile.name.split('.')[tempFile.name.split('.').length - 1],
								
								
								extname: tempFile.path.split('.')[tempFile.path.split('.').length - 1]
								
							},
							filePath = res.tempFilePaths[0]
							
						
						
						filePath = await new Promise((callback) => {
							
							if (!this.isPC) {
								uni.navigateTo({
									url: '/uni_modules/uni-id-pages/pages/userinfo/cropImage/cropImage?path=' +
										filePath + `&options=${JSON.stringify(crop)}`,
									animationType: "fade-in",
									events: {
										success: url => {
											callback(url)
										}
									},
									complete(e) {
										
									}
								});
							}
							
						})
						
						
						let cloudPath = this.userInfo._id + '' + Date.now()
						avatar_file.name = cloudPath
						uni.showLoading({
							title: "更新中",
							mask: true
						});
						let {
							fileID
						} = await uniCloud.uploadFile({
							filePath,
							cloudPath,
							fileType: "image"
						});
						avatar_file.url = fileID
						uni.hideLoading()
						this.setAvatarFile(avatar_file)
					}
				})
				
			}
		}
	}
</script>

<style>
	
	.box{
		overflow: hidden;
	}
	
	.box{
		padding: 0;
	}
	
	.chooseAvatar {
		
		display: inline-block;
		box-sizing: border-box;
		
		border-radius: 10px;
		text-align: center;
		padding: 1px;
	}
	.showBorder{
		border: solid 1px #ddd;
	}
</style>

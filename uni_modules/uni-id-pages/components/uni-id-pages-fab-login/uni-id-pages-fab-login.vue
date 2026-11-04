<template>
	<view>
		<view class="fab-login-box">
			<view class="item" v-for="(item,index) in servicesList" :key="index"
				@click="item.path?toPage(item.path):login_before(item.id,false)">
				<image class="logo" :src="item.logo" mode="scaleToFill"></image>
				<text class="login-title">{{item.text}}</text>
			</view>
		</view>
	</view>
</template>
<script>
	import config from '@/uni_modules/uni-id-pages/config.js'
	
	import {store,mutations} from '@/uni_modules/uni-id-pages/common/store.js'
	let allServicesList = []
	export default {
		computed: {
			agreements() {
				if (!config.agreements) {
					return []
				}
				let {
					serviceUrl,
					privacyUrl
				} = config.agreements
				return [{
						url: serviceUrl,
						title: "用户服务协议"
					},
					{
						url: privacyUrl,
						title: "隐私政策条款"
					}
				]
			},
			agree: {
				get() {
					return this.getParentComponent().agree
				},
				set(agree) {
					return this.getParentComponent().agree = agree
				}
			}
		},
		data() {
			return {
				servicesList: [{
						"id": "username",
						"text": "账号登录",
						"logo": "/uni_modules/uni-id-pages/static/login/uni-fab-login/user.png",
						"path": "/uni_modules/uni-id-pages/pages/login/login-withpwd"
					},
					{
						"id": "smsCode",
						"text": "短信验证码",
						"logo": "/uni_modules/uni-id-pages/static/login/uni-fab-login/sms.png",
						"path": "/uni_modules/uni-id-pages/pages/login/login-withoutpwd?type=smsCode"
					},
					{
						"id": "weixin",
						"text": "微信登录",
						"logo": "/uni_modules/uni-id-pages/static/login/uni-fab-login/weixin.png",
					},
					
					{
						"id": "apple",
						"text": "苹果登录",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/apple.png",
					},
					{
						"id": "univerify",
						"text": "一键登录",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/univerify.png",
					},
					{
						"id": "taobao",
						"text": "淘宝登录", 
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/taobao.png",
					},
					{
						"id": "facebook",
						"text": "脸书登录", 
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/facebook.png",
					},
					{
						"id": "alipay",
						"text": "支付宝登录", 
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/alipay.png",
					},
					{
						"id": "qq",
						"text": "QQ登录", 
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/qq.png",
					},
					{
						"id": "google",
						"text": "谷歌登录", 
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/google.png",
					},
					{
						"id": "douyin",
						"text": "抖音登录", 
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/douyin.png",
					},
					{
						"id": "sinaweibo",
						"text": "新浪微博", 
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/sinaweibo.png",
					}
					
				],
				univerifyStyle: { 
					"fullScreen": true, 
					"backgroundColor": "#ffffff", 
					"buttons": { 
					"iconWidth": "45px", 
					"list": []
					},
					"privacyTerms": {
						"defaultCheckBoxState": false, 
						"textColor": "#BBBBBB", 
						"termsColor": "#5496E3", 
						"prefix": "我已阅读并同意", 
						"suffix": "并使用本机号码登录", 
						"privacyItems": []
					}
				}
			}
		},
		watch: {
			agree(agree) {
				this.univerifyStyle.privacyTerms.defaultCheckBoxState = agree
			}
		},
		async created() {
			let servicesList = this.servicesList
			let loginTypes = config.loginTypes

			servicesList = servicesList.filter(item => {
				if (item.id == 'apple') {
					return false
				}
				if (item.id == 'apple' && uni.getSystemInfoSync().osName != 'ios') {
					return false
				}
				return loginTypes.includes(item.id)
			})
			
			if (loginTypes.includes('univerify')) {
				this.univerifyStyle.privacyTerms.privacyItems = this.agreements
				
				servicesList.forEach(({
					id,
					logo,
					path
				}) => {
					if (id != 'univerify') {
						this.univerifyStyle.buttons.list.push({
							"iconPath": logo,
							"provider": id,
							path 
						})
					}
				})
			}
			
			this.servicesList = servicesList.filter(item => {
				let path = item.path ? item.path.split('?')[0] : '';
				return path != this.getRoute(1)
			})
		},
		methods: {
			getParentComponent(){
				return this.$parent;
			},
			setUserInfo(e) {
				console.log('setUserInfo', e);
			},
			getRoute(n = 0) {
				let pages = getCurrentPages();
				if (n > pages.length) {
					return ''
				}
				return '/' + pages[pages.length - n].route
			},
			toPage(path,index = 0) {
				if (this.getRoute(1) == path.split('?')[0] && this.getRoute(1) ==
					'/uni_modules/uni-id-pages/pages/login/login-withoutpwd') {
					let loginType = path.split('?')[1].split('=')[1]
					uni.$emit('uni-id-pages-setLoginType', loginType)
				} else if (this.getRoute(2) == path) { 
					uni.navigateBack();
				} else if (this.getRoute(1) != path) {
					if(index === 0){
						uni.navigateTo({
							url: path,
							animationType: 'slide-in-left',
							complete(e) {
							}
						})
					}else{
						uni.redirectTo({
							url: path,
							animationType: 'slide-in-left',
							complete(e) {
							}
						})
					}
				} else {
					console.log('出乎意料的情况,path：' + path);
				}
			},
			async login_before(type, navigateBack = true, options = {}) {
				console.log(type);
				
				if (["qq",
						"xiaomi",
						"sinaweibo",
						"taobao",
						"facebook",
						"google",
						"alipay",
						"douyin",
					].includes(type)) {
					return uni.showToast({
						title: '该登录方式暂未实现，欢迎提交pr',
						icon: 'none',
						duration: 3000
					});
				}

				let isAppExist = true
				// #ifdef APP-PLUS
				await new Promise((callback) => {
					plus.oauth.getServices(oauthServices => {
						let index = oauthServices.findIndex(e => e.id == type)
						if(index != -1){
							isAppExist = oauthServices[index].nativeClient
							callback()
						}else{
							return uni.showToast({
								title: '当前设备不支持此登录，请选择其他登录方式',
								icon: 'none',
								duration: 3000
							});
						}
					}, err => {
						throw new Error('获取服务供应商失败：' + JSON.stringify(err))
					})
				})
				// #endif

				if (!isAppExist && ["univerify", "apple"].includes(type)) {
					return uni.showToast({
						title: '当前设备不支持此登录，请选择其他登录方式',
						icon: 'none',
						duration: 3000
					});
				}

				let needAgreements = (config?.agreements?.scope || []).includes('register')
				if (type != 'univerify' && needAgreements && !this.agree) {
					let agreementsRef = this.getParentComponent().$refs.agreements
					return agreementsRef.popup(() => {
						this.login_before(type, navigateBack, options)
					})
				}

				// #ifdef H5
				if(type == 'weixin'){
					const baseUrl = process.env.BASE_URL || '/'
					let redirectUrl = location.protocol +
						'//' +
						location.host +
						baseUrl.replace(/\/$/, '') +
						(window.location.href.includes('#')?'/#':'') +
						'/uni_modules/uni-id-pages/pages/login/login-withoutpwd?is_weixin_redirect=true&type=weixin'
						
					redirectUrl=redirectUrl.replace(location.host,config.webWXAuthBackDomain)
					let ua = window.navigator.userAgent.toLowerCase();
					if (ua.match(/MicroMessenger/i) == 'micromessenger'){
						return window.open(`https://open.weixin.qq.com/connect/oauth2/authorize?
									appid=${config.appid.weixin.h5}
									&redirect_uri=${encodeURIComponent(redirectUrl)}
									&response_type=code
									&scope=snsapi_userinfo
									&state=STATE&connect_redirect=1#wechat_redirect`);
					}else{
						return location.href = `https://open.weixin.qq.com/connect/qrconnect?appid=${config.appid.weixin.web}
										&redirect_uri=${encodeURIComponent(redirectUrl)}
										&response_type=code&scope=snsapi_login&state=STATE#wechat_redirect`
					}
				}
				// #endif
				
				uni.showLoading({
					mask: true
				})

				if (type == 'univerify') {
					let univerifyManager = uni.getUniverifyManager()
					let clickAnotherButtons = false
					let onButtonsClickFn = async res => {
						clickAnotherButtons = true
						let checkBoxState = await uni.getCheckBoxState();
						this.agree = checkBoxState[1]?.state || checkBoxState.state
						
						let {
							path
						} = this.univerifyStyle.buttons.list[res.index]
						if (path) {
							if( this.getRoute(1).includes('login-withoutpwd') && path.includes('login-withoutpwd') ){
								this.getParentComponent().showCurrentWebview()
							}
							this.toPage(path,1)
							closeUniverify()
						} else {
							if (this.agree) {
								closeUniverify()
								setTimeout(() => {
									this.login_before(res.provider)
								}, 500)
							} else {
								uni.showToast({
									title: "你未同意隐私政策协议",
									icon: 'none',
									duration: 3000
								});
							}
						}
					}

					function closeUniverify() {
						uni.hideLoading()
						univerifyManager.close()
						univerifyManager.offButtonsClick(onButtonsClickFn)
					}
					
					univerifyManager.onButtonsClick(onButtonsClickFn)
					
					return univerifyManager.login({
						"univerifyStyle": this.univerifyStyle,
						success: res => {
							this.login(res.authResult, 'univerify')
						},
						fail(err) {
							console.log(err)
							if(!clickAnotherButtons){
								uni.navigateBack()
							}
						},
						complete: async e => {
							uni.hideLoading()
							univerifyManager.offButtonsClick(onButtonsClickFn)
						}
					})
				}

				if (type === 'weixinMobile') {
					return this.login({
						phoneCode: options.phoneNumberCode
					}, type)
				}

				uni.login({
					"provider": type,
					"onlyAuthorize": true,
					"univerifyStyle": this.univerifyStyle,
					success: async e => {
						if (type == 'apple') {
							let res = await this.getUserInfo({
								provider: "apple"
							})
							Object.assign(e.authResult, res.userInfo)
							uni.hideLoading()
						}
						this.login(type == 'weixin' ? {
							code: e.code
						} : e.authResult, type)
					},
					fail: async (err) => {
						console.log('uni.login 失败:', err);
						uni.hideLoading()
						uni.showModal({
							title: '登录失败',
							content: err.errMsg || JSON.stringify(err) || '获取授权失败，请重试',
							confirmText: '知道了',
							showCancel: false
						});
					}
				})
			},
			login(params, type) { 
				let action = 'loginBy' + type.trim().replace(type[0], type[0].toUpperCase())
				const uniIdCo = uniCloud.importObject("uni-id-co",{
					customUI:true
				})
				uniIdCo[action](params).then(result => {
					uni.showToast({
						title: '登录成功',
						icon: 'none',
						duration: 2000
					});
					result.loginType = type
					mutations.loginSuccess(result)
				})
				.catch(e=>{
					console.error('登录失败:', e);
					uni.showModal({
						title: '登录失败',
						content: e.message || e.errMsg || JSON.stringify(e),
						confirmText: "知道了",
						showCancel: false
					});
				})
				.finally(e => {
					if (type == 'univerify') {
						uni.closeAuthView()
					}
					uni.hideLoading()
				})
			},
			async getUserInfo(e) {
				return new Promise((resolve, reject) => {
					uni.getUserInfo({
						...e,
						success: (res) => {
							resolve(res);
						},
						fail: (err) => {
							uni.showModal({
								content: JSON.stringify(err),
								showCancel: false
							});
							reject(err);
						}
					})
				})
			}
		}
	}
</script>

<style lang="scss">
	.fab-login-box,
	.item {
		display: flex;
		box-sizing: border-box;
		flex-direction: column;
	}
	.fab-login-box {
		flex-direction: row;
		flex-wrap: wrap;
		width: 750rpx;
		justify-content: space-around;
		position: fixed;
		left: 0;
	}
	.item {
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 200rpx;
		cursor: pointer;
	}
	@media screen and (min-width: 690px) {
		.fab-login-box {
			max-width: 500px;
			margin-left: calc(50% - 250px);
		}
		.item {
			height: 160rpx;
		}
	}
	@media screen and (max-width: 690px) {
		.fab-login-box {
			bottom: 10rpx;
		}
	}
	.logo {
		width: 60rpx;
		height: 60rpx;
		max-width: 40px;
		max-height: 40px;
		border-radius: 100%;
		border: solid 1px #F6F6F6;
	}
	.login-title {
		text-align: center;
		margin-top: 6px;
		color: #999;
		font-size: 10px;
		width: 70px;
	}
</style>

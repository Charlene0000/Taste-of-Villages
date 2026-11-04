<template>
	<view class="uni-content">
		
		<view class="watercolor-bg">
			<view class="blob-1"></view>
			<view class="blob-2"></view>
			<view class="blob-3"></view>
		</view>

		
		<view class="logo-area">
			<view class="logo-box">
				<image class="logo-img" :src="logo" mode="aspectFit"></image>
			</view>
			<text class="app-name">舌尖上的村落</text>
		</view>

		
		<view class="action-area">
			
			<template v-if="['apple','weixin', 'weixinMobile'].includes(type)">
				<view class="quickLogin">
					<button v-if="type === 'weixinMobile'" type="primary" open-type="getPhoneNumber" @getphonenumber="quickLogin"
						class="btn-wechat">
						<svg class="icon-wechat" viewBox="0 0 24 24" width="24" height="24">
							<path d="M8.5,14.5c0.8,0,1.5-0.7,1.5-1.5s-0.7-1.5-1.5-1.5S7,12.2,7,13S7.7,14.5,8.5,14.5z M15.5,14.5c0.8,0,1.5-0.7,1.5-1.5 s-0.7-1.5-1.5-1.5s-1.5,0.7-1.5,1.5S14.7,14.5,15.5,14.5z M12,2C6.5,2,2,6,2,11c0,2.9,1.6,5.5,4,7.1v2.8l2.9-1.4c0.1,0,0.1,0,0.2,0.1 C10,20.4,11.5,20.9,13,20.6c-0.3-0.9-0.5-1.8-0.5-2.8c0-4.6,4.3-8.4,9.5-8.4c0.7,0,1.3,0.1,2,0.2C23.1,5.3,18.1,2,12,2z" fill="#ffffff"/>
						</svg>
						<text>微信一键登录</text>
					</button>
					<view v-else class="btn-wechat" @click="quickLogin">
						<image v-if="type === 'apple'" src="/uni_modules/uni-id-pages/static/app-plus/apple.png" mode="widthFix" style="width: 24px; height: 24px; margin-right: 10px;"></image>
						<svg v-else class="icon-wechat" viewBox="0 0 24 24" width="24" height="24">
							<path d="M8.5,14.5c0.8,0,1.5-0.7,1.5-1.5s-0.7-1.5-1.5-1.5S7,12.2,7,13S7.7,14.5,8.5,14.5z M15.5,14.5c0.8,0,1.5-0.7,1.5-1.5 s-0.7-1.5-1.5-1.5s-1.5,0.7-1.5,1.5S14.7,14.5,15.5,14.5z M12,2C6.5,2,2,6,2,11c0,2.9,1.6,5.5,4,7.1v2.8l2.9-1.4c0.1,0,0.1,0,0.2,0.1 C10,20.4,11.5,20.9,13,20.6c-0.3-0.9-0.5-1.8-0.5-2.8c0-4.6,4.3-8.4,9.5-8.4c0.7,0,1.3,0.1,2,0.2C23.1,5.3,18.1,2,12,2z" fill="#ffffff"/>
						</svg>
						<text>{{ type === 'apple' ? 'Apple登录' : '微信登录' }}</text>
					</view>
					
					<uni-id-pages-agreements scope="register" ref="agreements"></uni-id-pages-agreements>
				</view>
			</template>
			
			<template v-else>
				<text class="tip">未注册的账号验证通过后将自动注册</text>
				<view class="phone-box">
					<view @click="chooseArea" class="area">+86</view>
					<uni-easyinput :focus="focusPhone" @blur="focusPhone = false" class="input-box" type="number"
						:inputBorder="false" v-model="phone" maxlength="11" placeholder="请输入手机号" />
				</view>
				<uni-id-pages-agreements scope="register" ref="agreements"></uni-id-pages-agreements>
				<button class="btn-wechat" style="margin-top: 20px;" @click="toSmsPage">获取验证码</button>
			</template>
            
            <view style="display:none;">
                <uni-id-pages-fab-login ref="uniFabLogin"></uni-id-pages-fab-login>
            </view>
		</view>
	</view>
</template>

<script>
	let currentWebview; 
	import config from '@/uni_modules/uni-id-pages/config.js'
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	export default {
		mixins: [mixin],
		data() {
			return {
				type: "", 
				phone: "", 
				focusPhone: false,
				logo: "https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/logo.png",
				isLogging: false 
			}
		},
		computed: {
			async loginTypes() { 
				return config.loginTypes
			},
			isPhone() { 
				return /^1\d{10}$/.test(this.phone);
			},
			imgSrc() { 
				return this.type == 'weixin' ? '/uni_modules/uni-id-pages/static/login/weixin.png' :
					'/uni_modules/uni-id-pages/static/app-plus/apple.png'
			}
		},
		async onLoad(e) {
			
			let type = e.type || config.loginTypes[0]
			this.type = type

			
			if (type != 'univerify') {
				this.focusPhone = true
			}
			this.$nextTick(() => {
				
				if (['weixin', 'apple'].includes(type) && this.$refs.uniFabLogin) {
					this.$refs.uniFabLogin.servicesList = this.$refs.uniFabLogin.servicesList.filter(item =>
						item.id != type)
				}
			})
			uni.$on('uni-id-pages-setLoginType', type => {
				this.type = type
			})
		},
		onShow() {
			
			document.onkeydown = event => {
				var e = event || window.event;
				if (e && e.keyCode == 13) { 
					this.toSmsPage()
				}
			};
			
		},
		onUnload() {
			uni.$off('uni-id-pages-setLoginType')
		},
		onReady() {
			
			
			if (this.type == "univerify") {
				const pages = getCurrentPages();
				currentWebview = pages[pages.length - 1].$getAppWebview();
				currentWebview.setStyle({
					"top": "2000px" 
				})
				this.type == this.loginTypes[1]
				
				if (this.$refs.uniFabLogin) {
				    this.$refs.uniFabLogin.login_before('univerify')
				}
			}
			
		},
		methods: {
			showCurrentWebview(){
				
				currentWebview.setStyle({
					"top": 0
				})
			},
			quickLogin(e) {
				
				if (this.isLogging) {
					return
				}
				this.isLogging = true
				
				let options = {}

				if (e.detail?.code) {
					options.phoneNumberCode = e.detail.code
				}

				if (this.type === 'weixinMobile' && !e.detail?.code) {
					this.isLogging = false
					return
				}

				
				if (this.needAgreements && !this.agree) {
					this.isLogging = false
					if (this.$refs.agreements) {
						return this.$refs.agreements.popup(() => {
							this.quickLogin(e)
						})
					}
					return uni.showToast({
						title: '请先同意用户协议和隐私政策',
						icon: 'none'
					})
				}

				this.$refs.uniFabLogin.login_before(this.type, true, options)
				
				setTimeout(() => {
					this.isLogging = false
				}, 1000)
			},
			toSmsPage() {
				if (!this.isPhone) {
					this.focusPhone = true
					return uni.showToast({
						title: "手机号码格式不正确",
						icon: 'none',
						duration: 3000
					});
				}
				if (this.needAgreements && !this.agree) {
					return this.$refs.agreements.popup(this.toSmsPage)
				}
				
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/login/login-smscode?phoneNumber=' + this.phone
				});
			},
			
			toPwdLogin() {
				uni.navigateTo({
					url: '../login/password'
				})
			},
			chooseArea() {
				uni.showToast({
					title: '暂不支持其他国家',
					icon: 'none',
					duration: 3000
				});
			},
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni_modules/uni-id-pages/common/login-page.scss";
	
	
	.uni-content {
		width: 100%;
		height: 100vh;
		position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
		overflow: hidden;
		background-color: #FFFDF9; 
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
        padding: 0;
        box-sizing: border-box;
	}

	
	.watercolor-bg {
		position: absolute;
		top: 0; left: 0; width: 100%; height: 100%;
		z-index: 0;
		pointer-events: none;
	}

	.blob-1 {
		position: absolute;
		top: -10%; left: -20%;
		width: 400px; height: 400px;
		background: radial-gradient(circle, #FBDDAB 0%, rgba(251, 221, 171, 0) 70%);
		filter: blur(40px);
		opacity: 0.8;
		border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
		animation: float 10s infinite ease-in-out;
	}

	.blob-2 {
		position: absolute;
		top: 40%; right: -30%;
		width: 350px; height: 350px;
		background: radial-gradient(circle, #FBBD72 0%, rgba(251, 189, 114, 0) 70%);
		filter: blur(50px);
		opacity: 0.6;
		border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
		animation: float 12s infinite ease-in-out reverse;
	}

	.blob-3 {
		position: absolute;
		bottom: -10%; left: -10%;
		width: 300px; height: 300px;
		background: radial-gradient(circle, #DF7D1C 0%, rgba(223, 125, 28, 0) 70%);
		filter: blur(60px);
		opacity: 0.2;
		border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
	}

	@keyframes float {
		0% { transform: translate(0, 0) rotate(0deg); }
		50% { transform: translate(20px, 20px) rotate(5deg); }
		100% { transform: translate(0, 0) rotate(0deg); }
	}

	
	.logo-area {
		margin-top: 140px;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
        width: 100%;
        justify-content: center;
	}

	.logo-box {
		width: 110px; height: 110px;
		background-color: #fff;
		border-radius: 24px;
		box-shadow: 0 15px 35px rgba(223, 125, 28, 0.15);
		display: flex; justify-content: center; align-items: center;
		position: relative;
		transform: rotate(-3deg);
		border: 2px solid rgba(255,255,255,0.8);
	}

	.logo-img {
		width: 80px; height: 80px;
		border-radius: 12px;
	}

	.app-name {
		margin-top: 20px;
		font-size: 20px;
		letter-spacing: 2px;
		color: #8D6E63;
		font-weight: bold;
	}

	
	.action-area {
		margin-top: auto;
		margin-bottom: 80px;
		width: 100%;
		padding: 0 40px;
		z-index: 2;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
        justify-content: center;
	}

	.quickLogin {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.btn-wechat {
		width: 100%;
		height: 56px;
		border-radius: 28px;
		border: none;
		background: linear-gradient(135deg, #FBBD72 0%, #DF7D1C 100%);
		color: #fff;
		font-size: 16px;
		font-weight: 600;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 10px;
		box-shadow: 0 10px 25px rgba(223, 125, 28, 0.3);
		cursor: pointer;
		margin-bottom: 20px;
		line-height: normal; 
        margin-left: auto;
        margin-right: auto;
	}
	
	.btn-wechat:after {
		border: none; 
	}

	.icon-wechat {
		display: block;
	}

	.tip {
		text-align: center;
		color: #A1887F;
		font-size: 14px;
		margin-bottom: 20px;
	}

	.phone-box {
		width: 100%;
		display: flex;
		align-items: center;
		background: #fff;
		border-radius: 28px;
		padding: 5px 20px;
		box-shadow: 0 4px 15px rgba(223, 125, 28, 0.05);
		border: 1px solid rgba(223, 125, 28, 0.2);
		margin-bottom: 20px;
		box-sizing: border-box;
	}

	.area {
		margin-right: 15px;
		color: #5D4037;
		font-weight: 600;
	}

	.input-box {
		flex: 1;
	}
	
	
	::v-deep .uni-id-pages-agreements {
		color: #A1887F;
		margin-top: 10px;
        width: 100%;
        display: flex;
        justify-content: center;
	}
	::v-deep .uni-id-pages-agreements .uni-agreements {
		justify-content: center;
        text-align: center;
	}
</style>

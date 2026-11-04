<template>
	<view class="root" v-if="agreements.length">
		<template v-if="needAgreements">
			<checkbox-group @change="setAgree">
				<label class="checkbox-box">
					<checkbox :checked="isAgree" style="transform: scale(0.5);margin-right: -6px;" />
					<text class="text">同意</text>
				</label>
			</checkbox-group>
			<view class="content">
				<view class="item" v-for="(agreement,index) in agreements" :key="index">
					<text class="agreement text" @click="navigateTo(agreement)">{{agreement.title}}</text>
					<text class="text and" v-if="hasAnd(agreements,index)" space="nbsp"> 和 </text>
				</view>
			</view>
		</template>
		
		<uni-popup v-if="needAgreements||needPopupAgreements" ref="popupAgreement" type="center">
			<uni-popup-dialog confirmText="同意" @confirm="popupConfirm">
				<view class="content">
					<text class="text">请先阅读并同意</text>
					<view class="item" v-for="(agreement,index) in agreements" :key="index">
						<text class="agreement text" @click="navigateTo(agreement)">{{agreement.title}}</text>
						<text class="text and" v-if="hasAnd(agreements,index)" space="nbsp"> 和 </text>
					</view>
				</view>
			</uni-popup-dialog>
		</uni-popup>
	</view>
</template>

<script>
	import config from '@/uni_modules/uni-id-pages/config.js'
	let retryFun = ()=>console.log('为定义')
	
	export default {
		name: "uni-agreements",
		computed: {
			agreements() {
				if(!config.agreements){
					return []
				}
				let {serviceUrl,privacyUrl} = config.agreements
				return [
					{
						url:serviceUrl,
						title:"用户服务协议"
					},
					{
						url:privacyUrl,
						title:"隐私政策条款"
					}
				]
			}
		},
		props: {
			scope: {
				type: String,
				default(){
					return 'register'
				}
			},
		},
		methods: {
			popupConfirm(){
				this.isAgree = true
				retryFun()
				
			},
			popup(Fun){
				this.needPopupAgreements = true
				
				this.$nextTick(()=>{
					if(Fun){
						retryFun = Fun
					}
					this.$refs.popupAgreement.open()
				})
			},
			navigateTo({
				url,
				title
			}) {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/common/webview/webview?url=' + url + '&title=' + title,
					success: res => {},
					fail: () => {},
					complete: () => {}
				});
			},
			hasAnd(agreements, index) {
				return agreements.length - 1 > index
			},
			setAgree(e) {
				this.isAgree = !this.isAgree
				this.$emit('setAgree', this.isAgree)
			}
		},
		created() {
			this.needAgreements = (config?.agreements?.scope || []).includes(this.scope)
		},
		data() {
			return {
				isAgree: false,
				needAgreements:true,
				needPopupAgreements:false
			};
		}
	}
</script>

<style lang="scss" scoped>
	
	view {
		display: flex;
		box-sizing: border-box;
		flex-direction: column;
	}

	
	.root {
		flex-direction: row;
		align-items: center;
		font-size: 12px;
		color: #8a8f8b;
	}

	.checkbox-box ,.uni-label-pointer{
		align-items: center;
		display: flex;
		flex-direction: row;
	}

	.item {
		flex-direction: row;
	}
	.text{
		line-height: 26px;
	}
	.agreement {
		color: #04498c;
		cursor: pointer;
	}
	
	.checkbox-box ::v-deep .uni-checkbox-input{
		border-radius: 100%;
	}

	.checkbox-box ::v-deep .uni-checkbox-input.uni-checkbox-input-checked{
		border-color: #007aff;
		color: #FFFFFF !important;
		background-color: #007aff;
	}
	
	.content{
		flex-wrap: wrap;
		flex-direction: row;
	}
	
	.root ::v-deep .uni-popup__error{
		color: #333333;
	}
</style>


import config from '@/uni_modules/uni-id-pages/config.js'

const uniIdCo = uniCloud.importObject('uni-id-co', {
  customUI: true
})

const {
  loginTypes,
  debug
} = config

export default async function () {
  
  if (debug) {
    
    
    const {
      supportedLoginType
    } = await uniIdCo.getSupportedLoginType()
    console.log('supportedLoginType: ' + JSON.stringify(supportedLoginType))
    
    const data = {
      smsCode: 'mobile-code',
      univerify: 'univerify',
      username: 'username-password',
      weixin: 'weixin',
      qq: 'qq',
      xiaomi: 'xiaomi',
      sinaweibo: 'sinaweibo',
      taobao: 'taobao',
      facebook: 'facebook',
      google: 'google',
      alipay: 'alipay',
      apple: 'apple',
      weixinMobile: 'weixin'
    }
    
    const list = loginTypes.filter(type => !supportedLoginType.includes(data[type]))
    if (list.length) {
      console.error(
				`错误：前端启用的登录方式:${list.join('，')};没有在服务端完成配置。配置文件路径："/uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center/uni-id/config.json"`
      )
    }
  }

  
  
  // #ifdef APP-PLUS
  if (loginTypes.includes('univerify')) {
    uni.preLogin({
      provider: 'univerify',
      complete: e => {
        
      }
    })
  }
  // #endif


  
  
  const db = uniCloud.database()
  db.on('error', onDBError)
  
  function onDBError ({
    code, 
    message
  }) {
    
  }
  
  

  
  if (uniCloud.onRefreshToken) {
    uniCloud.onRefreshToken(() => {
      
      if (uni.getPushClientId) {
        uni.getPushClientId({
          success: async function (e) {
            
            const pushClientId = e.cid
            
            const res = await uniIdCo.setPushCid({
              pushClientId
            })
            
          },
          fail (e) {
            
          }
        })
      }
    })
  }
}

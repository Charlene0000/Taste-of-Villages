export default {
  
  debug: false,
  
  isAdmin: false, 
  loginTypes: [
    
    
    
    
    
    
    
    

    
    'weixin',
    'univerify',
    'username',
    'smsCode'
  ],
  
  agreements: {
    serviceUrl: 'https://xxx', 
    privacyUrl: 'https://xxx', 
    
    scope: [
      'register', 'login', 'realNameVerify'
    ]
  },
  
  appid: {
    weixin: {
      
      h5: 'wx0xxxxxxxxxxx10',
      
      web: 'wx6xxxxxxxxxxxc8'
    }
  },
  
  passwordStrength: 'medium',
  
  setPasswordAfterLogin: false,
  
  webWXAuthBackDomain: 'm.xxxxxx.love'
}

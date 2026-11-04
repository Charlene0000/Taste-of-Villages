<template>
  <view class="congmei-mask" v-if="visible" @click="close" :class="{ 'visible': showContent }">
    <view class="popup-content" @click.stop :class="{ 'slide-up': showContent }">
      
      
      <view class="deco deco-flower"></view>
      <view class="deco deco-leaf"></view>
      <view class="deco deco-wheat"></view>
      <view class="deco deco-cloud"></view>
      <view class="deco deco-sparkle-1"></view>
      <view class="deco deco-sparkle-2"></view>

      
      <block v-if="isFeatureEnabled">
          
          <view class="popup-header">
            <view class="header-bg-decoration"></view>
            
            
            <view class="header-top-row">
               <view class="avatar-wrapper">
                 <image v-if="isSpeaking" class="main-avatar" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/congmei-speak.gif" mode="aspectFit"></image>
                 <image v-else class="main-avatar" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/congmei-static.gif" mode="aspectFit"></image>
               </view>
               <view class="greeting-bubble">
                 <view class="bubble-content-row">
                    <text class="greeting-text">我是饼饼，美食我最在行</text>
                 </view>
                 <view class="bubble-arrow"></view>
                 
                 
                 <view class="controls-row">
                    
                    
                    <view class="control-btn lang-btn" @click.stop="showLanguagePicker = !showLanguagePicker">
                        <text class="icon-text">{{ currentLanguage }} ▼</text>
                        
                        <view class="lang-dropdown" v-if="showLanguagePicker">
                          <view v-for="lang in languages" :key="lang.value" class="lang-item" @click.stop="selectLanguage(lang)">
                            {{ lang.label }}
                          </view>
                        </view>
                    </view>
                 </view>
               </view>
               
               
               
            </view>
          </view>
    
          
          <scroll-view class="chat-scroll-area" scroll-y="true" :scroll-top="scrollTop" :scroll-with-animation="true" @click="showLanguagePicker = false">
            
            
            <view v-if="messages.length <= 1" class="welcome-section">
               <view class="suggest-card" v-for="(q, idx) in suggestQuestions" :key="idx" @click="chooseSuggest(q)">
                  <text class="suggest-text">{{ q }}</text>
                  <text class="hot-icon">🔥</text>
               </view>
            </view>
    
            
            <view class="message-list">
              <view 
                v-for="(message, index) in messages" 
                :key="index" 
                class="message-item"
                :class="message.type === 'user' ? 'user-layout' : 'friend-layout'"
              >
                <template v-if="message.type === 'friend'">
                  <view class="friend-msg-bubble">
                     <text :class="{'large-text': isLargeText}">{{ message.content }}</text>
                  </view>
                </template>
                <template v-else>
                  <view class="user-msg-bubble">
                     <text :class="{'large-text': isLargeText}">{{ message.content }}</text>
                  </view>
                  <image class="msg-avatar user-avatar" :src="userAvatar" mode="aspectFill"></image>
                </template>
              </view>
            </view>
          </scroll-view>
    
          
          <view class="popup-footer">
            <view class="input-wrapper">
              <input 
                class="chat-input" 
                v-model="inputText" 
                placeholder="输入你想问我的问题" 
                placeholder-class="input-placeholder"
                @confirm="sendMessage"
              />
              <view class="send-btn" @click="sendMessage">
                <text>发送</text>
              </view>
            </view>
          </view>
      </block>
      
      
      <view v-else class="simple-page-container">
          
          <image class="simple-icon" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/icon/congmei.png" mode="aspectFit" v-if="!isLoadingFeature"></image> 
          <text class="simple-title" v-if="!isLoadingFeature">大家好！我是饼饼</text>
          <view class="simple-desc" v-if="!isLoadingFeature">
            <text>我是大家的好朋友，很高兴见到你~</text>
            <text style="display: block; margin-top: 10rpx;">让我们一起探索美食吧！</text>
          </view>
          <text v-if="isLoadingFeature" style="color: #888;">加载中...</text>
      </view>

    </view>
  </view>
</template>

<script>
export default {
  name: 'CongmeiInteractPopup',
  data() {
    return {
      visible: false,
      showContent: false,
      isLargeText: false,
      
      
      isFeatureEnabled: false, 
      isLoadingFeature: true,

      messages: [
        { type: 'friend', content: '您好！我是你的资深美食向导饼饼，这里有各种好吃的等着你发现哦！' }
      ],
      inputText: '',
      scrollTop: 0,
      isTyping: false,
      isSending: false,
      isSpeaking: false,
      suggestQuestions: [
        '汕尾有什么特产？',
        '哪里有海胆味沙琪玛？',
        '推荐几道本地必吃美食',
        '附近有什么好吃的海鲜大排档？'
      ],
      userAvatar: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/mine.png', 
      
      
      
      
      ttsRegion: 'ap-guangzhou',
      audioContexts: [],
      currentReply: null,
      typingIndex: 0,
      
      
      showLanguagePicker: false,
      currentLanguage: '普通话',
      languages: [
        { label: '普通话', value: 'mandarin', vcn: 'x4_yezi' },
        { label: '广东话', value: 'cantonese', vcn: 'x_xiaomei' },
        { label: '闽南语', value: 'minnan', vcn: 'x3_linlin' },
        { label: '上海话', value: 'shanghainese', vcn: 'x3_ziling' },
        { label: '东北话', value: 'northeastern', vcn: 'x4_xiaobei' },
        { label: '成都话', value: 'chengdu', vcn: 'x3_xiaodu' },
        { label: '四川话', value: 'sichuan', vcn: 'x3_yezi_sc' },
		{ label: '苏州话', value: 'suzhou', vcn: 'x2_SuhCn_XiXi' },
		{ label: '陕西话', value: 'shanxi', vcn: 'x2_xiaoying' },
        { label: '英语', value: 'english', vcn: 'x4_enus_lucy_education' },
        { label: '日语', value: 'japanese', vcn: 'xiaofux4_jajp_zhongcun_assist' }
      ]
    };
  },
  created() {
    
    this.checkFeatureStatus();

    
    let userInfo = uni.getStorageSync('uni-id-pages-userInfo');
    if (!userInfo) {
        userInfo = uni.getStorageSync('userInfo');
    }
    
    if (userInfo && (userInfo.avatarUrl || userInfo.avatar || userInfo.headimgurl)) {
       this.userAvatar = userInfo.avatarUrl || userInfo.avatar || userInfo.headimgurl;
    } else if (userInfo && userInfo.avatar_file && userInfo.avatar_file.url) {
       this.userAvatar = userInfo.avatar_file.url;
    }
  },
  methods: {
    async checkFeatureStatus() {
        this.isLoadingFeature = true;
        try {
            const res = await uniCloud.callFunction({
                name: 'ai-agent',
                data: { action: 'checkStatus' }
            });
            
            if (res.result && res.result.enable === true) {
                this.isFeatureEnabled = true;
            } else {
                this.isFeatureEnabled = false;
            }
        } catch (e) {
            console.error('Failed to check feature status:', e);
            
            this.isFeatureEnabled = false;
        } finally {
            this.isLoadingFeature = false;
        }
    },
    open() {
      this.visible = true;
      
      
      this.checkFeatureStatus();

      
      setTimeout(() => {
        this.showContent = true;
      }, 50);
    },
    close() {
      this.showContent = false;
      setTimeout(() => {
        this.visible = false;
        this.cleanupAudioContexts();
        this.$emit('close');
      }, 300);
    },
    selectLanguage(lang) {
      this.currentLanguage = lang.label;
      this.showLanguagePicker = false;
    },
    toggleFontSize() {
      this.isLargeText = !this.isLargeText;
    },
    toggleVoice() {
        
        if (this.audioContexts.length > 0) {
            this.cleanupAudioContexts();
        }
    },
    
    
    
    chooseSuggest(q) {
      if (this.isTyping || this.isSending) return;
      this.inputText = q;
      this.sendMessage();
    },
    sendMessage() {
      if (!this.inputText.trim() || this.isSending || this.isTyping) return;
      
      const userQuestion = this.inputText.trim();
      this.messages.push({ type: 'user', content: userQuestion });
      this.inputText = '';
      
      this.$nextTick(() => this.scrollToBottom());
      
      this.$nextTick(() => this.scrollToBottom());
      
      this.messages.push({ type: 'friend', content: '正在思考...' });
      this.$nextTick(() => this.scrollToBottom());
      
      this.callDeepSeekAPI(userQuestion);
    },
    async callDeepSeekAPI(userQuestion) {
      this.isSending = true;
      this.isTyping = true;
      
      
      const systemPrompt = `你是一个资深美食向导，名字叫"饼饼"。请用${this.currentLanguage}回答。
      要求：
      1. 名字是饼饼；
      2. 身份是资深美食向导；
      3. 只回答关于美食的问题，如果用户问其他问题，请委婉拒绝并引导回美食话题；
      4. 回答控制在100字以内；
      5. 风格可爱、治愈、热情；
      6. 回答仅使用纯文本，禁止使用*、#、-、加粗、列表等任何格式符号。`;
      
      try {
          const res = await uniCloud.callFunction({
              name: 'ai-agent',
              data: {
                  action: 'chat',
                  uid: (uni.getStorageSync('uni-id-pages-userInfo') || uni.getStorageSync('userInfo'))?._id || '',
                  data: {
                      messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userQuestion }
                      ]
                  }
              }
          });
          
          this.isSending = false;
          
          if (res.result && res.result.code === 200 && res.result.result?.choices?.[0]) {
             let reply = res.result.result.choices[0].message.content || '我暂时无法回答这个问题';
             
             
             reply = reply.replace(/\*/g, '').trim();
             
             
             this.messages[this.messages.length - 1].content = '';
             this.currentReply = reply;
             this.startTypingCustom(reply);
          } else {
             this.isTyping = false;
             this.messages[this.messages.length - 1].content = '网络繁忙，请稍后再试';
             console.error('Service Error:', res);
          }
      } catch (e) {
          this.isSending = false;
          this.isTyping = false;
          this.messages[this.messages.length - 1].content = '网络错误';
          console.error('Call Function Error:', e);
      }
    },
    startTypingCustom(answer) {
      this.typingIndex = 0;
      this.customAnswer = answer;
      this.typeNextCharCustom();
    },
    typeNextCharCustom() {
      if (this.typingIndex < this.customAnswer.length) {
        this.messages[this.messages.length - 1].content += this.customAnswer[this.typingIndex];
        this.typingIndex++;
        this.$nextTick(() => this.scrollToBottom());
        setTimeout(() => this.typeNextCharCustom(), 30);
      } else {
        this.isTyping = false;
        if (this.currentReply) {
             
             setTimeout(() => this.textToSpeech(this.currentReply), 300);
        }
      }
    },
    async textToSpeech(text) {
        let ttsText = text.substring(0, 100); 
        const timestamp = Math.floor(Date.now() / 1000);
        const date = new Date(timestamp * 1000).toISOString().split('T')[0];
        
        const selectedLang = this.languages.find(l => l.label === this.currentLanguage) || this.languages[0];
        
        const params = {
            text: ttsText,
            vcn: selectedLang.vcn || 'xiaoyan',
            speed: 50, 
            volume: 50, 
            pitch: 50  
        };
        
        try {
            console.log('Sending TTS request to Cloud Function...');
            
            
            const cloudRes = await uniCloud.callFunction({
                name: 'ai-agent',
                data: {
                    action: 'tts',
                    data: {
                        params: params,
                        timestamp: timestamp,
                        date: date
                    }
                }
            });
            
            if (cloudRes.result && cloudRes.result.code === 200 && cloudRes.result.audio) {
                console.log('TTS audio received from cloud');
                this.playAudio(cloudRes.result.audio);
            } else {
                console.error('Failed to get audio from cloud:', cloudRes);
            }
        } catch (e) {
            console.error('Cloud function error:', e);
        }
    },
    playAudio(base64) {
        console.log('playAudio called');
        const ctx = uni.createInnerAudioContext();
        this.audioContexts.push(ctx);
        ctx.src = `data:audio/mp3;base64,${base64}`;
        
        console.log('Setting isSpeaking to true');
        this.isSpeaking = true;
        
        ctx.onPlay(() => {
            console.log('Audio started playing');
            this.isSpeaking = true;
        });
        
        ctx.onEnded(() => {
            console.log('Audio ended');
            this.isSpeaking = false;
        });
        ctx.onError((res) => {
            console.error('Audio Error:', res);
            this.isSpeaking = false;
        });
        
        ctx.autoplay = true;
        ctx.play(); 
    },
    cleanupAudioContexts() {
        this.audioContexts.forEach(c => { try{c.stop(); c.destroy();}catch(e){} });
        this.audioContexts = [];
        this.isSpeaking = false;
    },
    scrollToBottom() {
        this.$nextTick(() => {
           this.scrollTop += 9999;
        });
    }
  }
}
</script>


<style scoped>
.congmei-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.congmei-mask.visible {
  opacity: 1;
  pointer-events: auto;
}


.popup-content {
  width: 100%;
  height: 85vh;
  
  background: linear-gradient(180deg, #FFF0E6 0%, #FFFAF0 100%);
  border-top-left-radius: 40rpx;
  border-top-right-radius: 40rpx;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  box-shadow: 0 -10rpx 40rpx rgba(0,0,0,0.05);
  overflow: hidden;
  position: relative; 
  font-family: "Songti SC", "SimSun", "STSong", serif; 
}

.slide-up {
  transform: translateY(0);
}


.deco {
  position: absolute;
  pointer-events: none;
  z-index: 0;
  opacity: 0.6;
  filter: blur(2px);
}

.deco-flower {
  top: -20rpx;
  right: -20rpx;
  width: 150rpx;
  height: 150rpx;
  background: radial-gradient(circle at 30% 30%, #FFCCBC, #FFAB91);
  border-radius: 50% 40% 60% 50%;
  transform: rotate(15deg);
}

.deco-leaf {
  top: 100rpx;
  right: -10rpx;
  width: 80rpx;
  height: 120rpx;
  background: linear-gradient(135deg, #C8E6C9 0%, #A5D6A7 100%);
  border-radius: 0 80% 0 80%;
  transform: rotate(-15deg);
}

.deco-wheat {
  bottom: 120rpx;
  left: -20rpx;
  width: 100rpx;
  height: 180rpx;
  background: radial-gradient(ellipse at center, #FFE082 0%, #FFD54F 100%);
  border-radius: 40% 40% 60% 60%;
  transform: rotate(20deg);
  opacity: 0.4;
}

.deco-cloud {
  top: 40rpx;
  left: -30rpx;
  width: 120rpx;
  height: 80rpx;
  background: #E3F2FD;
  border-radius: 40% 40% 40% 40%;
  opacity: 0.5;
  filter: blur(4px);
}

.deco-sparkle-1 {
  top: 200rpx;
  right: 40rpx;
  width: 20rpx;
  height: 20rpx;
  background: #FFF9C4;
  border-radius: 50%;
  opacity: 0.8;
  box-shadow: 0 0 10rpx #FFF9C4;
}

.deco-sparkle-2 {
  bottom: 300rpx;
  left: 30rpx;
  width: 15rpx;
  height: 15rpx;
  background: #FFCCBC;
  border-radius: 50%;
  opacity: 0.6;
}

.popup-header {
  position: relative;
  padding: 60rpx 40rpx 20rpx;
  
  background: linear-gradient(180deg, #FFE4C4 0%, #FFF0E6 100%);
  z-index: 10;
  overflow: visible; 
}

.header-top-row {
  display: flex;
  align-items: flex-end;
  position: relative;
  margin-bottom: 20rpx;
}

.avatar-wrapper {
  position: relative;
  z-index: 5;
  margin-right: 20rpx;
  margin-bottom: -10rpx;
}

.main-avatar {
  width: 200rpx; 
  height: 200rpx;
  background: transparent;
  border: none;
  box-shadow: none;
  margin-top: -80rpx;
  object-fit: contain;
}

.greeting-bubble {
  flex: 1;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 24rpx;
  position: relative;
  box-shadow: 0 4rpx 12rpx rgba(139, 69, 19, 0.08); 
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 2rpx solid #FFF5E6;
}

.bubble-content-row {
  margin-bottom: 16rpx;
}

.bubble-arrow {
  position: absolute;
  left: -14rpx;
  top: 40rpx;
  width: 0;
  height: 0;
  border-top: 14rpx solid transparent;
  border-bottom: 14rpx solid transparent;
  border-right: 14rpx solid #FFF;
}

.greeting-text {
  font-size: 34rpx;
  font-weight: 600;
  color: #5D4037; 
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.control-btn {
  background: #FFF8E1; 
  border: 1rpx solid #FFE082; 
  border-radius: 16rpx;
  padding: 8rpx 24rpx;
  font-size: 24rpx;
  color: #8D6E63; 
  display: flex;
  align-items: center;
  position: relative;
}

.lang-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 10rpx;
  background: #FFF;
  border-radius: 16rpx;
  box-shadow: 0 6rpx 16rpx rgba(139, 69, 19, 0.1);
  padding: 12rpx 0;
  min-width: 140rpx;
  z-index: 100;
  text-align: left;
  border: 1rpx solid #FFF0E6;
}

.lang-item {
  padding: 16rpx 24rpx;
  font-size: 26rpx;
  color: #5D4037;
}

.close-btn {
  position: absolute;
  top: 30rpx;
  right: 30rpx;
  padding: 10rpx;
  font-size: 44rpx;
  color: #A1887F;
  z-index: 20;
}

.chat-scroll-area {
  flex: 1;
  height: 0; 
  width: 100%;
  background: transparent;
  padding: 20rpx 30rpx 220rpx 30rpx; 
  box-sizing: border-box;
  position: relative;
  z-index: 2; 
}

.welcome-section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 40rpx;
}

.suggest-card {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 24rpx;
  padding: 30rpx;
  color: #5D4037;
  font-size: 30rpx;
  font-weight: 500;
  box-shadow: 0 4rpx 10rpx rgba(139, 69, 19, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 2rpx solid #FFECB3; 
}

.hot-icon {
  font-size: 28rpx;
}

.message-list {
  display: flex;
  flex-direction: column;
  padding-bottom: 20rpx;
}

.message-item {
  margin-bottom: 30rpx;
  display: flex;
  align-items: flex-end;
}

.friend-layout {
  justify-content: flex-start;
}
.user-layout {
  justify-content: flex-end;
}

.friend-msg-bubble {
  background: #FFFFFF;
  color: #5D4037;
  padding: 24rpx 32rpx;
  border-radius: 4rpx 30rpx 30rpx 30rpx;
  max-width: 80%;
  font-size: 30rpx;
  line-height: 1.6;
  box-shadow: 0 2rpx 8rpx rgba(139, 69, 19, 0.05);
  border: 1rpx solid #FFF5E6;
}

.user-msg-bubble {
  background: #FFCCBC; 
  color: #5D4037;
  padding: 24rpx 32rpx;
  border-radius: 30rpx 30rpx 4rpx 30rpx;
  max-width: 80%;
  font-size: 30rpx;
  margin-right: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(139, 69, 19, 0.1);
}

.large-text {
  font-size: 36rpx;
}

.msg-avatar {
  width: 70rpx;
  height: 70rpx;
  border-radius: 50%;
  background: #eee;
}

.popup-footer {
  background: #FFF;
  padding: 20rpx 30rpx 60rpx 30rpx; 
  border-top: 1rpx solid #F0F0F0;
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 20;
  box-sizing: border-box;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border: 3rpx solid #FFCCBC; 
  border-radius: 60rpx;
  padding: 10rpx 20rpx; 
  height: 90rpx;
  box-shadow: 0 4rpx 12rpx rgba(139, 69, 19, 0.06);
}

.chat-input {
  flex: 1;
  height: 100%;
  font-size: 30rpx;
  color: #5D4037;
  padding-left: 10rpx;
}

.send-btn {
  background: linear-gradient(135deg, #FFAB91 0%, #FF8A65 100%);
  color: #FFF;
  font-size: 26rpx;
  font-weight: 600;
  padding: 10rpx 30rpx;
  border-radius: 40rpx;
  margin-left: 10rpx;
  box-shadow: 0 2rpx 8rpx rgba(255, 138, 101, 0.3);
}


.simple-page-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding-bottom: 100rpx;
  color: #8D6E63;
}

.simple-icon {
  width: 150rpx;
  height: 150rpx;
  margin-bottom: 40rpx;
  opacity: 0.8;
}

.simple-title {
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
  color: #5D4037;
}

.simple-desc {
  font-size: 28rpx;
  color: #A1887F;
  text-align: center;
  line-height: 1.6;
  max-width: 80%;
}
</style>

<template>
  <view class="game-root">
    
    <view class="back-btn" @click="goBack">
        <view class="back-icon"></view>
    </view>

    
    <view class="nav-spacer"></view>

    <view class="top" v-if="slug === 'shaqima'">
       
      <Checklist :steps="currentChecklist" />
    </view>
    
    
    <view v-else class="dev-placeholder">
        <image src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/logo.png" mode="widthFix" class="dev-icon"></image>
        <text class="dev-text">该美食制作正在开发中~</text>
        <button class="btn-yellow-s" @click="goBack" style="margin-top:20px;">返回</button>
    </view>

    <view class="stage-area" v-if="slug === 'shaqima'">
      <view v-if="stage===0" class="stage prep">
        <view class="stage-header">准备：混合鸡蛋与面粉</view>
        <view class="mobile-hint" v-if="isTouch">点击食材以添加</view>
        <view class="stage-content">
          <view 
            class="mix-bowl drop-zone" 
            data-target="bowl"
            :class="{'has-mix': bowlCount>0}"
          >
            <view class="bowl-content">
              <view class="bowl-item">
                  <image :src="itemImages.egg" class="bowl-img" mode="aspectFit"/> 
                  <text>{{ bowlEggs }}/{{ REQUIRED_EGGS }}</text>
              </view>
              <view class="bowl-item">
                  <image :src="itemImages.flour" class="bowl-img" mode="aspectFit"/> 
                  <text>{{ bowlFlour }}/{{ REQUIRED_FLOUR }}</text>
              </view>
            </view>
          </view>
          <view class="props-row">
            <view 
              class="prop prop-egg" 
              @click="handleTap('egg')"
            >
              <image :src="itemImages.egg" class="prop-img" mode="aspectFit" />
              <view class="prop-label">鸡蛋</view>
            </view>
            <view 
              class="prop prop-flour" 
              @click="handleTap('flour')"
            >
              <image :src="itemImages.flour" class="prop-img" mode="aspectFit" />
              <view class="prop-label">面粉</view>
            </view>
          </view>
        </view>
        <view class="controls">
          <button @click="startRest" :disabled="bowlEggs < 2 || bowlFlour < 2 || resting || rested">静置（模拟30分钟）</button>
        </view>
        <view class="rest-status" v-if="resting || rested">
          <view v-if="resting">静置中... {{ restProgress }}%</view>
          <view v-else>静置完成！准备炸制。</view>
          <view class="rest-bar">
            <view class="rest-fill" :style="{width: restProgress + '%'}"></view>
          </view>
        </view>
        <view class="controls" v-if="rested">
          <button @click="stage = 1">前往炸制 →</button>
        </view>
      </view>

      <view v-if="stage===1" class="stage frying">
        <view class="stage-header">炸制：将油加热到115-125°C并炸面条</view>
        <view class="stage-content">
          <view class="wok-container">
            <view 
                class="wok drop-zone" 
                :class="{'ready': temp>=115 && temp<=125}"
                data-target="wok"
            >
                <view class="oil-layer" :style="{ opacity: 0.6 + (temp/300) }"></view>
                
                <view class="bubbles-layer" v-if="temp > 80">
                <view class="bubble b1"></view>
                <view class="bubble b2"></view>
                <view class="bubble b3"></view>
                <view class="bubble b4"></view>
                </view>

                <view class="noodles-container" v-if="noodlesFried">
                <image 
                    :src="itemImages.noodles" 
                    class="frying-noodle"
                    :class="{ 'cooked': noodlesFried }"
                    mode="widthFix"
                />
                <view class="fried-text">✨ 炸至金黄!</view>
                </view>

                <view class="temp-display">{{ Math.round(temp) }}°C</view>
                <view v-if="temp<115" class="temp-hint">太冷</view>
                <view v-else-if="temp>125" class="temp-hint">太热！</view>
                <view v-else class="temp-hint ready-text">完美！🎯</view>
            </view>
  
            <ProgressBar :value="temp" :max="150" :height="20" label="油温" />
            
            <view class="fire-controls">
                <button class="fire" 
                @touchstart.prevent="startHeat" 
                @touchend="stopHeat"
                @mousedown="startHeat"
                @mouseup="stopHeat"
                @mouseleave="stopHeat"
                >
                🔥 长按加热
                </button>
            </view>
            </view>

            <view class="ingredients">
            <view 
                class="prop prop-noodles" 
                @click="handleTap('noodles')"
            >
                <image :src="itemImages.noodles" class="prop-img" mode="aspectFit" />
                <text class="prop-label">生面条</text>
            </view>
            </view>
          
        </view>
        <view class="controls">
          <button v-if="noodlesFried" @click="stage=2">下一步：糖浆 →</button>
        </view>
      </view>

      <view v-if="stage===2" class="stage syrup">
        <view class="stage-header">糖浆：煮至117°C</view>
        <view class="stage-content">
          
          <view 
            class="pot brown-tray drop-zone" 
            data-target="pot"
          >
            <view class="boil-bubbles" v-if="boiling">
              <view class="bubble big"></view>
              <view class="bubble small"></view>
              <view class="bubble medium"></view>
            </view>

            <view class="pot-contents">
              <view v-if="potContents.length === 0" class="pot-empty text-light">将食材拖放到此处</view>
              <view v-else class="pot-grid">
                <image 
                  v-for="(item, idx) in potContents" 
                  :key="idx" 
                  :src="itemImages[item]" 
                  class="pot-item"
                  :class="{ 'floating': !boiling, 'shaking': boiling }" 
                  mode="aspectFit"
                />
              </view>
            </view>
          </view>

          <ProgressBar :value="potTemp" :max="130" :height="20" label="锅温" />
          
          <view class="temp-status">
            <view v-if="boiling">加热中... {{ Math.round(potTemp) }}°C</view>
            <view v-else-if="syrupReady" class="success-text">✅ 糖浆完成！</view>
            <view v-else-if="potTemp > 20 && !syrupReady && !boiling" class="fail-text">❌ 失败</view>
            <view v-else>准备就绪</view>
          </view>


          <view class="syrup-controls">
            <view class="ingredients-grid">
              <view class="prop item-card" @click="handleTap('sugar')">
                <image :src="itemImages.sugar" class="prop-img" mode="aspectFit"/><text class="prop-label">糖</text>
              </view>
              <view class="prop item-card" @click="handleTap('malt')">
                <image :src="itemImages.malt" class="prop-img" mode="aspectFit"/><text class="prop-label">麦芽</text>
              </view>
              <view class="prop item-card" @click="handleTap('honey')">
                <image :src="itemImages.honey" class="prop-img" mode="aspectFit"/><text class="prop-label">蜂蜜</text>
              </view>
              <view class="prop item-card" @click="handleTap('osmanthus')">
                <image :src="itemImages.osmanthus" class="prop-img" mode="aspectFit"/><text class="prop-label">桂花</text>
              </view>
            </view>
            
            <view class="actions-row">
              <button class="btn-start" @click="startBoil" :disabled="boiling || potContents.length < 4 || syrupReady">开始煮沸</button>
              <button class="btn-stop" @click="stopBoil" :disabled="!boiling">🔴 熄火</button>
            </view>

            <button class="btn-reset" @click="resetStage2" v-if="!boiling && (potTemp > 20 || potContents.length > 0) && !syrupReady">🔄 重置</button>
            
          </view>

          <view class="controls">
            <button v-if="syrupReady" @click="stage=3">下一步：混合与成型 →</button>
          </view>
        </view>
      </view>

      <view v-if="stage===3" class="stage mixing">
        <view class="stage-header">混合与成型</view>
        <view class="stage-content">
          <view 
            class="mix-bowl large drop-zone" 
            data-target="mixture"
          >
            <view class="mix-count">混合物： <text class="count">{{ mixtureCount }}</text> 个</view>
          </view>
          
          
          <view class="props-row centered">
            <view 
              class="prop item-card" 
              @click="handleTap('seaurchin')"
            >
              <image :src="itemImages.seaurchin" class="prop-img" mode="aspectFit" />
              <view class="prop-label">海胆</view>
            </view>
            <view 
              class="prop item-card" 
              @click="handleTap('seaweed')"
            >
              <image :src="itemImages.seaweed" class="prop-img" mode="aspectFit" />
              <view class="prop-label">海苔</view>
            </view>
            <view 
              class="prop item-card" 
              v-if="syrupReady"
              @click="handleTap('syrup')"
            >
              <image :src="itemImages.syrup" class="prop-img" mode="aspectFit" />
              <view class="prop-label">糖浆</view>
            </view>
          </view>

          
          <view class="mix-action-row">
            <button class="btn-yellow-s" @click="shakeMix" :disabled="mixtureCount < 3">
                <image :src="itemImages.spoon" class="btn-icon-s" mode="aspectFit" /> 摇匀
            </button>
            <button class="btn-light-s" 
                @touchstart.prevent="startPress"
                @touchend="stopPress"
                @mousedown="startPress"
                @mouseup="stopPress"
                @mouseleave="stopPress"
                :disabled="mixtureCount < 4"
            >
                <image :src="itemImages.press" class="btn-icon-s" mode="aspectFit" /> 按压（长按）
            </button>
          </view>

        </view>
       
        <view class="controls">
          <button v-if="pressed" @click="stage=4">下一步：切割与上桌 →</button>
        </view>
      </view>

      <view v-if="stage===4" class="stage cutting">
        <view class="stage-header">切割与上桌</view>
        <view class="stage-content">
          <view class="final-board brown-tray-large">
            <view class="cutting-grid" :class="{'cut-done': cutDone}">
                
                <image 
                   v-if="isCutting" 
                   :src="itemImages.knife" 
                   class="anime-knife" 
                   mode="widthFix"
                />

                <view 
                  v-for="n in 9" :key="n" 
                  class="sachima-block"
                  :class="{'separated': cutDone}"
                  :style="{'--i': n}"
                >
                  <image :src="itemImages.block" mode="aspectFill" class="block-img"/>
                </view>
                
            </view>
          </view>
        
            <view class="mix-action-row">
            <button class="btn-yellow-s" @click="cutGrid" :disabled="cutDone">
                <image :src="itemImages.knife" class="btn-icon-s" mode="aspectFit" /> 点击刀具切割
            </button>
            <button class="btn-yellow-s" @click="garnish" :disabled="!cutDone || garnished">
                ✨ 撒上海苔
            </button>
            </view>

            <view v-if="finished" class="final-card">
            <view class="final-title">🎉 海胆海苔沙琪玛</view>
            <view class="final-desc">制作完成！你的成品已准备好了。</view>
            <view class="center-btn-wrap">
                <button @click="handleComplete" class="btn-yellow-s btn-wide" :disabled="isSubmitting">
                    <text v-if="!isSubmitting">🔄 制作完成</text>
                    <text v-else>提交中...</text>
                </button>
            </view>
            </view>
        </view>
      </view>
    </view>

    <view class="bottom">
      <view class="status">Step {{ stage + 1 }} of 5</view>
    </view>
  </view>
</template>

<script>
import { businessApi } from '@/utils/auth.js'
import { checkAuth } from '@/utils/router-guard.js'



import ProgressBar from '@/components/ProgressBar.vue'
import Checklist from '@/components/Checklist.vue'
import { onLoad } from '@dcloudio/uni-app'

export default {
    components: {
        ProgressBar,
        Checklist
    },
    data() {
        return {
            slug: '',
            userInfo: null, 
            stage: 0,
            isTouch: true, 
            
            
            itemImages: {
              egg: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/egg.png',
              flour: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/flour.png',
              noodles: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/noodles.png',
              noodles_fried: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/noodles_fried.png', 
              sugar: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/sugar.png',
              malt: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/malt.png',
              honey: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/honey.png',
              osmanthus: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/osmanthus.png', 
              seaurchin: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/seaurchin.png',
              seaweed: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/seaweed.png',
              syrup: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/malt.png', 
              knife: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/knife.png', 
              block: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/syrup.png', 
              spoon: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/spoon.svg',
              press: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/cook/press.svg'
            },
            
            
            bowlCount: 0,
            bowlEggs: 0,
            bowlFlour: 0,
            REQUIRED_EGGS: 2,
            REQUIRED_FLOUR: 2,
            
            
            rested: false,
            resting: false,
            restProgress: 0,
            
            
            temp: 20,
            heatInterval: null,
            coolInterval: null,
            noodlesFried: false,
            
            
            potContents: [],
            potTemp: 20,
            boilInterval: null,
            boiling: false,
            syrupReady: false,
            
            
            mixtureCount: 0,
            addedItems: [],
            pressed: false,
            pressTimer: null,
            
            
            cutDone: false,
            garnished: false,
            finished: false,
            isSubmitting: false,
            isCutting: false
        }
    },
    onLoad(options) {
      // 路由守卫：未登录访问受保护页面时跳登录
      if (!checkAuth({ route: 'pages/choosedaka/cook/cook' })) return

        if (options && options.slug) {
            this.slug = options.slug
            console.log('Cooking Game Slug:', this.slug)
        }
        
        try {
            const storedUser = uni.getStorageSync('app_user_info')
            if(storedUser) {
                this.userInfo = storedUser
            }
        } catch(e) { console.error(e) }
    },
    computed: {
        currentChecklist() {
          if(this.stage===0) return [
            {text:`加入 ${this.bowlEggs}/${this.REQUIRED_EGGS} 鸡蛋`, done: this.bowlEggs>=this.REQUIRED_EGGS},
            {text:`加入 ${this.bowlFlour}/${this.REQUIRED_FLOUR} 面粉`, done: this.bowlFlour>=this.REQUIRED_FLOUR},
            {text:'静置面团', done: this.rested}
          ]
          if(this.stage===1) return [
             {text:'油温加热至150-180℃', done: this.temp>=150 && this.temp<=180},
             {text:'放入面条炸制定型', done: this.noodlesFried}
          ]
          if(this.stage===2) return [
             {text:'加入糖、麦芽糖、蜂蜜', done: this.potContents.length>=3},
             {text:'慢火熬制至117℃', done: this.syrupReady}
          ]
          if(this.stage===3) return [
            {text:'加入海胆和海藻', done: this.mixtureCount>=2},
            {text:'倒入糖浆并混合', done: this.mixtureCount>=3},
            {text:'压入模具', done: this.pressed}
          ]
          if(this.stage===4) return [
              {text:'切块', done: this.cutDone},
              {text:'用海藻装饰', done: this.garnished}
          ]
          return []
        }
    },


    methods: {
        goBack() {
            uni.navigateBack()
        },
        handleTap(item) {
          if (this.stage === 0 && item === 'egg') {
            if (this.bowlEggs < this.REQUIRED_EGGS) {
              this.bowlEggs += 1
              this.bowlCount += 1
            }
          } else if (this.stage === 0 && item === 'flour') {
            if (this.bowlFlour < this.REQUIRED_FLOUR) {
              this.bowlFlour += 1
              this.bowlCount += 1
            }
          } else if (this.stage === 1 && item === 'noodles') {
            this.dropNoodles()
          } else if (this.stage === 2 && ['sugar','malt','honey','osmanthus'].includes(item)) {
            this.addToPot(item)
          } else if (this.stage === 3 && ['seaurchin','seaweed','syrup'].includes(item)) {
            this.addMixture(item)
          }
        },
        startRest(){
          if (this.resting || this.rested) return
          if (this.bowlEggs < this.REQUIRED_EGGS || this.bowlFlour < this.REQUIRED_FLOUR) return
          this.resting = true
          this.restProgress = 0
          
          setTimeout(() => {
            this.restProgress = 100
            this.resting = false
            this.rested = true
          }, 800)
        },
        startHeat(){
          if(this.heatInterval) return
          this.heatInterval = setInterval(()=>{ 
            this.temp = Math.min(150, this.temp + 2)
          }, 150)
        },
        stopHeat(){ 
          clearInterval(this.heatInterval)
          this.heatInterval = null
          if(!this.coolInterval) {
            this.coolInterval = setInterval(()=>{
              if(this.temp > 20) {
                this.temp = Math.max(20, this.temp - 0.5)
              }
            }, 300)
          }
        },
        coolDown(){
          this.temp = Math.max(20, this.temp - 10)
        },
        dropNoodles(){
          if(this.temp >=115 && this.temp<=125){
            this.noodlesFried = true
            clearInterval(this.coolInterval)
            this.coolInterval = null
          }
        },
        addToPot(item){ 
          if(!this.potContents.includes(item)) {
            this.potContents.push(item)
          }
        },
        startBoil(){ 
          if(this.boiling || this.potContents.length < 4) return
          this.boiling = true
          this.boilInterval = setInterval(()=>{ 
            this.potTemp = Math.min(130, this.potTemp + 1.5)
          }, 200)
        },
        stopBoil(){ 
          if(!this.boiling) return
          clearInterval(this.boilInterval)
          this.boilInterval=null
          this.boiling = false
          if(Math.abs(this.potTemp - 117) <= 3) { 
            this.syrupReady = true
          } else { 
            this.syrupReady = false
          }
        },
        resetStage2() {
            this.potContents = []
            this.potTemp = 20
            this.boiling = false
            this.syrupReady = false
            clearInterval(this.boilInterval)
            this.boilInterval = null
        },
        addMixture(item){ 
          if(item === 'syrup' && !this.syrupReady) return
          if(!this.addedItems.includes(item)) {
            this.addedItems.push(item)
            this.mixtureCount += 1
          }
        },
        shakeMix(){ 
          if(this.mixtureCount >= 3) {
            this.mixtureCount += 1
          }
        },
        startPress(){ 
          if(this.pressTimer || this.mixtureCount < 4) return
          this.pressTimer = setTimeout(()=>{ 
            this.pressed = true
          }, 1000)
        },
        stopPress(){ 
          clearTimeout(this.pressTimer)
          this.pressTimer = null
        },
        cutGrid(){ 
          if (this.cutDone || this.isCutting) return
          this.isCutting = true
          setTimeout(()=>{
            this.cutDone = true
            this.isCutting = false
          }, 500)
        },
        garnish(){ 
          this.garnished = true
          this.finished = true
        },

        resetGame() {
          this.stage = 0
          this.bowlCount = 0
          this.bowlEggs = 0
          this.bowlFlour = 0
          this.rested = false
          this.resting = false
          this.restProgress = 0
          this.temp = 20
          this.noodlesFried = false
          this.potContents = []
          this.potTemp = 20
          this.boiling = false
          this.syrupReady = false
          this.mixtureCount = 0
          this.addedItems = []
          this.pressed = false
          this.cutDone = false
          this.garnished = false
          this.finished = false
          this.isSubmitting = false
          clearInterval(this.heatInterval)
          clearInterval(this.coolInterval)
          clearInterval(this.boilInterval)
          this.heatInterval = null
          this.coolInterval = null
          this.boilInterval = null
        },
        async handleComplete() {
            if (this.isSubmitting) return
            this.isSubmitting = true
            
            
            let openid = this.userInfo ? this.userInfo._id : ''
            if (!openid) {
                try {
                    const s = uni.getStorageSync('app_user_info')
                    if(s) openid = s._id
                } catch(e){}
            }

            try {
                const result = await businessApi.gameCheckIn({
                        gameId: 'cook-shaqima',
                        score: 25,
                        openid: openid
                    })
                
                if (result.code === 200) {
                    const msg = result.data.pointsAdded > 0 
                        ? `🎉 完成！获得 ${result.data.pointsAdded} 积分`
                        : '🎉 完成！(今日已领过积分)'
                    
                    uni.showToast({
                        title: msg,
                        icon: 'none',
                        duration: 3000
                    })
                    
                    
                    setTimeout(() => {
                        
                        
                        
                        uni.showModal({
                           title: '制作完成',
                           content: msg + '\n是否再玩一次？',
                           confirmText: '再玩一次',
                           cancelText: '返回',
                           success: (res) => {
                               if (res.confirm) {
                                   this.resetGame()
                               } else {
                                   uni.navigateBack()
                               }
                           }
                        })
                    }, 1000)
                    
                } else {
                    uni.showToast({ title: result.message || 'Error', icon: 'none' })
                }
            } catch (e) {
                console.error(e)
                uni.showToast({ title: '网络错误', icon: 'none' })
            } finally {
                this.isSubmitting = false
            }
        }
    }
}
</script>

<style lang="scss" scoped>



.dev-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 70vh;
    padding: 20px;
}
.dev-icon {
    width: 120px;
    height: 120px;
    margin-bottom: 20px;
    opacity: 0.8;
}
.dev-text {
    font-size: 18px;
    color: #8d6e63;
    font-weight: bold;
    text-align: center;
}




.brown-tray-large {
    width: 260px;
    height: 260px; 
    background-color: #8d6e63;
    border: 6px solid #5d4037;
    border-radius: 20px;
    box-shadow: inset 0 2px 10px rgba(0,0,0,0.3), 0 5px 15px rgba(0,0,0,0.2);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
}

.final-card {
    margin-top: 20px;
    text-align: center;
    background: #fff;
    padding: 20px;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(139, 69, 19, 0.1);
    border: 2px solid #ecd8a4;
    width: 100%;
    box-sizing: border-box;
}

.final-title {
    font-size: 18px;
    font-weight: bold;
    color: #5d4037;
    margin-bottom: 8px;
}
.final-desc {
    font-size: 14px;
    color: #8d6e63;
    margin-bottom: 20px;
}


.btn-wide {
    width: 80%;
    margin: 0 auto;
}

.center-btn-wrap {
    display: flex;
    justify-content: center;
    width: 100%;
}

.game-root {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 16px;
  background: #fff8e1; 
  font-family: 'PingFang SC', 'Helvetica Neue', Helvetica, sans-serif;
  color: #5d4037;
  z-index: 1;
}


.game-root::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(45deg, #ffe0b2 25%, transparent 25%, transparent 75%, #ffe0b2 75%, #ffe0b2),
    linear-gradient(45deg, #ffe0b2 25%, transparent 25%, transparent 75%, #ffe0b2 75%, #ffe0b2);
  background-position: 0 0, 20px 20px;
  background-size: 40px 40px;
  opacity: 0.3;
  pointer-events: none;
  z-index: -1;
}

.nav-spacer {
    height: 120rpx;
    width: 100%;
}


.back-btn {
    position: fixed;
    top: 40px;
    left: 20px;
    width: 40px;
    height: 40px;
    background-color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    border: 2px solid #ecd8a4;
}

.back-icon {
    width: 20px;
    height: 20px;
    background-image: url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%238d6e63' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='19' y1='12' x2='5' y2='12'%3E%3C/line%3E%3Cpolyline points='12 19 5 12 12 5'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
}

.top {
    position: relative;
    z-index: 2;
    margin-bottom: 20px;
}


.stage-area {
  background: #fff;
  padding: 24px;
  border-radius: 20px;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.08);
  border: 2px solid #ecd8a4;
  position: relative;
  z-index: 1;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.stage-header {
  color: #5d4037;
  margin-bottom: 24px;
  text-align: center;
  font-size: 18px;
  font-weight: bold;
}

.stage-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    width: 100%;
}


.wok-container {
    position: relative;
    width: 260px;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 10px;
}

.wok {
    width: 240px;
    height: 240px;
    background: #333; 
    border-radius: 50%;
    position: relative;
    border: 8px solid #444;
    box-shadow: inset 0 10px 20px rgba(0,0,0,0.5), 0 10px 20px rgba(0,0,0,0.2);
    overflow: hidden;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.oil-layer {
    position: absolute;
    inset: 10px;
    background: #fbc02d; 
    border-radius: 50%;
    opacity: 0.9;
    box-shadow: inset 0 5px 15px rgba(0,0,0,0.1);
    transition: all 0.5s ease;
}


.bubble {
    position: absolute;
    background: rgba(255,255,255,0.6);
    border-radius: 50%;
    animation: bubbleRise 2s infinite;
}
.b1 { width:10px; height:10px; left:30%; top:60%; animation-delay:0s; }
.b2 { width:15px; height:15px; left:50%; top:70%; animation-delay:0.5s; }
.b3 { width:8px; height:8px; left:70%; top:50%; animation-delay:1s; }
.b4 { width:12px; height:12px; left:40%; top:65%; animation-delay:1.5s; }
@keyframes bubbleRise {
    0% { transform: translateY(0) scale(1); opacity:0.8; }
    100% { transform: translateY(-40px) scale(1.2); opacity:0; }
}


.noodles-container {
    position: absolute;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.frying-noodle {
    width: 100px;
    height: auto;
    filter: drop-shadow(0 4px 4px rgba(0,0,0,0.2));
    transition: filter 2s ease;
}
.frying-noodle.cooked {
    filter: brightness(0.9) sepia(0.3) saturate(2) drop-shadow(0 4px 4px rgba(0,0,0,0.2));
}
.fried-text {
    background: #fff;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
    color: #f57f17;
    margin-top: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}


.temp-display {
    position: absolute;
    top: 20px;
    right: 20px;
    color: #fff;
    font-weight: bold;
    background: rgba(0,0,0,0.5);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
}

.temp-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(255,255,255,0.8);
    font-size: 18px;
    pointer-events: none;
    z-index: 5;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}


button {
    background: linear-gradient(to bottom, #ffca28, #ffb300);
    border: none;
    color: #5d4037;
    padding: 12px 24px;
    border-radius: 25px;
    font-weight: bold;
    font-size: 15px;
    box-shadow: 0 4px 0 #f57f17, 0 6px 6px rgba(0,0,0,0.1);
    transition: all 0.1s;
    width: 80%;
    margin: 10px auto;
    display: block;
}
button:active {
    transform: translateY(4px);
    box-shadow: 0 0 0 #f57f17, inset 0 2px 4px rgba(0,0,0,0.2);
}
button:disabled {
    background: #e0e0e0;
    color: #9e9e9e;
    box-shadow: none;
    transform: none;
}
.fire-controls {
    width: 100%;
}
.fire {
    background: linear-gradient(to bottom, #ff7043, #f4511e);
    color: #fff;
    box-shadow: 0 4px 0 #d84315, 0 6px 6px rgba(0,0,0,0.1);
}
.fire:active {
    box-shadow: 0 0 0 #d84315, inset 0 2px 4px rgba(0,0,0,0.2);
}


.ingredients {
    width: 100%;
    display: flex;
    justify-content: center;
}
.prop {
    background: #fff8e1;
    border: 2px solid #ecd8a4;
    border-radius: 12px;
    padding: 12px;
    width: 100px;
    height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 8px rgba(0,0,0,0.05);
    transition: transform 0.2s;
}
.prop:active {
    transform: scale(0.95);
    background: #ffecb3;
}
.prop-label {
    margin-top: 8px;
    font-size: 13px;
    color: #795548;
    font-weight: 600;
}
.prop-img {
    width: 50px;
    height: 50px;
    
    width: 50px !important;
    height: 50px !important;
}

.btn-icon {
    width: 20px;
    height: 20px;
    margin-right: 5px;
}




.status {
    text-align: center;
    color: #8d6e63;
    font-size: 12px;
    margin-top: 10px;
}


.mix-bowl {
    width: 280px;
    height: 140px;
    background: #fffde7; 
    border: 3px solid #dac08e;
    border-radius: 50%; 
    position: relative;
    overflow: hidden;
    margin-bottom: 20px;
    box-shadow: inset 0 5px 15px rgba(0,0,0,0.05), 0 8px 20px rgba(139, 69, 19, 0.1);
    display: flex;
    align-items: center; 
    justify-content: center;
}
.mix-bowl.has-mix {
    background: #fff9c4;
}
.bowl-content {
    display: flex;
    justify-content: center;
    align-items: center; 
    height: 100%;
    padding-bottom: 10px;
    gap: 30px;
}
.bowl-img {
    width: 40px !important;
    height: 40px !important;
}

.props-row {
    display: flex;
    gap: 20px;
}


.final-board {
    background: #e6c288;
    padding: 20px;
    border-radius: 20px;
    box-shadow: 
        inset 0 0 0 4px rgba(139, 69, 19, 0.2),
        0 8px 16px rgba(0,0,0,0.2);
    border: 4px solid #a1887f;
    position: relative;
}
.final-board::after {
    
    content: '';
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 8px;
    background: rgba(0,0,0,0.1);
    border-radius: 4px;
}
.cutting-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    width: 180px;
    height: 180px;
    background: #ffecb3;
}
.sachima-block {
    background: #ffca28;
    display: flex;
    align-items: center;
    justify-content: center;
}
.block-img {
    width: 100%;
    height: 100%;
}


.mobile-hint {
    text-align: center;
    color: #f57f17;
    font-size: 12px;
    margin-bottom: 10px;
    animation: bounce 2s infinite;
}
@keyframes bounce {
    0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
    40% {transform: translateY(-5px);}
    60% {transform: translateY(-3px);}
}

@keyframes cut-motion {
    0% { transform: translate(0, -20px) rotate(0deg); }
    50% { transform: translate(-10px, 10px) rotate(-15deg); }
    100% { transform: translate(0, -20px) rotate(0deg); }
}
.anime-knife {
    position: absolute;
    top: -20px;
    right: 20px;
    width: 120px;
    z-index: 99;
    pointer-events: none;
    transform-origin: bottom right;
    animation: cut-motion 0.4s ease-in-out infinite;
}


.brown-tray {
    width: 260px;
    height: 160px;
    background-color: #8d6e63;
    border: 6px solid #5d4037;
    border-radius: 24px;
    box-shadow: inset 0 2px 10px rgba(0,0,0,0.3), 0 5px 15px rgba(0,0,0,0.2);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
}
.text-light {
    color: #d7ccc8;
}

.pot-grid {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: center;
}
.pot-item {
    width: 40px !important;
    height: 40px !important;
}

.temp-status {
    margin-top: 8px;
    margin-bottom: 24px;
    text-align: center;
    font-weight: bold;
    color: #795548;
}
.success-text {
  color: #2e7d32;
}
.fail-text {
  color: #c62828;
}


.syrup-controls {
    width: 100%;
}
.ingredients-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 24px;
}
.item-card {
    height: 90px;
    width: auto;
}

.actions-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.btn-start {
    margin: 0;
    width: 100%;
}
.btn-stop {
    margin: 0;
    width: 100%;
    background: #ef5350;
    color: white;
}
.btn-reset {
    background: #fff;
    color: #5d4037;
    border: 2px solid #5d4037;
    box-shadow: none;
}



.mix-bowl.large {
    width: 200px;
    height: 200px;
    border-radius: 50%; 
    border: 4px solid #dac08e;
    background: #fffde7;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
.mix-count {
  font-size: 16px;
  color: #795548;
  font-weight: bold;
}
.count {
  font-size: 24px;
}



.props-row.centered {
  display: flex;
  justify-content: center;
  gap: 20px;
  width: 100%;
}


.stage.mixing .stage-content {
  flex-direction: column;
  gap: 30px;
}

.mix-action-row {
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
}


.btn-yellow-s, .btn-light-s {
    width: 140px; 
    height: 50px;
    border-radius: 25px;
    font-size: 15px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    white-space: nowrap; 
}

.btn-yellow-s {
    background: linear-gradient(to bottom, #ffca28, #ffb300);
    color: #5d4037;
    box-shadow: 0 4px 0 #f57f17, 0 6px 12px rgba(0,0,0,0.1);
}
.btn-yellow-s:active {
    box-shadow: 0 0 0 #f57f17, inset 0 2px 4px rgba(0,0,0,0.2);
    transform: translateY(4px);
}

.btn-light-s {
    background: #fff8e1;
    color: #8d6e63;
    border: 2px solid #ecd8a4;
    box-shadow: 0 4px 0 #d7ccc8, 0 6px 12px rgba(0,0,0,0.05);
    font-size: 13px; 
}
.btn-light-s:active {
    box-shadow: 0 0 0 #d7ccc8, inset 0 2px 4px rgba(0,0,0,0.1);
    transform: translateY(4px);
    background: #fff;
}

.btn-icon-s {
    width: 20px;
    height: 20px;
    margin-right: 8px;
}
</style>

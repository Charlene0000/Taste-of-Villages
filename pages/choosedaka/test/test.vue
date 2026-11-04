<template>
	<view class="container">
        
        <view class="watercolor-bg">
            <view class="blob blob-1"></view>
            <view class="blob blob-2"></view>
            <view class="blob blob-3"></view>
        </view>

        
        <view class="nav-bar">
            <view class="left-container">
                <view class="back-icon" @click="goBack"></view>
            </view>
            <text class="nav-title">答题打卡</text>
            <view class="right-placeholder"></view>
        </view>

        <view class="content-wrapper">
            
            

            
            <view class="header-status fade-in-down">
                <view class="streak-badge">
                    连对 {{ streak }} 题
                </view>
                <view class="progress-container">
                    <view class="progress-bar" :style="{ width: progressWidth }"></view>
                </view>
            </view>

            
            <block v-if="!completed">
                <view class="question-card" :class="{ 'shake': isWrong }">
                    <image class="mascot-img" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/daka/tangcongtou.png" mode="widthFix"></image>
                    <view class="category-tag">{{ categoryName }}</view>
                    <view class="question-text">
                        {{ currentQuestion.question }}
                    </view>
                </view>

                
                <view class="options-list">
                    <view 
                        class="option-item" 
                        v-for="(opt, idx) in currentQuestion.options" 
                        :key="idx"
                        :class="optionClasses[idx]"
                        @click="handleAnswer(idx)"
                    >
                        <view class="option-letter">{{ String.fromCharCode(65 + idx) }}</view>
                        <view class="option-text">{{ opt }}</view>
                    </view>
                </view>
                
                <view class="sticker s-pencil">✏️</view>
            </block>

            
            <block v-else>
                <view class="result-card fade-in-up">
					<image class="mascot-img" src="https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/daka/yangcongtou-finish.png" mode="widthFix"></image>
                    <view class="result-title">挑战完成！</view>
                    
                    
                    <button v-if="!hasSubmittedThisSession" class="submit-btn" :disabled="submitting" @click="submitResult">
                        {{ submitting ? '提交中...' : '领取奖励' }}
                    </button>
                    
                    <button v-else class="submit-btn disabled" disabled>
                        已完成打卡
                    </button>
                </view>
            </block>
        </view>
	</view>
</template>

<script>
export default {
	data() {
		return {
            statusBarHeight: 20,
			openid: '',
			locationId: null,
            slug: '', 
			questions: [],
            userAnswers: [], 
            currentIndex: 0,
            streak: 0,
            score: 0,
            
            selectedOption: null, 
            isCorrect: null,      
            isWrong: false,       
            isAnswering: false,   
            
            completed: false,     
            submitting: false,
            doneToday: false,     
            hasSubmittedThisSession: false, 
            loading: true,        
            
            locationNames: {
                2: '华南师范大学',
                3: '南宁市',
                4: '佛山市',
                5: '暨南大学',
                6: '柳州市'
            }
		}
	},
    computed: {
        categoryName() {
            return this.locationNames[this.locationId] || '知识挑战';
        },
        currentQuestion() {
            return this.questions[this.currentIndex] || {};
        },
        progressWidth() {
            if (this.questions.length === 0) return '0%';
            return ((this.currentIndex / this.questions.length) * 100) + '%';
        },
        optionClasses() {
            const opts = this.currentQuestion.options;
            if (!opts) return [];
            return opts.map((_, idx) => {
                if (this.selectedOption === null) return '';
                if (idx === this.selectedOption) {
                    return this.isCorrect ? 'selected correct' : 'selected wrong';
                }
                if (!this.isCorrect && idx === this.currentQuestion.answer && this.selectedOption !== null) {
                    return 'should-be-correct';
                }
                return '';
            });
        }
    },
	onLoad(options) {
        const info = uni.getSystemInfoSync();
        this.statusBarHeight = info.statusBarHeight || 20;

		if (options) {
			this.locationId = options.locationId || '';
            this.slug = options.slug || options.locationId || ''; 
		}
        
		this.checkLoginStatus();
        this.fetchQuestions(); 
		this.checkDoneStatus();
	},
    methods: {
        goBack() {
			uni.navigateBack()
		},
        async fetchQuestions() {
            this.loading = true;
            try {
                const res = await uniCloud.callFunction({
                    name: 'get_quiz_questions',
                    data: { slug: this.slug || 'default' }
                });
                if (res.result && res.result.code === 200) {
                    this.questions = res.result.data.map(q => ({
                        question: q.title,
                        options: q.options,
                        answer: q.answerIndex,
                        _id: q._id
                    }));
                } else {
                    uni.showToast({ title: '题目加载失败', icon: 'none' });
                }
            } catch (e) {
                console.error(e);
                uni.showToast({ title: '网络异常', icon: 'none' });
            } finally {
                this.loading = false;
            }
        },
		checkLoginStatus() {
			try {
				const userInfo = uni.getStorageSync('uni-id-pages-userInfo') || uni.getStorageSync('uni_id_userinfo')
				if (userInfo && userInfo._id) this.openid = userInfo._id
			} catch (e) {
				console.error('检查登录失败', e)
			}
		},
		async checkDoneStatus() {
			if (!this.openid) return
			try {
				const data = { openid: this.openid, checkOnly: true }
				if (this.locationId) data.locationId = this.locationId
				const res = await uniCloud.callFunction({ name: 'quizCheckIn', data })
				if (res && res.result && res.result.code === 200) {
					this.doneToday = !!res.result.data.doneForLocation
                    if (this.doneToday) {
                        
                        this.completed = true;
                        this.hasSubmittedThisSession = true; 
                        this.score = 30; 
                    }
				}
			} catch (e) {}
		},
        


        handleAnswer(optIdx) {
            if (this.isAnswering || this.doneToday) return;
            this.isAnswering = true;
            this.selectedOption = optIdx;
            
            const isRight = (optIdx === this.currentQuestion.answer);
            this.isCorrect = isRight;

            this.userAnswers[this.currentIndex] = optIdx; 

            if (isRight) {
                this.streak++;
                this.score += 10;
            } else {
                this.streak = 0;
                this.isWrong = true;
                setTimeout(() => { this.isWrong = false }, 500);
            }

            
            setTimeout(() => {
                this.nextQuestion();
            }, 800);
        },

        nextQuestion() {
            if (this.currentIndex < this.questions.length - 1) {
                this.currentIndex++;
                this.selectedOption = null;
                this.isCorrect = null;
                this.isAnswering = false;
            } else {
                this.completed = true;
            }
        },

		async submitResult() {
			if (!this.openid) { uni.navigateTo({url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd'}); return }
            if (this.hasSubmittedThisSession) { uni.showToast({title:'已领取过啦', icon:'none'}); return; }

			this.submitting = true
			uni.showLoading({ title: '领奖中...' })
			try {
                const data = { 
					openid: this.openid, 
					answers: this.userAnswers, 
					score: this.score,
					locationId: this.locationId,
                    slug: this.slug
				};
				const res = await uniCloud.callFunction({ name: 'quizCheckIn', data })

				if (res && res.result && res.result.code === 200) {
                    
                    this.hasSubmittedThisSession = true;
                    this.doneToday = true;
                    
                    uni.hideLoading();
                    
                    uni.showToast({ 
                        title: `获得 ${res.result.data.score || 50} 积分!`, 
                        icon: 'success',
                        duration: 2000
                    });
                    
                    
                    setTimeout(() => {
                        uni.navigateBack();
                    }, 2000);
                } else {
                    uni.hideLoading();
                    uni.showToast({ title: res.result.message || '领取失败', icon: 'none' })
                }
			} catch (e) {
				console.error(e)
                uni.hideLoading();
                uni.showToast({title:'网络异常', icon:'none'})
			} finally {
				this.submitting = false
			}
		}
	}
}
</script>

<style lang="scss" scoped>

.container {
    min-height: 100vh;
    background-color: #FFFbf0;
    position: relative;
    overflow: hidden;
    color: #5D4037;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
}


.watercolor-bg {
    position: absolute;
    width: 100%; height: 100%; z-index: 0;
    .blob {
        position: absolute; border-radius: 50%; filter: blur(50px); opacity: 0.7;
    }
    .blob-1 { top: -10%; left: -20%; width: 300px; height: 300px; background: #fff1eb; }
    .blob-2 { bottom: 10%; right: -10%; width: 250px; height: 250px; background: linear-gradient(to right, #ea912b, #F7A145); opacity: 0.4; }
    .blob-3 { top: 40%; left: 30%; width: 150px; height: 150px; background: #ffdee9; }
}


.nav-bar {
    padding-top: calc(var(--status-bar-height) + 12px);
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    z-index: 10;
    margin-bottom: 20px;
    padding-left: 15px;
    padding-right: 15px;
}

.left-container {
    width: 32px;
}

.back-icon {
    width: 32px;
    height: 32px;
    background-image: url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%233E2723' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='19' y1='12' x2='5' y2='12'%3E%3C/line%3E%3Cpolyline points='12 19 5 12 12 5'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    cursor: pointer;
    transform: translateY(8px);
}

.nav-title {
    font-size: 24px;
    font-weight: bold;
    color: #3E2723;
    font-family: "Songti SC", "Noto Serif SC", serif;
    letter-spacing: 3px;
    transform: translateY(8px);
}

.right-placeholder {
    width: 32px;
}


.content-wrapper {
    position: relative;
    z-index: 10;
    padding: 24px;
    padding-top: 60px;
    height: calc(100vh - 64px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    overflow: hidden;
}


.header-status {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 30px;
}
.streak-badge {
    background: #fff; padding: 6px 12px; border-radius: 20px;
    font-size: 13px; font-weight: bold; color: #FF8A65;
    box-shadow: 0 4px 10px rgba(255, 138, 101, 0.2);
}
.progress-container {
    flex: 1; margin-left: 15px; background: rgba(255,255,255,0.5);
    height: 10px; border-radius: 10px; overflow: hidden;
}
.progress-bar {
    height: 100%; background: linear-gradient(90deg, #FF9A9E, #FECFEF);
    transition: width 0.5s ease;
}


.question-card {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px);
    border-radius: 24px;
    padding: 30px 24px;
    box-shadow: 0 10px 25px rgba(161, 140, 119, 0.1);
    border: 2px solid #fff;
    position: relative;
    margin-bottom: 25px;
    animation: float 6s ease-in-out infinite;
    
    &.shake {
        animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
    }
}
@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
}
@keyframes shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(2px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
    40%, 60% { transform: translate3d(4px, 0, 0); }
}

.mascot {
    position: absolute; top: -45px; left: 50%; transform: translateX(-50%);
    font-size: 50px; z-index: 1;
    filter: drop-shadow(0 5px 5px rgba(0,0,0,0.1));
}
.mascot-img {
    position: absolute; top: -60px; left: 50%; transform: translateX(-50%);
    width: 100px; z-index: 1;
    filter: drop-shadow(0 5px 5px rgba(0,0,0,0.1));
}
.category-tag {
    display: inline-block; font-size: 12px; color: #8D6E63;
    background: #E3C3A8; padding: 4px 10px; border-radius: 8px; margin-bottom: 15px;
}
.question-text {
    font-size: 18px; line-height: 1.6; font-weight: 600; color: #4E342E;
}


.options-list {
    display: flex; flex-direction: column; gap: 15px;
    margin-top: 20px;
}
.option-item {
    background: #fff; padding: 16px 20px; border-radius: 16px;
    border: 2px solid transparent;
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    display: flex; align-items: center;
    transition: all 0.2s;
}
.option-letter {
    width: 28px; height: 28px; background: #F5F5F5; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: bold; color: #A1887F; margin-right: 15px;
}
.option-text { font-size: 15px; color: #6D4C41; }
.option-item:active { transform: scale(0.98); }


.option-item.selected { background: #FFF3E0; border-color: #FFCC80; }
.option-item.selected .option-letter { background: #FF9800; color: #fff; }

.option-item.correct { background: #E8F5E9; border-color: #A5D6A7; }
.option-item.correct .option-letter { background: #4CAF50; color: #fff; }

.option-item.wrong { background: #FFEBEE; border-color: #EF9A9A; }
.option-item.wrong .option-letter { background: #EF5350; color: #fff; }

.option-item.should-be-correct { border: 2px dashed #4CAF50; }


.result-card {
    text-align: center;
    background: #fff;
    padding: 40px;
    border-radius: 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    margin-top: 40px;
}
.result-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; color: #5D4037; }
.result-score { font-size: 18px; color: #8D6E63; margin-bottom: 30px; }
.highlight { color: #FF7043; font-weight: bold; font-size: 24px; margin-left: 5px; }

.submit-btn {
    background: linear-gradient(135deg, #FABD72 0%, #DF7D1C 100%);
    color: white; border: none; padding: 15px 40px; border-radius: 50px;
    font-size: 18px; font-weight: 600;
    box-shadow: 0 10px 20px rgba(161, 140, 209, 0.3);
}
.submit-btn.disabled {
    background: #E0E0E0;
    color: #9E9E9E;
    box-shadow: none;
}

.done-hint { margin-top: 15px; color: #aaa; font-size: 12px; }


.sticker { position: absolute; font-size: 24px; z-index: 5; opacity: 0.9; transform: rotate(15deg); }
.s-flower { top: 110px; right: 15px; font-size: 32px; filter: blur(0.5px); }
.s-pencil { bottom: 90px; left: 10px; transform: rotate(-15deg); }

.fade-in-down { animation: fadeInDown 0.8s ease forwards; }
.fade-in-up { animation: fadeInUp 0.8s ease forwards; }

@keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>
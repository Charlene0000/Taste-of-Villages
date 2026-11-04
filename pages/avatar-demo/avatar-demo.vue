<template>
	<view class="page">
		<!-- Sprint 5.2：显式返回按钮（原生导航栏在 Web 端不渲染返回键） -->
		<nav-bar title="数字人演示" />

		<view class="header">
			<text class="title">数字人演示</text>
			<text class="subtitle">自研 Canvas 2D · 无 Live2D · 无模型文件</text>
		</view>

		<!-- Canvas 画布 -->
		<view class="canvas-card">
			<canvas
				canvas-id="avatarCanvas"
				id="avatarCanvas"
				class="avatar-canvas"
				:disable-scroll="true"
				@touchstart="noop"
			/>
			<view class="status-bar">
				<text class="status" :class="speaking ? 'speaking' : 'idle'">
					{{ speaking ? '● 播报中' : '○ 待机' }}
				</text>
				<text class="status-detail">{{ statusDetail }}</text>
			</view>
		</view>

		<!-- 表情切换 -->
		<view class="expr-row">
			<text
				class="expr-btn"
				v-for="e in expressions"
				:key="e.value"
				:class="{ active: currentExpression === e.value }"
				@click="switchExpression(e.value)"
			>{{ e.label }}</text>
		</view>

		<!-- 输入与控制 -->
		<view class="control-card">
			<input
				class="text-input"
				v-model="text"
				placeholder="输入要让数字人说的内容"
				placeholder-class="ph"
				:disabled="!ready"
			/>
			<view class="btn-row">
				<button class="btn primary" @click="speak" :disabled="!ready">
					{{ speaking ? '重新播报' : '让数字人说' }}
				</button>
				<button class="btn stop" @click="stop" :disabled="!speaking">
					停止
				</button>
			</view>
			<text class="hint">
				连续点击「让数字人说」会打断上一句（覆盖语义，不排队）
			</text>
		</view>

		<!-- 状态详情 -->
		<view class="info-card">
			<text class="info-title">运行状态</text>
			<view class="info-row" v-for="(v, k) in stateInfo" :key="k">
				<text class="info-key">{{ k }}</text>
				<text class="info-val">{{ v }}</text>
			</view>
		</view>

		<!-- Agent 联动 -->
		<view class="info-card">
			<text class="info-title">Agent 联动</text>
			<text class="info-desc">
				在「Agent 演示」页触发 avatar-speak 工具时，数字人会自动开口播报。
				该工具仅在前端注册，云函数中不可用。
			</text>
			<button class="btn link" @click="goAgentDemo">前往 Agent 演示页</button>
		</view>
	</view>
</template>

<script>
import { CanvasAvatar } from '@/digital-avatar/renderer/canvas-avatar'
import { AvatarController } from '@/digital-avatar/controller/avatar-controller'
import { noop as noopTts } from '@/digital-avatar/adapters/tts-adapter'
import NavBar from '@/components/nav-bar/nav-bar.vue'

export default {
	components: { NavBar },
	data () {
		return {
			text: '你好世界',
			speaking: false,
			ready: false,
			currentExpression: 'happy',
			stateInfo: {},
			expressions: [
				{ label: '中性', value: 'neutral' },
				{ label: '开心', value: 'happy' },
				{ label: '思考', value: 'thinking' },
				{ label: '惊讶', value: 'surprised' }
			]
		}
	},
	onReady () {
		this.initCanvas()
	},
	onUnload () {
		if (this.controller) {
			this.controller.destroy()
			this.controller = null
		}
	},
	methods: {
		noop () {},

		initCanvas () {
			const ctx = uni.createCanvasContext('avatarCanvas', this)
			const sys = uni.getSystemInfoSync()
			const size = Math.min(sys.windowWidth - 64, 340)

			this.avatar = new CanvasAvatar({
				ctx,
				width: size,
				height: size,
				expression: 'happy'
			})

			this.controller = new AvatarController({
				avatar: this.avatar,
				tts: noopTts,
				onStateChange: (speaking) => {
					this.speaking = speaking
					this.refreshState()
				}
			})

			this.ready = true
			this.refreshState()

			// 首次绘制一帧静态形象
			this.avatar.render()

			// 暴露给 Agent 演示页：让 Agent 能触发数字人口播
			// 通过全局共享而非路由参数，跨页跳转后依然有效
			getApp().globalData = getApp().globalData || {}
			getApp().globalData.avatarController = this.controller
		},

		speak () {
			if (!this.controller || !this.text.trim()) return
			this.controller.speak(this.text.trim(), {
				expression: this.currentExpression
			})
			this.refreshState()
		},

		stop () {
			if (!this.controller) return
			this.controller.stop()
			this.refreshState()
		},

		switchExpression (name) {
			this.currentExpression = name
			if (this.controller) {
				this.controller.setExpression(name)
			}
			this.refreshState()
		},

		refreshState () {
			if (!this.controller) return
			const s = this.controller.getState()
			this.stateInfo = {
				'播报状态': s.speaking ? '播报中' : '待机',
				'口型帧数': s.frameCount,
				'本句时长': s.duration + ' ms',
				'当前表情': s.expression,
				'口型开合': (s.mouthOpenY === null ? '-' : s.mouthOpenY.toFixed(3)),
				'队列长度': s.queued
			}
		},

		goAgentDemo () {
			uni.navigateTo({
				url: '/pages/agent-demo/agent-demo'
			})
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F7F5F2;
	padding: 32rpx;
	box-sizing: border-box;
}

.header {
	margin-bottom: 28rpx;
}

.title {
	font-size: 44rpx;
	font-weight: 700;
	color: #3E2723;
	display: block;
}

.subtitle {
	font-size: 24rpx;
	color: #8D6E63;
	margin-top: 8rpx;
	display: block;
}

.canvas-card {
	background: #FFFFFF;
	border-radius: 24rpx;
	padding: 24rpx;
	box-shadow: 0 4rpx 20rpx rgba(62, 39, 35, 0.06);
}

.avatar-canvas {
	width: 100%;
	height: 620rpx;
	display: block;
}

.status-bar {
	display: flex;
	align-items: center;
	margin-top: 16rpx;
}

.status {
	font-size: 24rpx;
	margin-right: 16rpx;
}

.status.speaking {
	color: #E53935;
}

.status.idle {
	color: #9E9E9E;
}

.status-detail {
	font-size: 22rpx;
	color: #A1887F;
}

.expr-row {
	display: flex;
	flex-wrap: wrap;
	margin: 24rpx 0;
}

.expr-btn {
	font-size: 24rpx;
	color: #8D6E63;
	background: #FFFFFF;
	border: 1rpx solid #F0E4DC;
	border-radius: 30rpx;
	padding: 12rpx 28rpx;
	margin: 0 14rpx 14rpx 0;
}

.expr-btn.active {
	background: #FFAB91;
	color: #FFFFFF;
	border-color: #FFAB91;
}

.control-card,
.info-card {
	background: #FFFFFF;
	border-radius: 24rpx;
	padding: 28rpx;
	margin-top: 20rpx;
}

.text-input {
	height: 88rpx;
	font-size: 28rpx;
	color: #3E2723;
	background: #FAF7F4;
	border-radius: 40rpx;
	padding: 0 28rpx;
}

.ph {
	color: #BCAAA4;
}

.btn-row {
	display: flex;
	margin-top: 24rpx;
}

.btn {
	font-size: 26rpx;
	border-radius: 40rpx;
	margin: 0 16rpx 0 0;
	line-height: 2.4;
}

.btn.primary {
	background: linear-gradient(135deg, #FFAB91, #FF8A65);
	color: #FFFFFF;
	flex: 1;
}

.btn.stop {
	background: #FFEBEE;
	color: #C62828;
}

.btn.link {
	background: #FFF3E0;
	color: #EF6C00;
	margin-top: 20rpx;
}

.hint {
	font-size: 22rpx;
	color: #A1887F;
	display: block;
	margin-top: 16rpx;
	line-height: 1.6;
}

.info-title {
	font-size: 26rpx;
	font-weight: 600;
	color: #5D4037;
	display: block;
	margin-bottom: 16rpx;
}

.info-row {
	display: flex;
	padding: 8rpx 0;
}

.info-key {
	font-size: 24rpx;
	color: #8D6E63;
	width: 200rpx;
}

.info-val {
	font-size: 24rpx;
	color: #3E2723;
}

.info-desc {
	font-size: 24rpx;
	color: #6D4C41;
	line-height: 1.7;
	display: block;
}
</style>

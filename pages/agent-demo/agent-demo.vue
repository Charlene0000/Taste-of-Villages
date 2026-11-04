<template>
	<view class="page">
		<view class="header">
			<text class="title">Agent 演示</text>
			<text class="subtitle">自研编排层 · 默认零外部依赖</text>
		</view>

		<!-- 输入区 -->
		<view class="input-card">
			<textarea
				class="input"
				v-model="inputText"
				placeholder="试试：我登录了几次 / 现在几点 / 我登录了几次现在几点 / 今天天气怎么样"
				:disabled="running"
			/>
			<view class="btn-row">
				<button class="btn primary" @click="run" :disabled="running">
					{{ running ? '执行中...' : '执行' }}
				</button>
				<button class="btn ghost" @click="clear">清空</button>
			</view>
			<view class="presets">
				<text
					class="preset"
					v-for="(p, i) in presets"
					:key="i"
					@click="usePreset(p)"
				>{{ p }}</text>
			</view>
		</view>

		<!-- 执行结果 -->
		<view class="section" v-if="lastResult">
			<view class="section-head">
				<text class="section-title">本次执行</text>
				<text class="badge" :class="lastResult.type === 'fallback' ? 'badge-warn' : 'badge-ok'">
					{{ lastResult.type === 'fallback' ? '已降级' : '工具执行' }}
				</text>
			</view>

			<view class="answer-box">
				<text class="answer">{{ lastResult.answer }}</text>
			</view>

			<!-- 规划结果 -->
			<view class="meta-block">
				<text class="meta-label">规划</text>
				<text class="meta-value">
					{{ lastResult.plan.confident ? ('置信度 ' + lastResult.plan.bestConfidence) : ('未命中意图（' + lastResult.plan.reason + '）') }}
				</text>
				<text class="meta-value" v-if="lastResult.plan.calls.length">
					工具序列：{{ lastResult.plan.calls.map(c => c.tool).join(' → ') }}
				</text>
			</view>

			<!-- 工具步骤 -->
			<view class="meta-block" v-if="lastResult.results.length">
				<text class="meta-label">工具步骤</text>
				<view class="step" v-for="(r, i) in lastResult.results" :key="i">
					<text class="step-dot" :class="r.ok ? 'ok' : 'err'">{{ r.ok ? '✓' : '✕' }}</text>
					<text class="step-name">{{ r.tool }}</text>
					<text class="step-time">{{ r.durationMs }}ms</text>
				</view>
			</view>

			<!-- 降级能力清单 -->
			<view class="meta-block" v-if="lastResult.fallback">
				<text class="meta-label">能力清单（降级返回）</text>
				<text class="cap-item" v-for="(c, i) in lastResult.fallback.capabilities" :key="i">
					· {{ c.description }}
				</text>
			</view>
		</view>

		<!-- Trace 列表 -->
		<view class="section">
			<view class="section-head">
				<text class="section-title">执行轨迹（最近 {{ traces.length }} / 20）</text>
				<text class="link" @click="clearTraces">清空</text>
			</view>

			<view class="trace-item" v-for="t in traces" :key="t.id" @click="toggle(t.id)">
				<view class="trace-head">
					<text class="trace-input">{{ t.input }}</text>
					<text class="trace-duration">{{ t.durationMs }}ms</text>
				</view>
				<view class="trace-body" v-if="expanded[t.id]">
					<text class="trace-line">规划置信度：{{ t.planned ? t.planned.bestConfidence : '-' }}</text>
					<text class="trace-line" v-if="t.planned && t.planned.calls.length">
						工具：{{ t.planned.calls.map(c => c.tool).join(' → ') }}
					</text>
					<text class="trace-line" v-if="t.fallback">类型：降级（能力清单）</text>
					<text class="trace-line" v-for="(s, i) in t.steps" :key="i">
						{{ i + 1 }}. {{ s.tool }} — {{ s.ok ? '成功' : '失败' }} {{ s.durationMs }}ms
					</text>
					<text class="trace-line trace-answer">输出：{{ t.answer }}</text>
				</view>
			</view>

			<text class="empty" v-if="!traces.length">暂无执行记录</text>
		</view>
	</view>
</template>

<script>
import { runAgent, getTraces, clearTraces } from '@/agent/core/index'
import registry from '@/agent/tools/index'
import avatarSpeak from '@/agent/tools/avatar-speak'

export default {
	data () {
		return {
			inputText: '',
			running: false,
			lastResult: null,
			traces: [],
			expanded: {},
			presets: [
				'我登录了几次',
				'现在几点',
				'我登录了几次现在几点',
				'今天天气怎么样'
			]
		}
	},
	onLoad () {
		// 注册数字人联动工具（仅前端可用，云函数中不注册）
		// 该工具让 Agent 在回答时能触发数字人口播
		registry.register(avatarSpeak.createTool(() => this.avatarController || null))
		this.refreshTraces()
	},
	methods: {
		/**
		 * 取全局共享的数字人控制器（若用户在数字人演示页打开过）
		 */
		get avatarController () {
			const app = getApp()
			return (app && app.globalData && app.globalData.avatarController) || null
		},
		usePreset (text) {
			this.inputText = text
			this.run()
		},
		async run () {
			const text = (this.inputText || '').trim()
			if (!text || this.running) return

			this.running = true
			try {
				// 从本地存储取当前用户，作为工具的上下文
				const userInfo = uni.getStorageSync('app_user_info') || null

				const result = await runAgent(text, {
					user: userInfo,
					// 数字人控制器（若在数字人演示页打开则存在）
					avatarController: this.avatarController || null
				})
				this.lastResult = result
				this.inputText = ''
				this.refreshTraces()
			} catch (e) {
				uni.showToast({
					title: '执行失败：' + (e && e.message ? e.message : '未知错误'),
					icon: 'none'
				})
				console.error('[agent-demo] 执行异常:', e)
			} finally {
				this.running = false
			}
		},
		refreshTraces () {
			this.traces = getTraces(20)
		},
		clearTraces () {
			clearTraces()
			this.refreshTraces()
		},
		toggle (id) {
			this.expanded = Object.assign({}, this.expanded, {
				[id]: !this.expanded[id]
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
	margin-bottom: 32rpx;
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

.input-card {
	background: #FFFFFF;
	border-radius: 24rpx;
	padding: 28rpx;
	box-shadow: 0 4rpx 20rpx rgba(62, 39, 35, 0.06);
}

.input {
	width: 100%;
	height: 140rpx;
	font-size: 28rpx;
	color: #3E2723;
	background: #FAF7F4;
	border-radius: 16rpx;
	padding: 20rpx;
	box-sizing: border-box;
}

.btn-row {
	display: flex;
	align-items: center;
	margin-top: 20rpx;
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

.btn.ghost {
	background: #F5F0EC;
	color: #8D6E63;
}

.presets {
	margin-top: 20rpx;
	display: flex;
	flex-wrap: wrap;
}

.preset {
	font-size: 22rpx;
	color: #A1887F;
	background: #FFF8F2;
	border: 1rpx solid #FFE0CC;
	border-radius: 30rpx;
	padding: 10rpx 22rpx;
	margin: 0 12rpx 12rpx 0;
}

.section {
	margin-top: 32rpx;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16rpx;
}

.section-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #5D4037;
}

.badge {
	font-size: 20rpx;
	padding: 6rpx 18rpx;
	border-radius: 20rpx;
}

.badge-ok {
	background: #E8F5E9;
	color: #2E7D32;
}

.badge-warn {
	background: #FFF3E0;
	color: #EF6C00;
}

.link {
	font-size: 24rpx;
	color: #FF8A65;
}

.answer-box {
	background: #FFFFFF;
	border-radius: 20rpx;
	padding: 24rpx;
	border-left: 6rpx solid #FFAB91;
}

.answer {
	font-size: 28rpx;
	color: #3E2723;
	line-height: 1.7;
	white-space: pre-wrap;
}

.meta-block {
	margin-top: 20rpx;
	background: #FFFFFF;
	border-radius: 20rpx;
	padding: 20rpx 24rpx;
}

.meta-label {
	font-size: 22rpx;
	color: #A1887F;
	display: block;
	margin-bottom: 10rpx;
}

.meta-value {
	font-size: 24rpx;
	color: #5D4037;
	display: block;
	line-height: 1.6;
}

.step {
	display: flex;
	align-items: center;
	padding: 8rpx 0;
}

.step-dot {
	width: 32rpx;
	height: 32rpx;
	border-radius: 50%;
	text-align: center;
	line-height: 32rpx;
	font-size: 20rpx;
	color: #FFFFFF;
	margin-right: 16rpx;
}

.step-dot.ok {
	background: #66BB6A;
}

.step-dot.err {
	background: #EF5350;
}

.step-name {
	flex: 1;
	font-size: 24rpx;
	color: #5D4037;
}

.step-time {
	font-size: 22rpx;
	color: #BCAAA4;
}

.cap-item {
	font-size: 24rpx;
	color: #6D4C41;
	line-height: 1.7;
	display: block;
}

.trace-item {
	background: #FFFFFF;
	border-radius: 16rpx;
	padding: 20rpx 24rpx;
	margin-bottom: 12rpx;
}

.trace-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.trace-input {
	flex: 1;
	font-size: 26rpx;
	color: #3E2723;
	margin-right: 16rpx;
}

.trace-duration {
	font-size: 22rpx;
	color: #BCAAA4;
}

.trace-body {
	margin-top: 14rpx;
	padding-top: 14rpx;
	border-top: 1rpx solid #F5F0EC;
}

.trace-line {
	font-size: 22rpx;
	color: #6D4C41;
	line-height: 1.7;
	display: block;
}

.trace-answer {
	color: #3E2723;
	margin-top: 8rpx;
}

.empty {
	font-size: 24rpx;
	color: #BCAAA4;
	text-align: center;
	padding: 40rpx 0;
	display: block;
}
</style>

<template>
  <view class="checklist-row">
    <view v-for="(s, idx) in steps" :key="idx" class="check-pill" :class="{done: s.done}">
      <text class="icon" v-if="s.done">✔</text>
      <text class="icon" v-else>{{ idx + 1 }}</text>
      <text class="text">{{ s.text }}</text>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    steps: { type: Array, default: () => [] }
  }
}
</script>

<style scoped>
.checklist-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.check-pill {
  background: #fff;
  border: 2px solid #ecd8a4;
  border-radius: 20px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  transition: all 0.3s ease;
}

.check-pill.done {
  background: #a5d6a7;
  border-color: #66bb6a;
  box-shadow: 0 2px 4px rgba(0,128,0,0.1);
}

.icon {
  font-weight: bold;
  font-size: 14px;
  color: #8d6e63;
  width: 20px;
  height: 20px;
  background: #ffe0b2;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-pill.done .icon {
  background: rgba(255,255,255,0.4);
  color: #1b5e20;
}

.text {
  font-size: 13px;
  color: #5d4037;
  font-weight: 600;
}

.check-pill.done .text {
  color: #1b5e20;
}
</style>

<template>
  <view class="progress-wrap">
    <view class="label">{{ label }}</view>
    <view class="separator">|</view>
    <view class="value">{{ Math.round(value) }}°C</view>
  </view>
</template>

<script>
export default {
  props: {
    value: { type: Number, default: 0 },
    max: { type: Number, default: 150 },
    height: { type: Number, default: 10 },
    label: { type: String, default: '' }
  }
}
</script>

<style scoped>
.progress-wrap{
  display:flex;
  align-items:center;
  justify-content: center;
  gap:16px;
  padding:8px 24px;
  background:#fff;
  border-radius:24px;
  border:2px solid #ecd8a4;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  margin-bottom: 20px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

.label{
  font-size:16px;
  color:#8d6e63;
  font-weight:bold;
}

.separator {
  color: #e0e0e0;
  font-weight: 300;
  font-size: 18px;
}

.value{
  font-size:16px;
  color:#5d4037;
  font-weight:bold;
}
</style>

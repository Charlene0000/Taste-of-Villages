const db = uniCloud.database()
exports.main = async (event, context) => {
  const { openid } = event

  // 1. 基础校验
  if (!openid || openid.trim() === '') {
    return {
      code: 400,
      message: '用户ID不能为空',
      data: []
    }
  }

  try {
    // 2. 查询 user_photos 集合（按创建时间倒序，最新的在最前面）
    const res = await db.collection('user_photos')
      .where({ openid: openid })
      .orderBy('createTime', 'desc') // 按时间倒序
      .get()

    // 3. 格式化返回数据（提前适配页面字段，减少前端处理）
    const formatData = (res.data || []).map(item => ({
      // 【优化1】确保url是字符串，兜底为空字符串
      _id: item._id, // Return ID for updates/deletes
      url: (Array.isArray(item.images) && item.images[0]) || item.url || '',
      title: item.title || '',
      locationName: item.locationName || item.address || '未知地点',
      images: Array.isArray(item.images) ? item.images : (item.url ? [item.url] : []),
      createTime: item.createTime || Date.now()
    }))

    // 【新增】过滤掉无URL的照片
    const validData = formatData.filter(item => item.url);

    return {
      code: 200,
      message: '查询成功',
      data: validData // 返回过滤后的有效数据
    }
  } catch (e) {
    console.error('查询用户照片失败:', e.stack || e.message)
    return {
      code: 500,
      message: '查询失败，请重试',
      error: e.message,
      data: []
    }
  }
}
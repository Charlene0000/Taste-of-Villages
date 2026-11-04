const db = uniCloud.database()
exports.main = async (event, context) => {
  const { photos, openid } = event

  if (!openid) {
    return { code: 401, message: '未登录/Missing openid' }
  }
  if (!photos || !photos.length) {
    return { code: 400, message: '照片信息为空' }
  }

  try {
    // 给每张照片添加用户标识
    const photosWithUser = photos.map(photo => ({
      ...photo,
      openid,
      // 【修改1】时间格式统一为时间戳
      createTime: photo.createTime || Date.now(),
      // 【新增】确保images是数组
      images: Array.isArray(photo.images) ? photo.images : (photo.url ? [photo.url] : [])
    }))

    // 【新增】过滤掉无效照片
    const validPhotos = photosWithUser.filter(photo => photo.url || (photo.images && photo.images.length > 0));
    if (validPhotos.length === 0) {
      return { code: 400, message: '无有效云存储照片链接' };
    }

    // 批量插入数据库
    await db.collection('user_photos').add(validPhotos)
    return { code: 200, message: '保存成功' }
  } catch (e) {
    console.error('保存照片失败', e)
    return { code: 500, message: '保存失败', error: e.message }
  }
}
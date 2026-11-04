const db = uniCloud.database()
const _ = db.command

// 注意：用户集合名和上面保持一致
const USER_COLLECTION = 'uni-id-users'
const CHECKED_PLACE_COLLECTION = 'userCheckedPlaces'

exports.main = async (event, context) => {
  try {
    const { openid, locationId, checkType = 'location' } = event
    
    // 1. 校验用户标识
    if (!openid) {
      return { code: 400, message: '用户标识缺失，请先登录' }
    }

    // 2. 查询用户基础信息（仅查积分）
    const userRes = await db.collection(USER_COLLECTION)
      .where({ _id: openid })
      .field({ points: true })
      .get()

    if (userRes.data.length === 0) {
      return { code: 404, message: '用户不存在，请重新登录' }
    }

    // 3. 初始化积分（如果用户无积分字段）
    let userPoints = userRes.data[0].points || 0
    if (userRes.data[0].points === undefined) {
      await db.collection(USER_COLLECTION)
        .where({ _id: openid })
        .update({ points: 0 })
      userPoints = 0
    }

    // 4. 仅基于locationId和类型判重（支持 location / photo），并兼容历史无 type 的记录
    let alreadyCheckedPlace = false
    if (locationId !== undefined && locationId !== null) {
      const existingRes = await db.collection(CHECKED_PLACE_COLLECTION)
        .where({ openid: openid, locationId: locationId.toString() })
        .limit(20)
        .get()

      if (existingRes.data.length > 0) {
        // 如果存在同类型的记录
        const sameType = existingRes.data.find(r => r.type === (checkType || 'location'))
        if (sameType) {
          alreadyCheckedPlace = true
        } else if (checkType === 'location') {
          // 兼容旧数据：历史记录没有 type 字段，视为 location
          const legacy = existingRes.data.find(r => r.type === undefined || r.type === null)
          if (legacy) alreadyCheckedPlace = true
        }
      }
    }

    // 5. 返回最终结果
    return {
      code: 200,
      message: '查询成功',
      data: {
        points: userPoints,
        alreadyCheckedPlace: alreadyCheckedPlace
      }
    }

  } catch (error) {
    console.error('userInit异常:', error)
    return { 
      code: 500, 
      message: '查询用户信息失败', 
      error: error.message 
    }
  }
}
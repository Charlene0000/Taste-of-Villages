const db = uniCloud.database()
const _ = db.command

// 确认你的集合名和数据库一致
const USER_COLLECTION = 'uni-id-users'
const CHECKIN_COLLECTION = 'checkIn'
const CHECKED_PLACE_COLLECTION = 'userCheckedPlaces'

exports.main = async (event, context) => {
  // 解构参数：新增 targetLocation、maxDistance（适配前端传递的参数）
  const {
    openid = '',
    location = {},
    targetLocation = {}, // 新增：目标标记点坐标
    address = '',
    locationId = '',
    maxDistance = 10000, // 新增：最大打卡距离（默认10公里）
    timestamp = Date.now(),
    checkType = 'location', // 新增：打卡类型 'location' 或 'photo'
    images = [] // 可选：拍照上传的图片路径/ID数组
  } = event || {};

  let currentPoints = 0;
  let newPoints = 0;

  try {
    // 1. 基础参数校验（补充目标坐标校验）
    if (!openid || openid.trim() === '') {
      return { code: 400, message: '用户未登录，请先登录' };
    }
    if (!locationId || locationId.toString().trim() === '') {
      return { code: 400, message: '地点信息缺失，无法打卡' };
    }
    // 新增：校验目标坐标是否完整
    if (!targetLocation.latitude || !targetLocation.longitude) {
      return { code: 400, message: '目标地点坐标缺失，无法打卡' };
    }
    // 新增：校验用户定位是否完整
    if (!location.latitude || !location.longitude) {
      return { code: 400, message: '用户定位信息缺失，请刷新定位后重试' };
    }

    // 2. 云函数端二次距离校验（核心：防止前端篡改）
    const distance = calculateDistance(
      location.latitude, location.longitude,
      targetLocation.latitude, targetLocation.longitude
    );
    console.log('云函数计算用户与目标点距离:', distance.toFixed(2), '米');

    if (distance > maxDistance) {
      return {
        code: 400,
        message: `超出打卡范围`
      };
    }


    // 3. 核心判重：支持按 type 判重，同时兼容历史没有 type 字段的记录
    const existingRes = await db.collection(CHECKED_PLACE_COLLECTION)
      .where({ openid: openid, locationId: locationId.toString() })
      .limit(20)
      .get();

    let shouldAddPoints = true;

    if (existingRes.data.length > 0) {
      // 如果已有同类型的记录
      const sameType = existingRes.data.find(r => r.type === (checkType || 'location'))

      if (sameType) {
        if (checkType === 'photo') {
          // 拍照打卡允许重复提交，但不重复加分
          shouldAddPoints = false;
        } else {
          // 其他类型（如定位打卡）不允许重复
          return { code: 403, message: `你已在该地点通过【${checkType}】方式打卡过，无法重复打卡` };
        }
      }

      // 兼容旧数据：历史记录可能没有 type 字段，视为之前的定位打卡
      if (checkType === 'location') {
        const legacy = existingRes.data.find(r => r.type === undefined || r.type === null)
        if (legacy) {
          return { code: 403, message: `你已在该地点打卡过，无法重复打卡` };
        }
      }
    }

    // 4. 查询用户积分 (无论是否加分都查询，确保返回最新/当前积分)
    const userRes = await db.collection(USER_COLLECTION)
      .where({ _id: openid })
      .field({ points: true })
      .get();

    if (userRes.data.length === 0) {
      return { code: 404, message: '用户不存在，请重新登录' };
    }

    currentPoints = Number(userRes.data[0].points) || 0;
    newPoints = currentPoints; // 默认为当前积分

    // 仅当允许加分时执行更新
    if (shouldAddPoints) {
      // Determine points based on check type
      const pointsFormatted = checkType === 'photo' ? 70 : 35;
      newPoints = currentPoints + pointsFormatted;

      await db.collection(USER_COLLECTION)
        .where({ _id: openid })
        .update({ points: newPoints });
    }

    // 5. 记录打卡（新增 distance 字段，保留目标坐标）
    // 5. 记录打卡详情（不同类型都写入主集合，便于查询）
    await db.collection(CHECKIN_COLLECTION).add({
      openid: openid,
      type: checkType || 'location',
      location: {
        latitude: location.latitude || 0,
        longitude: location.longitude || 0
      },
      targetLocation: {
        latitude: targetLocation.latitude,
        longitude: targetLocation.longitude
      },
      address: address || '未知地址',
      locationId: locationId.toString(),
      distance: distance.toFixed(2),
      images: Array.isArray(images) ? images : [], // 如果是拍照打卡，前端可传图片列表
      checkInTime: new Date(timestamp),
      createTime: new Date()
    });

    // 6. 写入判重集合（仅存 openid + locationId，无时间判重）
    // 6. 写入判重集合，包含 type 字段（location / photo）
    await db.collection(CHECKED_PLACE_COLLECTION).add({
      openid: openid,
      locationId: locationId.toString(),
      address: address || '未知地址',
      type: checkType || 'location',
      createTime: new Date()
    });

    // 7. 返回成功结果
    return {
      code: 200,
      message: '打卡成功',
      data: { currentPoints: newPoints, isCheckedPlace: true }
    };

  } catch (error) {
    console.error('打卡异常详情:', error.stack || error.message);

    // 积分回滚（避免异常导致积分错误）
    if (openid && newPoints > currentPoints) {
      try {
        await db.collection(USER_COLLECTION)
          .where({ _id: openid })
          .update({ points: currentPoints });
      } catch (rollbackErr) {
        console.error('积分回滚失败:', rollbackErr);
      }
    }

    return {
      code: 500,
      message: '打卡失败，请重试',
      error: error.message
    };
  }
}

// 新增：云函数内部的距离计算工具函数（和前端逻辑一致）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（米）
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const deltaLat = radLat2 - radLat1;
  const deltaLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // 返回距离（米）
}
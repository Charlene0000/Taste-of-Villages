const db = uniCloud.database()

// 集合名（与项目中一致）
const USER_COLLECTION = 'uni-id-users'
const QUIZ_LOG_COLLECTION = 'userQuizLogs'

// 每个地点对应的服务器端正确答案映射，使用locationId作为键
// 映射以题目在前端的顺序为准，值为正确选项下标
const ANSWERS_MAP = {
  '2': [0, 1, 0], // 华南师范大学（与前端题库保持一致）
  '3': [0, 0, 0], // 南宁市
  '4': [0, 0, 0], // 佛山市
  '5': [0, 0, 1], // 暨南大学
  '6': [3, 1, 2],
  'default': [1, 1, 2] // 默认题库
}

// 说明：已移除基于日期的“每天一次”限制。
// 现在的规则为：如果传入locationId，则每个地图标记点只能答题一次（按locationId判重）。
// 如果未传locationId，则不会进行按地点判重（不再限制每天一次）。

exports.main = async (event, context) => {
  try {
    const { openid = '', answers = [], checkOnly = false, locationId = '', slug = '' } = event || {}

    if (!openid) {
      return { code: 400, message: '用户未登录' }
    }

    // 如果传了 locationId，则按地点判重：一个地点只能答题一次
    if (locationId !== undefined && locationId !== null && String(locationId).trim() !== '') {
      const locExist = await db.collection(QUIZ_LOG_COLLECTION)
        .where({ openid, locationId: locationId.toString() })
        .limit(1)
        .get()
      const doneForLocation = locExist.data && locExist.data.length > 0

      if (checkOnly) {
        return { code: 200, message: '查询成功', data: { doneForLocation } }
      }

      if (doneForLocation) {
        return { code: 403, message: '该地点已进行过答题打卡' }
      }
    } else {
      // 未传 locationId：不再有按天限制，checkOnly 时简单返回未打卡
      if (checkOnly) {
        return { code: 200, message: '查询成功', data: { doneForLocation: false } }
      }
    }

    // 动态获取正确答案 logic
    let questionsList = [];
    if (slug) {
      const qRes = await db.collection('quiz_questions').where({ slug }).get();
      if (qRes.data && qRes.data.length > 0) {
        questionsList = qRes.data;
      }
    }

    // Fallback to default if no questions found via slug
    if (questionsList.length === 0) {
      // Default fallback
      const defaultRes = await db.collection('quiz_questions').where({ slug: 'default' }).get();
      questionsList = defaultRes.data;
    }

    // Extract correct answers
    const correctAnswers = questionsList.map(q => q.answerIndex);

    // Calculate Score
    let score = 0
    const correctness = []

    for (let i = 0; i < correctAnswers.length; i++) {
      const userAns = (Array.isArray(answers) && answers[i] !== undefined) ? Number(answers[i]) : -1;
      const correctAns = Number(correctAnswers[i]);

      const isCorrect = (userAns === correctAns);
      correctness.push(isCorrect);

      if (isCorrect) {
        score += 10; // 10 points per question
      }
    }

    // 查询并更新用户积分
    const userRes = await db.collection(USER_COLLECTION)
      .where({ _id: openid })
      .field({ points: true })
      .get()

    if (!userRes.data || userRes.data.length === 0) {
      return { code: 404, message: '用户不存在' }
    }

    const currentPoints = Number(userRes.data[0].points) || 0
    const newPoints = currentPoints + score

    if (score > 0) {
      await db.collection(USER_COLLECTION)
        .where({ _id: openid })
        .update({ points: newPoints })
    }

    // 写入答题记录，记录 locationId 以支持按地点判重，同时存 correctness
    await db.collection(QUIZ_LOG_COLLECTION).add({
      openid,
      locationId: locationId !== undefined && locationId !== null ? locationId.toString() : '',
      answers: Array.isArray(answers) ? answers : [],
      correctness,
      score,
      createTime: new Date()
    })

    return { code: 200, message: '答题打卡完成', data: { score, newPoints, correctness } }

  } catch (e) {
    console.error('quizCheckIn异常:', e)
    return { code: 500, message: '操作失败', error: e.message }
  }
}

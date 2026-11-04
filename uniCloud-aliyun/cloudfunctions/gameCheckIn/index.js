'use strict';
const db = uniCloud.database()
const dbCmd = db.command

exports.main = async (event, context) => {
    // Accept openid from event (client passed) or fallback
    let {
        gameId = 'cook-shaqima', // Identifier for the game
        score = 25, // Default points
        openid = ''
    } = event

    // Fallback to context/token if not provided in event
    if (!openid && context.auth && context.auth.uid) {
        openid = context.auth.uid
    }
    // Note: We removed the context.UNI_ID_TOKEN check block to simplify and match "quizCheckIn" pattern of trusting event logic or direct context.

    if (!openid) {
        return { code: 400, message: '用户未登录' }
    }

    const collection = db.collection('userGameLogs') // Changed to generic log collection
    const userCollection = db.collection('uni-id-users')

    // Deduplication Logic: Check if user played this game TODAY
    // Using YYYY-MM-DD in China Standard Time
    const now = new Date()
    const todayStr = new Date(now.getTime() + 28800000).toISOString().split('T')[0]

    const recordRes = await collection.where({
        openid: openid,
        gameId: gameId,
        dateStr: todayStr
    }).get()

    if (recordRes.data.length > 0) {
        // Already played and got points today -> Return Success but 0 points (Support Repeat Play)
        return {
            code: 200,
            message: '今日已获得积分',
            data: {
                pointsAdded: 0,
                totalPoints: null
            }
        }
    }

    // Add Record
    await collection.add({
        openid,
        gameId,
        score,
        dateStr: todayStr,
        createTime: Date.now()
    })

    // Add Points to User
    await userCollection.doc(openid).update({
        points: dbCmd.inc(score)
    })

    // Fetch updated points
    const userRes = await userCollection.doc(openid).field({ points: true }).get()
    const currentPoints = (userRes.data && userRes.data[0]) ? userRes.data[0].points : 0

    return {
        code: 200,
        message: '游戏完成，积分+25',
        data: {
            pointsAdded: score,
            totalPoints: currentPoints
        }
    }
}

'use strict';
const db = uniCloud.database()
const _ = db.command

exports.main = async (event, context) => {
    const { openid } = event

    if (!openid) {
        return { code: 400, message: 'Missing openid' }
    }

    // 1. Define Villages Configuration
    // IDs based on pages/food/detail.vue locationConfig
    const VILLAGES = [
        { id: '101', slug: 'shaqima', name: '遮浪玛仔', image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/food/shaqima.png' },
        { id: '102', slug: 'caibaoguo', name: '石寨菜包粿', image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/food/caibaoguo.png' },
        { id: '103', slug: 'taohuaguo', name: '红桃粿', image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/food/hongtaoguo.png' },
        { id: '104', slug: 'chenzhouhao', name: '清蒸晨洲蚝', image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/food/chenzhouhao.png' },
        { id: '105', slug: 'paiguxianfan', name: '排骨咸饭', image: 'https://village-1369475595.cos.ap-guangzhou.myqcloud.com/static/food/paiguxianfan.png' }
    ]

    try {
        // 2. Fetch User Checked Places (Location, Photo, Make?)
        const checkedRes = await db.collection('userCheckedPlaces')
            .where({ openid: openid })
            .limit(500)
            .get()

        // 3. Fetch Quiz Logs
        const quizRes = await db.collection('userQuizLogs')
            .where({ openid: openid })
            .limit(500)
            .get()

        // 4. Aggregate Data
        const records = VILLAGES.map(village => {
            const vId = village.id;
            const vSlug = village.slug;

            // Filter logs for this village
            // Note: Quiz might use locationId matching string '101'

            const placeLogs = checkedRes.data.filter(log => log.locationId === vId);
            const quizLogs = quizRes.data.filter(log => log.locationId === vId);

            // Determine status
            const hasLocation = placeLogs.some(log => log.type === 'location' || !log.type); // !type for legacy
            const hasPhoto = placeLogs.some(log => log.type === 'photo');
            const hasMake = placeLogs.some(log => log.type === 'make' || log.type === 'cook'); // Future proofing
            const hasQuiz = quizLogs.length > 0;

            // Calculate progress (out of 4)
            const total = 4;
            const done = [hasLocation, hasPhoto, hasMake, hasQuiz].filter(b => b).length;

            return {
                ...village,
                status: {
                    quiz: hasQuiz,
                    location: hasLocation,
                    photo: hasPhoto,
                    make: hasMake
                },
                progress: Math.floor((done / total) * 100)
            };
        });

        return {
            code: 200,
            data: records
        }

    } catch (e) {
        console.error(e)
        return { code: 500, message: 'Server Error', error: e.message }
    }
};

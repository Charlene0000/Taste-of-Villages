'use strict';
const db = uniCloud.database();

exports.main = async (event, context) => {
    const { openid } = event;

    if (!openid) {
        return { code: 400, message: '用户未登录' };
    }

    try {
        const res = await db.collection('user_orders')
            .where({ user_id: openid })
            .orderBy('create_time', 'desc')
            .get();

        return {
            code: 200,
            message: 'Success',
            data: res.data
        };
    } catch (e) {
        console.error('Get Orders Error:', e);
        return {
            code: 500,
            message: 'Failed to fetch orders',
            error: e
        };
    }
};

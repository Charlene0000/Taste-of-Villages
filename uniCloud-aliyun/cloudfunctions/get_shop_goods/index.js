'use strict';
const db = uniCloud.database();
exports.main = async (event, context) => {
    const collection = db.collection('shop_goods');
    try {
        const res = await collection.limit(50).get();
        return {
            code: 200,
            msg: 'success',
            data: res.data
        }
    } catch (e) {
        return {
            code: 500,
            msg: 'failed',
            error: e
        }
    }
};

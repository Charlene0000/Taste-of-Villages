'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {
    const { _id, openid } = event

    if (!_id) return { code: 400, message: 'ID required' }
    // allow passing openid explicitly or from context
    const uid = openid || context.OPENID

    try {
        const res = await db.collection('user_photos')
            .where({ _id: _id, openid: uid })
            .remove()

        return { code: 200, message: 'Deleted', deleted: res.deleted }
    } catch (e) {
        return { code: 500, message: e.message }
    }
};

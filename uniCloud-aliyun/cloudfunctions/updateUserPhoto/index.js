'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {
    const { _id, title, openid } = event

    if (!_id) return { code: 400, message: 'ID required' }
    const uid = openid || context.OPENID

    try {
        const res = await db.collection('user_photos')
            .where({ _id: _id, openid: uid })
            .update({
                title: title
            })

        return { code: 200, message: 'Updated', updated: res.updated }
    } catch (e) {
        return { code: 500, message: e.message }
    }
};

'use strict';
const db = uniCloud.database()
exports.main = async (event, context) => {
    const { openid, locationId } = event

    if (!openid) return { code: 400, msg: 'openid required' }

    const res = await db.collection('userCheckedPlaces')
        .where({
            openid: openid,
            locationId: locationId
        })
        .limit(100)
        .get()

    return {
        code: 200,
        data: res.data
    }
};

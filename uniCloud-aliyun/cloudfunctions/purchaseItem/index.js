'use strict';
const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
    const { openid, itemId, itemName, cost, imgUrl } = event;

    console.log('Purchase Request:', event);

    if (!openid) return { code: 400, message: 'Missing openid' };
    if (!itemId || !cost) return { code: 400, message: 'Missing item info' };

    // NON-TRANSACTIONAL APPROACH
    try {
        // 1. Get User Points
        const userRes = await db.collection('uni-id-users').doc(openid).get();
        console.log('User Fetch Result:', userRes);

        if (userRes.data.length === 0) {
            return { code: 404, message: 'User not found' };
        }

        const user = userRes.data[0];
        const currentPoints = user.points || 0;

        if (currentPoints < cost) {
            return { code: 400, message: '美食币不足', data: { currentPoints } };
        }

        // 2. Deduct Points
        // We do this first. In a real production app without transactions, we might reserve first, but this is simpler.
        const updateRes = await db.collection('uni-id-users').doc(openid).update({
            points: dbCmd.inc(-cost)
        });
        console.log('Points Deducted:', updateRes);

        if (updateRes.updated === 0) {
            return { code: 500, message: 'Failed to update points' };
        }

        // 3. Create Order Record
        const orderRes = await db.collection('user_orders').add({
            user_id: openid,
            openid: openid, // redundant but safer for queries
            item_id: itemId,
            item_name: itemName,
            item_image: imgUrl,
            cost: cost,
            create_time: Date.now(),
            status: 1
        });
        console.log('Order Created:', orderRes);

        // 4. Return new points balance
        const updatedUser = await db.collection('uni-id-users').doc(openid).field({ points: true }).get();

        return {
            code: 200,
            message: 'Redemption Success',
            data: {
                newPoints: updatedUser.data[0].points,
                orderId: orderRes.id
            }
        };

    } catch (e) {
        console.error('Purchase Exception:', e);
        return { code: 500, message: 'System Error', error: e };
    }
};

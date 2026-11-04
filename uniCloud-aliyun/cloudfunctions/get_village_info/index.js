
'use strict';
const db = uniCloud.database();

exports.main = async (event, context) => {
    // event contains { slug, id }
    const collection = db.collection('init_food_data');

    let res;
    if (event.id) {
        res = await collection.doc(event.id).get();
    } else if (event.slug) {
        res = await collection.where({
            slug: event.slug
        }).get();
    } else {
        return {
            code: 400,
            msg: 'Missing slug or id'
        };
    }

    if (res.data && res.data.length > 0) {
        return {
            code: 200,
            data: res.data[0]
        };
    } else {
        return {
            code: 404,
            msg: 'Not found'
        };
    }
};

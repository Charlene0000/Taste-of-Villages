'use strict';
const db = uniCloud.database();

exports.main = async (event, context) => {
    const collection = db.collection('init_food_data');
    const { slug, id } = event;

    let res;
    if (id) {
        res = await collection.doc(id).get();
    } else if (slug) {
        res = await collection.where({ slug: slug }).get();
    } else {
        return {
            code: 400,
            msg: 'Missing slug or id'
        };
    }

    if (res.data.length > 0) {
        return {
            code: 0,
            data: res.data[0]
        };
    } else {
        return {
            code: 404,
            msg: 'Food not found'
        };
    }
};

'use strict';
const db = uniCloud.database();

exports.main = async (event, context) => {
    // Input: slug (string) or id
    const { slug } = event;

    // Default to 'default' if no slug provided
    const targetSlug = slug || 'default';

    const collection = db.collection('quiz_questions');

    try {
        // Fetch questions matching the slug
        let res = await collection.where({
            slug: targetSlug
        }).get();

        // If no questions found for specific slug, try default
        if (res.data.length === 0) {
            res = await collection.where({
                slug: 'default'
            }).get();
        }

        return {
            code: 200,
            msg: '获取成功',
            data: res.data
        };
    } catch (e) {
        return {
            code: 500,
            msg: '获取题目失败',
            error: e
        };
    }
};

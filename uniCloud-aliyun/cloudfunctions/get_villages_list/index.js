'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
    // Collection confirmed as 'init_food_data'
    const collection = db.collection('init_food_data')

    try {
        // Determine fields to fetch
        // Need: slug, name, location_image, location_desc (or just simplified desc), tags
        // Also need 'location' name if we want to display it
        const res = await collection.field({
            slug: true,
            name: true,
            location: true,
            location_image: true,
            location_desc: true,
            latitude: true,
            longitude: true,
            tags: true
        }).get()

        return {
            code: 200,
            data: res.data
        }
    } catch (e) {
        console.error(e)
        return {
            code: 500,
            message: 'Server Error',
            error: e.message
        }
    }
};

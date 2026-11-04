'use strict';
const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
    // Check for uni-id user context (if triggered by client SDK with auth)
    let uid = event.uid; // Optional: allow explicit passing for testing (secure this in prod)
    if (!uid) {
        // Try getting from context if using uni-id standard call
        const uniIdInfo = context.UNI_ID_TOKEN || {}; // Simplified check
        // Ideally use uni-id-common or check context.AUTH if deployed
        // For now trusting client passing uid or relying on 'uni-id' logic if integrated
        // But to be safe and compatible with previous code patterns:
        if (context.auth && context.auth.uid) {
            uid = context.auth.uid;
        } else if (event.openid) {
            uid = event.openid;
        }
    }

    if (!uid) {
        return { code: 401, message: 'Unauthorized' };
    }

    const action = event.action || 'get'; // 'get' or 'sign'

    const userCollection = db.collection('uni-id-users');
    const userRes = await userCollection.doc(uid).field({
        points: true,
        signin_date: true,
        signin_days: true, // This will be used as 'streak'
        nickname: true
    }).get();

    if (!userRes.data || userRes.data.length === 0) {
        return { code: 404, message: 'User not found' };
    }

    const user = userRes.data[0];
    const points = user.points || 0;
    const lastDateStr = user.signin_date || ''; // YYYY-MM-DD
    let streak = user.signin_days || 0;

    // Date calcs
    const now = new Date();
    // Use +8 timezone adjustment for China Standard Time if server is UTC
    // Simply using YYYY-MM-DD string comparison for safety
    const todayStr = new Date(now.getTime() + 28800000).toISOString().split('T')[0]; // simple CST adjust
    const yesterday = new Date(now.getTime() + 28800000 - 86400000);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const signedInToday = (lastDateStr === todayStr);

    // Calculate current display day (1-7)
    // If signed in today, display streak. If not, if yesterday was signed, display streak+1 (pending). 
    // If break, display 1.

    // Logic for 'get'
    if (action === 'get') {
        let displayDay = streak;

        if (signedInToday) {
            // Already signed, streak is current
            // If streak > 7, we might want to mod it or cap it. 
            // Requirement: "7 day cycle". 
            // Let's assume streak resets to 1 after day 7 signin? Or keeps growing?
            // "Cycle" implies modulo. 
            // Better: displayDay = (streak - 1) % 7 + 1
            // But if streak is 0? -> 1.
        } else {
            // Not signed today.
            // Check if streak is valid (last sign was yesterday)
            if (lastDateStr === yesterdayStr) {
                displayDay = streak + 1; // Pending sign-in for next day
            } else {
                displayDay = 1; // Streak broken or new
            }
        }

        // Cycle logic: 1..7
        // If displayDay > 7, wrap around.
        // Actually, let's keep 'streak' as raw consecutive days in DB, and calc cycle here.
        let cycleDay = ((displayDay - 1) % 7) + 1;
        if (cycleDay < 1) cycleDay = 1;

        return {
            code: 200,
            data: {
                signedInToday,
                streak, // raw streak
                cycleDay, // 1-7
                points,
                lastDateStr
            }
        };
    }

    // Logic for 'sign'
    if (action === 'sign') {
        if (signedInToday) {
            return { code: 400, message: 'Already signed in today' };
        }

        // Check continuity
        if (lastDateStr === yesterdayStr) {
            streak++;
        } else {
            streak = 1; // Reset
        }

        // Calculate points based on NEW streak
        // Cycle position: (streak - 1) % 7 + 1
        // Day 1: 1
        // ...
        // Day 7: 7
        // Day 8: 1

        const cycleDay = ((streak - 1) % 7) + 1;

        let reward = 0;
        if (cycleDay >= 1 && cycleDay <= 2) reward = 5;
        else if (cycleDay >= 3 && cycleDay <= 5) reward = 10;
        else if (cycleDay >= 6 && cycleDay <= 7) reward = 20;

        // Update user
        await userCollection.doc(uid).update({
            points: dbCmd.inc(reward),
            signin_date: todayStr,
            signin_days: streak
        });

        // Log to score history (optional, keeping it simple for now)

        return {
            code: 200,
            data: {
                reward,
                newPoints: points + reward,
                streak,
                cycleDay
            }
        };
    }

    return { code: 400, message: 'Invalid action' };
};

'use strict';
const crypto = require('crypto');

// Configuration —— 密钥统一由 app-config 提供，源码不含真实凭据
function loadAppConfig() {
    const candidates = ['app-config', '../common/app-config'];
    for (const id of candidates) {
        try {
            return require(id);
        } catch (e) {
            // 尝试下一个候选路径
        }
    }
    throw new Error('[getCosAuth] 无法加载 app-config 模块');
}
const CONFIG = loadAppConfig().getConfig();
const COS_CFG = CONFIG.cos || {};

const COS_CONFIG = {
    Bucket: COS_CFG.bucket || 'your-cos-bucket-placeholder',
    Region: COS_CFG.region || 'ap-guangzhou',
    SecretId: COS_CFG.secretId || 'your-cos-secret-id-placeholder',
    SecretKey: COS_CFG.secretKey || 'your-cos-secret-key-placeholder'
};

exports.main = async (event, context) => {
    let { fileName, folder } = event;

    // Default folder is photoRecords
    if (!folder) {
        folder = 'photoRecords';
    }

    if (!fileName) {
        fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
    }

    const key = `${folder}/${fileName}`;
    const qKeyTime = getQKeyTime();

    // 过期时间
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 1);
    const expirationStr = expiration.toISOString();

    // 构建 Policy（按照官方文档格式）
    const policy = {
        "expiration": expirationStr,
        "conditions": [
            { "q-sign-algorithm": "sha1" },
            { "q-ak": COS_CONFIG.SecretId },
            { "q-sign-time": qKeyTime }
        ]
    };

    // 1. Policy JSON 字符串
    const policyString = JSON.stringify(policy);

    // 2. SignKey = HMAC-SHA1(SecretKey, KeyTime)
    const signKey = crypto.createHmac('sha1', COS_CONFIG.SecretKey).update(qKeyTime).digest('hex');

    // 3. StringToSign = SHA1(PolicyJSON)
    const stringToSign = crypto.createHash('sha1').update(policyString).digest('hex');

    // 4. Signature = HMAC-SHA1(SignKey, StringToSign)
    const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('hex');

    // 5. Policy Base64
    const policyBase64 = Buffer.from(policyString).toString('base64');

    return {
        url: `https://${COS_CONFIG.Bucket}.cos.${COS_CONFIG.Region}.myqcloud.com`,
        formData: {
            'key': key,
            'policy': policyBase64,
            'q-sign-algorithm': 'sha1',
            'q-ak': COS_CONFIG.SecretId,
            'q-key-time': qKeyTime,
            'q-signature': signature
        },
        fileName: fileName
    };
};

function getQKeyTime() {
    const now = Math.floor(Date.now() / 1000);
    const end = now + 3600; // 1 hour
    return `${now};${end}`;
}

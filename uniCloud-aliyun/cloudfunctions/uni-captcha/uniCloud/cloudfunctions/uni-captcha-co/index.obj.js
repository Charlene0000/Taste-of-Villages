

const uniCaptcha = require('uni-captcha')

const db = uniCloud.database();

const verifyCodes = db.collection('opendb-verify-codes')
module.exports = {
	async getImageCaptcha({
		scene
	}) {
		
		let {
			deviceId,
			platform
		} = this.getClientInfo();
		
		let res = await verifyCodes.where({
			scene,
			deviceId,
			state: 0
		}).limit(1).get()
		
		let action = res.data.length ? 'refresh' : 'create'
		
		
		return await uniCaptcha[action]({
			scene, 
			uniPlatform: platform
		})
	}
}

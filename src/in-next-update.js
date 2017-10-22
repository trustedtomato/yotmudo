const ytpl = require('ytpl');
const guessMetadata = require('guess-metadata');
const request = require('./request');
const token = 'ddDCydkItXbyXWOBXcbzNfJQjKatbRSKHbhXyQYA';

const searchMetadata = text => {
	const guessedMetadata = guessMetadata(text);
	const url = `https://api.discogs.com/database/search?artist=${guessedMetadata.artist}&track=${guessedMetadata.title}&page=1&per_page=1&token=${token}`;
	request(url).on()
};

ytpl('PLzA3PVpRGuUgfdSATNoKebfyuD6Px9_2o',{}).then(async info => {
	for(const item of info.items){
		console.log(item.title.padEnd(70), await findMetadata(item.title));
	}
});
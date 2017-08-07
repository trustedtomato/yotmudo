const ytpl = require('ytpl');
const request = require('request');

const replaceBeetwenBrackets = (_, value) => {
	if(
		/version/i.test(value) ||
		/edit/i.test(value) ||
		/remix/i.test(value) ||
		/cover/i.test(value) ||
		/live/i.test(value)
	){
		return _;
	}else{
		return ' ';
	}
};

const removeSpecChars = (str) => str.replace(/[,.!-]\s+/, ' ');

const getAllRegexOccurenceBase = (str, regex) => {
	if(str.length === 0){
		return [];
	}
	const i = str.search(regex);
	if(i >= 0){
		return [str.slice(i)].concat(getAllRegexOccurenceBase(str.slice(i + 1), regex));
	}else{
		return [];
	}
};

const findMetadata = (originalTitle) => new Promise((resolve, reject) => {
	title = removeSpecChars(
		originalTitle
		.replace(/\s*\((.*?)\)\s*/g, replaceBeetwenBrackets)
		.replace(/\s*\[(.*?)\]\s*/g, replaceBeetwenBrackets)
		.replace(/(ft\.|feat\.|featuring\s)\s*(?=.+?( -|$))/ig, '')
		.replace(/\s*&\s*/, ' ')
		.trim()
		.replace(/\.[a-z][a-z0-9]+$/i, '')
		.replace('.', '. ')
		.replace(/\Wofficial\s.+/i, '')
		.replace(/\hd\s.+/i, '')
	);

	request('https://api.deezer.com/search/track/?limit=10&q=' + encodeURIComponent(title), (err, response, body) => {
		try{
			const x = JSON.parse(body);
			const artistBases = getAllRegexOccurenceBase(originalTitle, /(&|,|- | -)/).map(base => base.slice(1)).concat(originalTitle).map(base => base.trim().toLowerCase());

			const goodItem = x.data.find(({artist, title}) => {

				artist.name = removeSpecChars(artist.name);
				title = removeSpecChars(title);

				// console.log(title
				//		.replace(/\s*\(.*?\)\s*/g, '')
				//		.replace(/\s*\[.*?\]\s*/g, ''));

				return artist.name.length - 1 <= Math.max(...artistBases.map(artistBase =>
					artist.name.toLowerCase().split('').filter((char, i) => artistBase[i] === char).length
				)) &&
					/\sremix/i.test(originalTitle) === /\sremix/i.test(title) &&
					/\scover/i.test(originalTitle) === /\scover/i.test(title) &&
					/\(.*?live.*?\)/i.test(title) === /\(.*?live.*?\)/i.test(originalTitle) &&
					(!/\Woriginal\s+mix\W/i.test(originalTitle) || !/\Wradio\s+edit\W/i.test(title))
			});
			if(typeof goodItem === 'undefined'){
				resolve(undefined);
			}else{
				resolve({
					artist: goodItem.artist.name,
					title: goodItem.title
				});
			}
		}catch(err){
			reject(err);
		}
	});
});

ytpl('PLzA3PVpRGuUgfdSATNoKebfyuD6Px9_2o',{}).then(async info => {
	for(const item of info.items){
		console.log(item.title.padEnd(70), await findMetadata(item.title));
	}
});
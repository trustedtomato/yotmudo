/*
fullTitle
	The whole title of the song; this is the raw thingy
	Example: Bob - Sweet Lemonade (Alex remix) [Official Video]
artist
	The arist of the song
	Example: Bob
title
	The title of the song (excluding the brackets)
	Example: Sweet Lemonade
otherProperties
	The other properties of the song
	Example: Alex remix
*/

const separators = '\u002D\u007E\u058A\u1806\u2010\u2011\u2012\u2013\u2014\u2015\u2053\u207B\u208B\u2212\u301C\u3030';

const titleBrackets = [
	['(',')'],
	['[',']'],
	['{','}']
];

const titleBracketHandlers = [
	{
		regex: /(?:(?:featuring)|(?:feat.?)|(?:ft.?))\s+(.*)/i,
		handler: (title:string,matches:string[]) =>
			title + ' ft. ' + matches.join(', ')
	},{
		regex: /(.*)\s+remix/i,
		handler: (title:string,matches:string[]) =>
			title + '('+matches.join(' & ')+' remix)'
	},{
		regex: /(.*)\s+version/i,
		handler: (title:string,matches:string[]) =>
			title + matches.map(match => '('+match+' version)').join(' ')
	},{
		regex: /(.*\scover\s.*)/i,
		handler: (title:string,matches:string[]) =>
			title + matches.map(match => '('+match+' cover)').join(' ')
	}
];

const parseFullTitle = (fullTitle:string) => {
	if(typeof fullTitle !== 'string'){
		throw new Error('fullTitle must be string!');
	}
	const splittedFullTitle = fullTitle.split(eval('/['+separators+']+/ig')).map(part => part.trim()).filter(part => part!=='');

	if(splittedFullTitle.length === 0){
		return {
			artist: 'Anonymous',
			title: 'ID'
		};
	}else if(splittedFullTitle.length === 1){
		return {
			artist: 'Anonymous',
			title: splittedFullTitle[0]
		}
	}else{
		const artist = splittedFullTitle[0];
		let title = splittedFullTitle[1];

		const titleBracketMatches = new WeakMap();
		titleBracketHandlers.forEach(titleBracketHandler => {
			titleBracketMatches.set(titleBracketHandler,[]);
		});

		let startOfBrackets = Infinity;
		titleBrackets.forEach(([opening,closing]) => {
			while(title.includes(opening) && title.includes(closing) && title.indexOf(opening) < title.indexOf(closing)){
				title = title.replace(eval('/\\s*\\'+opening+'(.*?)\\'+closing+'\\s*/'),(_,toReplace,offset) => {
					toReplace = toReplace.trim();
					if(startOfBrackets > offset){
						startOfBrackets = offset;
					}
					titleBracketHandlers.forEach(titleBracketHandler => {
						const match = toReplace.match(titleBracketHandler.regex);
						if(match){
							titleBracketMatches.get(titleBracketHandler).push(match[1]);
						}
					});
					return ' ';
				}).trim();
			}
		});
		if(startOfBrackets < title.length){
			const toReplace = title.slice(startOfBrackets).trim();
			titleBracketHandlers.forEach(titleBracketHandler => {
				const match = toReplace.match(titleBracketHandler.regex);
				if(match){
					titleBracketMatches.get(titleBracketHandler).push(match[1]);
				}
			});
			title = title.slice(0,startOfBrackets);
		}

		titleBracketHandlers.forEach(titleBracketHandler => {
			const titleBracketMatch = titleBracketMatches.get(titleBracketHandler);
			if(titleBracketMatch.length>0){
				title = titleBracketHandler.handler(title,titleBracketMatch);
			}
		});
		return {artist,title};
	}
};

/*
const testTitles = [
	'Justin Bieber - Sorry (PURPOSE: The Movement)',
	'Wiz Khalifa - See You Again ft. Charlie Puth [Official Video] Furious 7 Soundtrack',
	'ZAYN - PILLOWTALK',
	'Kehlani - Gangsta (From Suicide Squad: The Album) [Official Video]',
	'Charlie Puth - We Don\'t Talk Anymore (feat. Selena Gomez) [Official Video]',
	'One Direction - History (Official Video)',
	'The Weeknd - Starboy (official) ft. Daft Punk',
	'DJ Snake ft. Justin Bieber - Let Me Love You [Lyric Video]'
];
testTitles.forEach(testTitle => {
	console.log(testTitle);
	console.log(parseFullTitle(testTitle));
	console.log();
});
*/

export = parseFullTitle;
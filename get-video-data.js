const fs = require('fs');
const ytdl = require('ytdl-core');
const fetch = require('node-fetch');
const jsdom = require('jsdom');
const urlLib = require('url');
const parseFullTitle = require('./parse-fulltitle');



const getVideoPageUrlById = id => {
	return 'https://www.youtube.com/watch?v='+id;
};



/**
 * Get the title of a YouTube video by parsing the video's page
 * @param {string} id The Youtube ID of the video
 */
const fetchFullTitleAlternative = (function(){
	const separators = '\u002D\u007E\u058A\u1806\u2010\u2011\u2012\u2013\u2014\u2015\u2053\u207B\u208B\u2212\u301C\u3030';

	const extractFullTitleFromElements = document => {
		const eowTitle = document.getElementById('eow-title');
		if(eowTitle!==null){
			return eowTitle.textContent.trim();
		}
		const ogMetaTitle = document.querySelector('meta[property="og:title"]');
		if(ogMetaTitle!==null){
			return ogMetaTitle.getAttribute('content').trim();
		}
		const metaTitle = document.querySelector('meta[name="title"]');
		if(metaTitle!==null){
			return metaTitle.getAttribute('content').trim();
		}
	};
	const getFullTitleFromDocumentTitle = documentTitle => {
		if(/youtube\s*$/i.test(documentTitle)){
			return documentTitle.replace(eval('/\s*['+separators+']+\s*youtube\s*$/i',''));
		}
	};
	const getFullTitleFromDocument = document => {
		return extractFullTitleFromElements(document) || getFullTitleFromDocumentTitle(document.title);
	};
	
	return id => new Promise(resolve => {
		jsdom.env(getVideoPageUrlById(id),(err, window) => {
			const document = window.document;
			const fullTitle = getFullTitle(document);
			const parsedFullTitle = parseFullTitle(fullTitle);
			resolve({
				fullTitle,
				parsedFullTitle,
				stream
			});
		});
	});
}());




module.exports = id => {
	const stream = ytdl(getVideoPageUrlById(id),{filter: 'audioonly'});

	const fullTitlePromise = new Promise(resolve => {
		stream.on('info',info => {
			if(!info.title){
				fetchFullTitleAlternative(id).then(resolve);
			}else{
				resolve(info.title);
			}
		});
	});
	const parsedFullTitlePromise = fullTitlePromise.then(fullTitle => {
		return parseFullTitle(fullTitle);
	});

	return{
		fullTitlePromise,
		parsedFullTitlePromise,
		stream
	};
};
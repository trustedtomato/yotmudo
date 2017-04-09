#!/usr/bin/env node

const program = require('commander');
const getVideoData = require('./get-video-data');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const prompt = require('prompt');
const colors = require('colors/safe');

program
	.version('0.0.1')
	.usage('<url>')
	.option('-f, --force','use the executed attributes, never prompt')
	.parse(process.argv);

if(program.args.length===0){
	program.help();
}else{
	const input = program.args[0];
	const urlMatch = input.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/);
	const id = urlMatch
		? urlMatch[7]
		: input;

	const {fullTitlePromise,parsedFullTitlePromise,stream} = getVideoData(id);

	stream.on('error',(err) => {
		console.error(err);
	});

	const proc = new ffmpeg({source: stream}).format('mp3');
	
	const saveToFile = (artist,title) => {
		const fileName = artist+' - '+title;
		proc.addOutputOption('-metadata','artist='+artist);
		proc.addOutputOption('-metadata','title='+title);
		proc.saveToFile(fileName+'.mp3');
	};
	
	parsedFullTitlePromise.then(parsedFullTitle => {
		const defaultArtist = parsedFullTitle.artist;
		const defaultTitle = parsedFullTitle.title;
		if(program.force){
			saveToFile(defaultArtist,defaultTitle);
		}else{
			fullTitlePromise.then(fullTitle => {
				console.log(colors.gray('Raw title: ')+fullTitle);
				prompt.message = '';
				prompt.delimiter = ':';
				prompt.start();
				prompt.get({properties: {
					artist: {
						description: 'Artist',
						default: defaultArtist
					},
					title: {
						description: 'Title',
						default: defaultTitle
					}
				}},(err,result) => {
					prompt.stop();
					if(err){
						saveToFile(defaultArtist,defaultTitle);
					}else{
						saveToFile(result.artist,result.title);
					}
				});
			});		
		}
	});
	proc.on('error',err => {
		console.error(err.message);
	});
	proc.on('end',() => {
		console.log(colors.bold(colors.green('Completed!')))
	});
}
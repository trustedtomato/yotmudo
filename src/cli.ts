#!/usr/bin/env node

const program:any = require('commander');
const prompt:any = require('prompt');
const colors:any = require('colors/safe');
import {download as downloadYoutubeMusic} from './youtube-music-downloader';

program
	.version('0.0.1')
	.usage('<url>')
	.option('-f, --force','use the executed attributes, never prompt')
	.option('-v, --video','make an mp4 file and include the video')
	.parse(process.argv);

if(program.args.length===0){
	program.help();
}else{
	downloadYoutubeMusic(program.args[0],{
		video: program.video,
		validator: program.force
		? null
		: ({artist,title},fullTitle) => new Promise(resolve => {
			console.log(colors.gray('Raw title: ')+fullTitle);
			prompt.message = '';
			prompt.delimiter = ':';
			prompt.start();
			prompt.get({properties: {
				artist: {
					description: 'Artist',
					default: artist
				},
				title: {
					description: 'Title',
					default: title
				}
			}},(err:any,result:any) => {
				prompt.stop();
				if(err){
					resolve({artist,title});
				}else{
					resolve({artist: result.artist,title: result.title});
				}
			});
		})
	});
	const input = program.args[0];
}
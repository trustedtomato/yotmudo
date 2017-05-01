#!/usr/bin/env node

const info:any = require('../package.json');
import * as util from 'util';
import {createProgram,ParsingErrors,ParsingWarnings} from 'commandy';
const chalk:any = require('chalk');


const trackProgram = createProgram('<url>')
	.description('download single track')
	.option('-f, --force','use the executed attributes, don\'t prompt')

const playlistProgram = createProgram('<url>')
	.description('download whole playlist')
	.option('-f, --force','use the executed attributes, don\'t prompt')
	.option('-a, --artist <artist-name>','default value for artist')
	.option('-A, --album <album-name>','treats playlist as album')

const editProgram = createProgram('<glob>')
	.description('edit tags of already downloaded track')

const mainProgram = createProgram()
	.command('track',trackProgram)
	.command('playlist',playlistProgram)
	.command('edit',editProgram);

const input = mainProgram.parse(process.argv.slice(2));

if(input.errors.length > 0){
	input.errors.forEach(error => {
		console.error(chalk.red('err'),util.inspect(error,{depth: null}));
	});
	process.exit();
}

if(input.program!==trackProgram && input.program!==playlistProgram){
	console.error(chalk.red('err'),'invalid command!');
	process.exit();
}


const prompt:any = require('prompt');
import {download as downloadYoutubeMusic} from './youtube-music-downloader';

prompt.start();
downloadYoutubeMusic(input.arguments.url,{
	type: (input.program===playlistProgram ? 'playlist' : 'track'),
	validator: input.options.force
	? null
	: ({artist,title},fullTitle) => new Promise(resolve => {
		console.log(chalk.gray('Raw title: ')+fullTitle);
		prompt.message = '';
		prompt.delimiter = ':';
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
			if(err){
				resolve({artist,title});
			}else{
				resolve({artist: result.artist,title: result.title});
			}
		});
	})
}).then(() => {
	prompt.stop();
	console.log('Completed!');
});
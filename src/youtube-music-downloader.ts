/// <reference path="../typings/index.d.ts" />

const ffmpeg:any = require('fluent-ffmpeg');
const ytdl:any = require('ytdl-core');
const ytpl:any = require('ytpl');
const jsdom:any = require('jsdom');
const tmp:any = require('tmp-promise');
import path = require('path');
import fs = require('fs');
import urlLib = require('url');
import parseFullTitle = require('./parse-fulltitle');



const VIDEO_URL = 'https://www.youtube.com/watch?v=';



export interface BasicMetadata{
	artist:string
	title:string
}
export interface Metadata extends BasicMetadata{}
interface Info{
	title:string,
	video_url:string
}



export const download = async (input:string,options:{validator?:(parsedFullTitle:BasicMetadata,fullTitle:string)=>Metadata | Promise<Metadata>} = {}) => {
	const infos:Info[] = await (async function(){
		if(/^[a-zA-Z0-9\-_]+$/.test(input)){
			input = VIDEO_URL+input;
		}
		console.log('Searching for "'+input+'"...');
		const parsedUrl = urlLib.parse(input);
		if(parsedUrl.pathname==='/watch'){
			const streamInfo = await ytdl.getInfo(input);
			console.log('Found track!');
			return [streamInfo];
		}
		const playlist = await ytpl(input);
		console.log('Found playlist!');
		return playlist.items.map((item:any) => {
			const streamInfo = ytdl.getInfo(item.url_simple);
			return streamInfo;
		});
	}());

	/*
	streamsWithInfo.forEach(([stream]) => {
		stream.on('error',(err:Error) => {
			console.error(err.message);
		});
	});
	*/
	
	const metadatas:Map<Info,Metadata> = new Map();
	await infos.reduce((promise:Promise<any>,info) => {
		const parsedFullTitle = parseFullTitle(info.title);
		if(typeof options.validator === 'function'){
			return promise.then(() => {
				return Promise.resolve(options.validator(parsedFullTitle,info.title)).then((metadata:Metadata) => {
					metadatas.set(info,metadata);
				}).catch(err => {
					metadatas.set(info,parsedFullTitle);
				});
			});
		}
	},Promise.resolve());



	return Promise.all(Array.from(metadatas).map(([info,metadata]) => new Promise(resolve => {
		console.log('Started '+metadata.title+'...');
		const proc = new ffmpeg(ytdl.downloadFromInfo(info,{filter: 'audioonly'}));
		proc.addOutputOption('-metadata','artist='+metadata.artist);
		proc.addOutputOption('-metadata','title='+metadata.title);
		proc.saveToFile(metadata.artist + ' - ' + metadata.title +'.mp3');
		proc.on('end',() => {
			console.log('Finished '+metadata.title);
			resolve();
		});
	})));
};
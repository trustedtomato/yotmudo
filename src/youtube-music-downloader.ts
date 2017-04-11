/// <reference path="../typings/index.d.ts" />

const ffmpeg:any = require('fluent-ffmpeg');
const ytdl:any = require('ytdl-core');
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



const inputToId = (input:string):string => {
	if(/^[a-zA-Z0-9\-_]+$/.test(input)){
		return input;
	}else{
		const parsedUrl = urlLib.parse(input,true);
		if(parsedUrl.pathname==='/watch'){
			return parsedUrl.query.v;
		}else if(/^\/embed\//.test(parsedUrl.pathname)){
			return parsedUrl.pathname.replace(/^\/embed\//,'');
		}
	}
};

export const download = async (input:string,options:{validator?:(parsedFullTitle:BasicMetadata,fullTitle:string)=>Metadata | Promise<Metadata>} = {}) => {
	const id = inputToId(input);
	
	const streams = [ytdl(VIDEO_URL+id,{filter: 'audioonly'})];

	streams.forEach(stream => {
		stream.on('error',(err:any) => {
			console.error(err);
		});
	});

	const tmpDir = await tmp.dir();
	const filePathsWithFullTitles = new Map(await Promise.all(streams.map(async (stream:any):Promise<[string,string]> => {
		const fullTitle = await (new Promise(resolve => {
			stream.on('info',(info:any) => {
				resolve(info.title);
			});
		}));
		const p:Promise<[string,string]> = new Promise(resolve => {
			const filePath = path.join(tmpDir.path,fullTitle+'.mp4');
			stream.pipe(fs.createWriteStream(filePath));
			stream.on('end',() => {
				resolve([filePath,fullTitle]);
			});
		});
		return p;
	})));

	const filePathsWithMetadatas = new Map(await Promise.all(Array.from(filePathsWithFullTitles).map(([path,fullTitle]):Promise<[string,Metadata]> => new Promise(resolve => {
		const parsedFullTitle = parseFullTitle(fullTitle);
		if(typeof options.validator === 'function'){
			Promise.resolve(options.validator(parsedFullTitle,fullTitle)).then(metadata => {
				resolve([path,metadata]);
			});
		}
	}))));
	
	return Promise.all(Array.from(filePathsWithMetadatas).map(([filePath,metadata]) => new Promise(resolve => {
		const proc = new ffmpeg(filePath);
		proc.addOutputOption('-metadata','artist='+metadata.artist);
		proc.addOutputOption('-metadata','title='+metadata.title);
		proc.saveToFile(metadata.artist + ' - ' + metadata.title +'.mp3');
		proc.on('end',() => {
			resolve();
		});
	})));
};
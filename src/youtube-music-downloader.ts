/// <reference path="../typings/index.d.ts" />

const ffmpeg:any = require('fluent-ffmpeg');
const ytdl:any = require('ytdl-core');
const ytpl:any = require('ytpl');
const sanitizeFilename:any = require('sanitize-filename');
import path = require('path');
import fs = require('fs');
import util = require('util');
import urlLib = require('url');
import guessMetadata = require('guess-metadata');



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

const chunkArray = <T>(arr:T[],chunkLength:number):T[][] => {
	let i,j,temparray;
	const chunks = [];
	for(i = 0, j = arr.length; i < j; i += chunkLength) {
		chunks.push(arr.slice(i,i+chunkLength));
	}
	return chunks;
};
const delay = (delay:number) => new Promise(resolve => 
	setTimeout(resolve,delay)
);
const getInfo = (url:string,retries:number,retryDelay:number):Promise<Info> =>
	ytdl.getInfo(url).catch(
		(err:any) => {
			if(retries<=0){
				throw err;
			}
			return delay(retryDelay).then(() => getInfo(url,retries-1,retryDelay))
		}
	);
const flattenArray = <T>(chunks:T[][]):T[] => {
	return [].concat(...chunks);
};
const processChunks = async <T,U>(chunks:T[][],processor:(x:T)=>Promise<U>):Promise<U[][]> => {
	if(typeof chunks==='undefined' || typeof chunks[0]==='undefined'){
		return [];
	}
	const processedChunk = await Promise.all(chunks[0].map(processor));
	const otherProcessedChunks = await processChunks(chunks.slice(1),processor);
	return [processedChunk].concat(otherProcessedChunks);
};
const processInChunks = async <T,U>(arr:T[],chunkLength:number,processor:(x:T)=>Promise<U>):Promise<U[]> => {
	return flattenArray(await processChunks(chunkArray(arr,chunkLength),processor));
};
const padStart = (originalString:string,targetLength:number,padString:string = ' ') => {
	targetLength = targetLength >> 0;
	if(originalString.length >= targetLength){
		return originalString;
	}else{
		targetLength = targetLength - originalString.length;
		if(targetLength > padString.length){
			padString += padString.repeat(targetLength/padString.length);
		}
		return padString.slice(0,targetLength) + originalString;
	}
}


export interface BasicWritableStream{
	write:(chunk:string)=>any
}
export const download = async (input:string,options:{output?:BasicWritableStream,errorOutput?:BasicWritableStream,formatError?:(error:Error)=>string,type?:'playlist'|'track',validator?:(parsedFullTitle:BasicMetadata,fullTitle:string)=>Metadata | Promise<Metadata>} = {}) => {
	let {output,errorOutput,formatError} = options;
	if(typeof output === 'undefined') output = process.stdout;
	if(typeof errorOutput === 'undefined') errorOutput = process.stderr;
	if(typeof formatError === 'undefined') formatError = (err) => 'ERROR '+err.message;



	const urls:string[] = await (async function(){
		if(options.type==='playlist'){
			/* TODO: handle error */
			const playlist = await ytpl(input,{});
			return playlist.items.map((item:any) => item.url_simple);
		}else{
			if(/^[a-zA-Z0-9\-_]+$/.test(input)) input = VIDEO_URL+input;
			return [input];
		}
	}());



	const chunkLength = 5;
	const infoRetries = 1;
	const infoRetryDelay = 1000;
	let i = 1;
	const maxIterationStringLength = String(urls.length).length;
	const infos:Info[] = (await processInChunks(urls,chunkLength,async url => {
		const info = await getInfo(url,infoRetries,infoRetryDelay).catch(err => err);
		const prefix = `(${padStart(String(i),maxIterationStringLength,'0')}/${urls.length})`;
		if(info instanceof Error){
			errorOutput.write(prefix+' '+formatError(info)+'\n');
		}else{
			output.write(prefix+' '+info.title+'\n');
		}
		i++;
		return info;
	})).filter(info => {
		return !(info instanceof Error)
	});


	
	const metadatas:Map<Info,Metadata> = new Map();
	infos.forEach(info => {
		metadatas.set(info,guessMetadata(info.title));
	});
	/*
	await infos.reduce((promise:Promise<any>,info) => {
		const parsedFullTitle = guessMetadata(info.title);
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
	*/



	(await processInChunks<[Info,Metadata],any>(Array.from(metadatas),chunkLength,([info,metadata]) => new Promise(resolve => {
		console.log('Started '+metadata.title+'...');
		const proc = new ffmpeg(ytdl.downloadFromInfo(info,{filter: 'audioonly'}));
		proc.addOutputOption('-metadata','artist='+metadata.artist);
		proc.addOutputOption('-metadata','title='+metadata.title);
		proc.saveToFile(sanitizeFilename(metadata.artist + ' - ' + metadata.title +'.mp3'));
		proc.on('end',() => {
			console.log('Finished '+metadata.title);
			resolve();
		});
	})));
};
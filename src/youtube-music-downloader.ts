const ffmpeg:any = require('fluent-ffmpeg');
import ytdl = require('ytdl-core');
const ytpl:any = require('ytpl');
const sanitizeFilename:any = require('sanitize-filename');
const tmp:any = require('tmp');
const request:any = require('request');
const mimeTypes:any = require('mime-types');
import guessMetadata = require('guess-metadata');
const id3:any = require('node-id3');
import {createWriteStream} from 'fs';
import {PassThrough} from 'stream';
import {EventEmitter} from 'events';
import getImages = require('./get-images');

const VIDEO_URL = 'https://www.youtube.com/watch?v=';



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
const processInChunks = <T,U>(chunks:T[][],processor:(x:T)=>Promise<U>,after:Promise<any> = Promise.resolve()):Promise<U>[] => {
	if(typeof chunks==='undefined' || typeof chunks[0]==='undefined'){
		return [];
	}
	const firstChunkXPromises = chunks[0].map(x => after.then(() => processor(x)));
	const otherChunkXPromises = processInChunks(chunks.slice(1),processor,Promise.all(firstChunkXPromises));
	return firstChunkXPromises.concat(otherChunkXPromises);
};



export interface Metadata{
	artist:string
	title:string
	image?:string
}
export type videoInfo = ytdl.videoInfo;

export interface BasicTrack{
	url:string
}
export interface BasicTrackWithInfo extends BasicTrack{
	info:videoInfo
}
export interface Track extends BasicTrackWithInfo{
	metadata:Metadata
}



export let defaultNumberOfParallelRequests = 5;
const getInfoByURL = async (basicTrack:BasicTrack,retries:number = 0,retryDelay:number = 1000):Promise<BasicTrackWithInfo> => {
	return await ytdl.getInfo(basicTrack.url).then(info =>
		Object.assign({},basicTrack,{info: info})
	).catch(
		async (err:any) => {
			if(retries<=0){
				throw err;
			}
			return delay(retryDelay).then(async () => await getInfoByURL(basicTrack,retries-1,retryDelay))
		}
	)
};
const saveTrack = (track:Track):Promise<Track> => new Promise(resolve => {
	const highestAudioBitrateFormat = track.info.formats.sort((formatA:ytdl.videoFormat,formatB:ytdl.videoFormat) => {
		const bitrateA = formatA.audioBitrate || 0;
		const bitrateB = formatB.audioBitrate || 0;
		return bitrateB - bitrateA;
	})[0];
	const filename:string = sanitizeFilename(track.metadata.artist + ' - ' + track.metadata.title +'.mp3');
	const proc = new ffmpeg(ytdl.downloadFromInfo(track.info,{format: highestAudioBitrateFormat}));
	proc.saveToFile(filename);
	proc.on('end',() => {
		id3.write({
			artist: track.metadata.artist,
			title: track.metadata.title,
			image: track.metadata.image
		},filename);
		resolve(track);
	});
});

export const getVideoURLs = async (input:string,type:string = 'track'):Promise<BasicTrack[]> => {
	if(type==='playlist'){
		const playlist = await ytpl(input,{});
		return playlist.items.map((item:any):{url:string} => ({url: item.url_simple}));
	}else if(type==='track'){
		if(/^[a-zA-Z0-9\-_]+$/.test(input)) input = VIDEO_URL+input;
		return [{url: input}];
	}
};
export const getInfos = (datas:BasicTrack[],numberOfParallelRequests:number = defaultNumberOfParallelRequests):Promise<BasicTrackWithInfo>[] => {
	return processInChunks(chunkArray(datas,numberOfParallelRequests),async data =>
		Object.assign({},data,await getInfoByURL(data)/* TODO: .catch(err => err)*/)
	);
};
export const getMetadatas = (datas:BasicTrackWithInfo[],numberOfParallelRequests:number = defaultNumberOfParallelRequests):Promise<Track>[] => {
	return processInChunks(chunkArray(datas,numberOfParallelRequests),async data => {
		const basicMetadata = guessMetadata(data.info.title);
		
		const q = basicMetadata.artist + ' ' + basicMetadata.title + ' album cover';
		/* TODO: handle error */
		const covers = await getImages(q);
		const stream = request(covers[0]);
		const readStream = stream.pipe(new PassThrough());
		const contentType = await (new Promise(resolve => {
			stream.on('response',(response:any) => {
				resolve(response.headers['content-type']);
			});
		}));
		const extension = mimeTypes.extension(contentType);
		const tempFilePath = await (new Promise<string>((resolve,reject) => {
			tmp.file({postfix: '.'+extension, discardDescriptor: true},(err:Error,path:string,fd:undefined,cleanup:()=>void) => {
				const writeStream = readStream.pipe(createWriteStream(path));
				writeStream.on('finish',() => {
					resolve(path);
				});
			});
		}));
		const imageExtension = {image: tempFilePath};

		const metadata = Object.assign(basicMetadata,imageExtension);
		return Object.assign({},data,{metadata: metadata});
	});
};
export const saveTracks = (datas:Track[],numberOfParallelRequests:number = defaultNumberOfParallelRequests):Promise<Track>[] => {
	return processInChunks(chunkArray(datas,numberOfParallelRequests),
		data => saveTrack(data)
	);
};
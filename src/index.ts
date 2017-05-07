/*--- import packages what are needed for the basic input checking ---*/
const info:any = require('../package.json');
import * as util from 'util';
import {createOption,createProgram,ParsingErrors,ParsingWarnings} from 'commandy';
import * as chalk from 'chalk';



/*--- define program behavior ---*/
const coverOption = createOption('-c, --cover','try to find a cover of the song');

const trackProgram = createProgram('<url>')
	.description('download single track')
	.option(coverOption)

const playlistProgram = createProgram('<url>')
	.description('download whole playlist')
	.option('-a, --artist <artist-name>','default value for artist')
	.option('-A, --album <album-name>','treats playlist as album')
	.option(coverOption)

const mainProgram = createProgram()
	.command('track',trackProgram)
	.command('playlist',playlistProgram)
	// TODO: .option('-h, --help','output help',{inheritance: true})

const input = mainProgram.parse(process.argv.slice(2));



/*--- error on syntactically wrong input ---*/
if(input.errors.length > 0){
	input.errors.forEach(error => {
		console.error(chalk.red('err'),util.inspect(error,{depth: null}));
	});
	process.exit();
}



/*--- error if it haven't invoked a right program ---*/
if(input.program!==trackProgram && input.program!==playlistProgram){
	console.error(chalk.red('err'),'invalid command!');
	process.exit();
}



/*--- else it's good; do the task ---*/
import ffmpeg = require('fluent-ffmpeg');
import ytdl = require('ytdl-core');
const ytpl:any = require('ytpl');
import sanitizeFilename = require('sanitize-filename');
import tmp = require('tmp');
import request = require('request');
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
	const proc = ffmpeg(ytdl.downloadFromInfo(track.info,{format: highestAudioBitrateFormat}));
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
const getVideoURLs = async (input:string,type:string = 'track'):Promise<BasicTrack[]> => {
	if(type==='playlist'){
		const playlist = await ytpl(input,{});
		return playlist.items.map((item:any):{url:string} => ({url: item.url_simple}));
	}else if(type==='track'){
		if(/^[a-zA-Z0-9\-_]+$/.test(input)) input = VIDEO_URL+input;
		return [{url: input}];
	}
};
const getInfos = (datas:BasicTrack[],numberOfParallelRequests:number = defaultNumberOfParallelRequests):Promise<BasicTrackWithInfo>[] => {
	return processInChunks(chunkArray(datas,numberOfParallelRequests),async data =>
		Object.assign({},data,await getInfoByURL(data)/* TODO: .catch(err => err)*/)
	);
};
const getMetadatas = (datas:BasicTrackWithInfo[],numberOfParallelRequests:number = defaultNumberOfParallelRequests):Promise<Track>[] => {
	return processInChunks(chunkArray(datas,numberOfParallelRequests),async data => {
		const basicMetadata = guessMetadata(data.info.title);
		
		const imageExtension = await (async function(){
			if(input.options.cover){
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
				return {image: tempFilePath};
			}else{
				return {};
			}
		})();

		const metadata = Object.assign(basicMetadata,imageExtension);
		return Object.assign({},data,{metadata: metadata});
	});
};
const saveTracks = (datas:Track[],numberOfParallelRequests:number = defaultNumberOfParallelRequests):Promise<Track>[] => {
	return processInChunks(chunkArray(datas,numberOfParallelRequests),
		data => saveTrack(data)
	);
};

(async function(){
	const inputType = input.program===playlistProgram ? 'playlist' : 'track';
	const basicTracks = await getVideoURLs(input.arguments.url,inputType);
	console.log('Found '+inputType+'!');
	
	const basicTrackWithInfoPromises = getInfos(basicTracks);
	basicTrackWithInfoPromises.forEach(async basicTrackWithInfoPromise => {
		const basicTrackWithInfo = await basicTrackWithInfoPromise;
		console.log(chalk.green('I ')+basicTrackWithInfo.info.title);
	});
	const infos = await Promise.all(basicTrackWithInfoPromises);

	const trackPromises = getMetadatas(infos);
	trackPromises.forEach(async trackPromise => {
		const track = await trackPromise;
		console.log(chalk.green('M ')+track.info.title);
	});
	const tracks = await Promise.all(trackPromises);
	
	const trackDownloadPromises = saveTracks(tracks);
	trackDownloadPromises.forEach(async trackDownloadPromise => {
		const trackDownload = await trackDownloadPromise;
		console.log(chalk.green('D ')+trackDownload.info.title);
	});
	await Promise.all(trackDownloadPromises);

	console.log('Completed!');
}());
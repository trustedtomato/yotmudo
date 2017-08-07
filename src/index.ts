/*--- import packages what are needed for the basic input checking ---*/
import {Program} from 'commandy';
import * as chalk from 'chalk';

const error = (text:string) => {
	process.stderr.write(chalk.red('err') + ' ' + text + '\n');
};



/*--- define program behavior ---*/
const helpMessage =
`
Usage:
    ytmd track <url>              : Download a single track. The <url> can be the full URL of just the video ID.
    ytmd playlist <url> [options] : Download a whole playist. The <url> can be any type of URL which points to the playlist or just the playlist ID.
                                    --album[=albumname]   Set the album tag to [albumname]. [albumname] defaults to the playlist name. Alias: -a.
                                    --sync                Do not download track if there is an .mp3 with the same name. Alias: -s.
                                    --quick               Use the offline algorithm	to parse the tags. Try to avoid this option. Alias: -q.
                                    --verbose             Output verbose information about what's happening. Alias: -v.
ytmd --version : Output version info
ytmd --help    : Output help
`;


const trackProgram = new Program();

const playlistProgram = new Program([
	['a', 'album'],
	['s', 'sync'],
	['q', 'quick']
]);

const mainProgram = new Program({
	track: trackProgram,
	playlist: playlistProgram
},[
	['v', 'version'],
	['h', 'help']
]);

const input = mainProgram.parse(process.argv.slice(2));



/*--- handle input ---*/
(async function(){
	
	/*--- output version ---*/
	if(input.program === mainProgram && input.options.version.length > 0){
		console.log('ytmd ' + require('../package.json').version);
		return;
	}



	/*--- output help ---*/
	if(input.options.help.length > 0){
		if(input.program === mainProgram){
			console.log(helpMessage);
			return;
		}
	}



	console.log();
	/*--- error if it haven't invoked a right program ---*/
	if(input.program!==trackProgram && input.program!==playlistProgram){
		error('invalid command! see: ytmd --help');
		return console.log();
	}



	/*--- else it's good; do the task ---*/
	process.stdout.write('Importing modules...');
	const ffmpeg = await import('fluent-ffmpeg');
	const ytdl = await import('ytdl-core');
	const ytpl = await import('ytpl');
	const sanitizeFilename = await import('sanitize-filename');
	const offlineGuessMetadata = await import('guess-metadata');
	const {createWriteStream,open} = await import('fs');
	const {inspect} = await import('util');
	const readline = await import('readline');
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
	process.stdout.write('Defining functions...');

	const VIDEO_URL = 'https://www.youtube.com/watch?v=';



	/*--- define general purpose functions ---*/
	const delay = (delay:number) => new Promise(resolve => 
		setTimeout(resolve,delay)
	);
	const objEntries = (obj:{[key:string]:any}) =>
		Object.keys(obj).map((key):[string,any] =>
			[key,obj[key]]
		);
	/** Clones object but removes values which are falsy or empty arrays. */
	const compactObject = (obj:{[key:string]:any}) => {
		const compactObj:any = {};
		objEntries(obj).forEach(([key,value]) => {
			if(!value) return;
			if(Array.isArray(value) && value.length===0) return;
			compactObj[key] = value;
		});
		return compactObj;
	};
	const processConsecutively = <T,U>(arr:T[],processor:(x:T)=>Promise<U>,after:Promise<any> = Promise.resolve()):Promise<U>[] => {
		if(typeof arr==='undefined' || typeof arr[0]==='undefined'){
			return [];
		}
		const processed = after.then(() => processor(arr[0]));
		return [processed].concat(processConsecutively(arr.slice(1),processor,processed));
	};



	/*--- define functions for the downloads ---*/
	const completeYoutubeUrl = (url:string) =>
		(/^[a-zA-Z0-9\-_]+$/.test(url))
			? VIDEO_URL+url
			: url;

	const getYtdlInfoByURL = async (url:string,retries:number = 0,retryDelay:number = 1000):Promise<any/* ytdl.videoInfo */> => {
		return await ytdl.getInfo(url).catch(
			async () => {
				if(retries<=0){
					throw new Error('Cannot get info!');
				}
				return delay(retryDelay).then(async () => await getYtdlInfoByURL(url,retries-1,retryDelay))
			}
		)
	};
	const getYtdlProcess = (info:any/* ytdl.videoInfo */) => {
		const highestAudioBitrateFormat = info.formats.sort((formatA:any/* ytdl.videoFormat */,formatB:any/* ytdl.videoFormat */) => {
			const bitrateA = formatA.audioBitrate || 0;
			const bitrateB = formatB.audioBitrate || 0;
			return bitrateB - bitrateA;
		})[0];
		return ytdl.downloadFromInfo(info,{format: highestAudioBitrateFormat});
	};
	/** If able to create the path, return fd; else return undefined. */
	const getWritableFd = (path:string):Promise<number|undefined> => new Promise(resolve => {
		open(path,'wx',(err,fd) => {
			if(err){
				resolve(undefined);
			}else{
				resolve(fd);
			}
		});
	});
	/** Example: 'test.mp3' -> 'test #2.mp3' -> 'test #3.mp3' -> etc.; returns the first which doesn't exist. */
	const openWritableFile = async (path:string) => {
		const fd = await getWritableFd(path);
		if(typeof fd === 'number'){
			return{
				path: path,
				fd: fd
			};
		}else{
			const [pathWithoutExtension,extension] = path.split(/\.(?=[^.]+$)/);
			let i = 2;
			for(;; i++){
				const numberedPath = pathWithoutExtension+' #'+i+'.'+extension;
				const fd = await getWritableFd(numberedPath);
				if(typeof fd === 'number'){
					return{
						path: numberedPath,
						fd: fd
					};
				}
			}
		}
	};
	/** Fix metadata by looking things up on the internet. */
	const guessMetadata = async (fullTitle:string):Promise<{[key:string]:any}> => {

		const metadata = (function(){
			try{
				throw '';
			}catch(err){
				return offlineGuessMetadata(fullTitle);
			}
		}());

		return metadata;
	};
	const getFfmpegProcess = (info:any/* ytdl.videoInfo */,id3:{[key:string]:string}) => {
		let proc = ffmpeg(getYtdlProcess(info));
		objEntries(id3).forEach(([tag,value]) => {
			proc = proc.addOutputOption('-metadata',tag+'=' + value);
		});
		return proc;
	};
	const albumExtensionGenerator = function*(albumName:string|undefined){
		for(let trackNumber = 1;; trackNumber++){
			yield <{album?:string,track?:string}>(typeof albumName === 'undefined'
				? {}
				: {
					album: albumName,
					track: trackNumber
				}
			);
		}
	};
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);



	if(input.program===trackProgram){
		const url = completeYoutubeUrl(input.args[0]);

		process.stdout.write('Fetching information...');
		const info = await (getYtdlInfoByURL(url).catch(() => {
			error('did not found corresponding video! check the input & internet connection!');
		}));
		if(typeof info === 'undefined') return console.log();
		readline.clearLine(process.stdout, 0);
		readline.cursorTo(process.stdout, 0);

		const title = info.title;
		const uploader = info.author.name;

		process.stdout.write('Guessing metadata...');
		const metadata = Object.assign({
			artist: uploader,
			title: 'ID'
		}, await guessMetadata(title));
		readline.clearLine(process.stdout, 0);
		readline.cursorTo(process.stdout, 0);

		console.log(`${chalk.blue(title)} ${chalk.grey(`(${uploader})`)}`);
		console.log(`Metadata: ${chalk.yellow(inspect(compactObject(metadata),<any>{breakLength: Infinity}))}`);

		const generalTitle = `${metadata.artist} - ${metadata.title}`;

		const {path,fd} = await openWritableFile(sanitizeFilename(`${generalTitle}` +'.mp3'));
		const writeStream = createWriteStream(null, {fd});

		process.stdout.write('Downloading...');
		await (new Promise(resolve => {
			getFfmpegProcess(info,metadata)
				.on('error',(err:Error) => {
					readline.clearLine(process.stdout, 0);
					readline.cursorTo(process.stdout, 0);
					console.error(chalk.red('err'),err.message);
					resolve();
				})
				.on('end',() => {
					readline.clearLine(process.stdout, 0);
					readline.cursorTo(process.stdout, 0);
					console.log(`Filename: ${chalk.yellow(path)}`);
					resolve();
				})
				.format('mp3')
				.stream(writeStream,{end: true});
		}));
	}
	

	else if(input.program===playlistProgram){
		const url = input.args[0];
		const sync = input.options.sync.length > 0;
		const quick = input.options.quick.length > 0;
		const givenAlbumName = input.options.album[0];

		process.stdout.write('Fetching information...');
		const playlist = await (ytpl(url).catch(() => {
			error('did not found corresponding urls! check the input & internet connection!');
		}));
		if(typeof playlist === 'undefined') return console.log();
		readline.clearLine(process.stdout, 0);
		readline.cursorTo(process.stdout, 0);

		const albumName = typeof givenAlbumName === 'string'
			? givenAlbumName
			: input.options.album[0] === true
				? playlist.title
				: undefined;
		const albumExtensionIterator = albumExtensionGenerator(albumName);

		await Promise.all(processConsecutively(playlist.items,
			async ({title: originalTitle, author: {name: uploader}, url_simple: url}) => {
				const identifier = originalTitle;
				const filename = identifier + '.mp3';

				process.stdout.write('Guessing metadata...');
				const metadata = Object.assign(
					{
						artist: uploader,
						title: 'ID'
					},
					albumExtensionIterator.next().value,
					quick ? offlineGuessMetadata(originalTitle) : await guessMetadata(originalTitle)
				);
				readline.clearLine(process.stdout, 0);
				readline.cursorTo(process.stdout, 0);

				
				const openedFile = await (async function(){
					const basicPath = sanitizeFilename(filename);
					const basicFd = await getWritableFd(basicPath);
					if(typeof basicFd === 'number'){
						return{
							path: basicPath,
							fd: basicFd
						};
					}else if(!sync){
						return await openWritableFile(basicPath);
					}
				})();
				if(typeof openedFile === 'undefined'){
					return;
				}
				const {path,fd} = openedFile;
				const writeStream = createWriteStream(null,{fd});

				
				process.stdout.write('Downloading...');
				return await (new Promise(async resolve => {
					getYtdlInfoByURL(url).then(info => {
						getFfmpegProcess(info,metadata)
							.on('error',(err:Error) => {
								readline.clearLine(process.stdout, 0);
								readline.cursorTo(process.stdout, 0);
								console.error(chalk.red('err'),chalk.grey(`(${identifier})`),err.message);
								resolve();
							})
							.on('end',() => {
								readline.clearLine(process.stdout, 0);
								readline.cursorTo(process.stdout, 0);
								console.log(`${identifier} → ${chalk.yellow(path)}`);
								resolve();
							})
							.format('mp3')
							.stream(writeStream);
					}).catch(err => {
						console.error(chalk.red('err'),chalk.grey(`(${identifier})`),err.message);
						resolve();
					});
				}));
			}
		));
	}

	console.log();
}());
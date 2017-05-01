"use strict";
/// <reference path="../typings/index.d.ts" />
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');
const ytpl = require('ytpl');
const sanitizeFilename = require('sanitize-filename');
const guessMetadata = require("guess-metadata");
const VIDEO_URL = 'https://www.youtube.com/watch?v=';
const chunkArray = (arr, chunkLength) => {
    let i, j, temparray;
    const chunks = [];
    for (i = 0, j = arr.length; i < j; i += chunkLength) {
        chunks.push(arr.slice(i, i + chunkLength));
    }
    return chunks;
};
const delay = (delay) => new Promise(resolve => setTimeout(resolve, delay));
const getInfo = (url, retries, retryDelay) => ytdl.getInfo(url).catch((err) => {
    if (retries <= 0) {
        throw err;
    }
    return delay(retryDelay).then(() => getInfo(url, retries - 1, retryDelay));
});
const flattenArray = (chunks) => {
    return [].concat(...chunks);
};
const processChunks = (chunks, processor) => __awaiter(this, void 0, void 0, function* () {
    if (typeof chunks === 'undefined' || typeof chunks[0] === 'undefined') {
        return [];
    }
    const processedChunk = yield Promise.all(chunks[0].map(processor));
    const otherProcessedChunks = yield processChunks(chunks.slice(1), processor);
    return [processedChunk].concat(otherProcessedChunks);
});
const processInChunks = (arr, chunkLength, processor) => __awaiter(this, void 0, void 0, function* () {
    return flattenArray(yield processChunks(chunkArray(arr, chunkLength), processor));
});
const padStart = (originalString, targetLength, padString = ' ') => {
    targetLength = targetLength >> 0;
    if (originalString.length >= targetLength) {
        return originalString;
    }
    else {
        targetLength = targetLength - originalString.length;
        if (targetLength > padString.length) {
            padString += padString.repeat(targetLength / padString.length);
        }
        return padString.slice(0, targetLength) + originalString;
    }
};
exports.download = (input, options = {}) => __awaiter(this, void 0, void 0, function* () {
    let { output, errorOutput, formatError } = options;
    if (typeof output === 'undefined')
        output = process.stdout;
    if (typeof errorOutput === 'undefined')
        errorOutput = process.stderr;
    if (typeof formatError === 'undefined')
        formatError = (err) => 'ERROR ' + err.message;
    const urls = yield (function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (options.type === 'playlist') {
                /* TODO: handle error */
                const playlist = yield ytpl(input, {});
                return playlist.items.map((item) => item.url_simple);
            }
            else {
                if (/^[a-zA-Z0-9\-_]+$/.test(input))
                    input = VIDEO_URL + input;
                return [input];
            }
        });
    }());
    const chunkLength = 5;
    const infoRetries = 1;
    const infoRetryDelay = 1000;
    let i = 1;
    const maxIterationStringLength = String(urls.length).length;
    const infos = (yield processInChunks(urls, chunkLength, (url) => __awaiter(this, void 0, void 0, function* () {
        const info = yield getInfo(url, infoRetries, infoRetryDelay).catch(err => err);
        const prefix = `(${padStart(String(i), maxIterationStringLength, '0')}/${urls.length})`;
        if (info instanceof Error) {
            errorOutput.write(prefix + ' ' + formatError(info) + '\n');
        }
        else {
            output.write(prefix + ' ' + info.title + '\n');
        }
        i++;
        return info;
    }))).filter(info => {
        return !(info instanceof Error);
    });
    const metadatas = new Map();
    infos.forEach(info => {
        metadatas.set(info, guessMetadata(info.title));
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
    (yield processInChunks(Array.from(metadatas), chunkLength, ([info, metadata]) => new Promise(resolve => {
        console.log('Started ' + metadata.title + '...');
        const proc = new ffmpeg(ytdl.downloadFromInfo(info, { filter: 'audioonly' }));
        proc.addOutputOption('-metadata', 'artist=' + metadata.artist);
        proc.addOutputOption('-metadata', 'title=' + metadata.title);
        proc.saveToFile(sanitizeFilename(metadata.artist + ' - ' + metadata.title + '.mp3'));
        proc.on('end', () => {
            console.log('Finished ' + metadata.title);
            resolve();
        });
    })));
});

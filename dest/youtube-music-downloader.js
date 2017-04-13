/// <reference path="../typings/index.d.ts" />
"use strict";
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
const jsdom = require('jsdom');
const tmp = require('tmp-promise');
const urlLib = require("url");
const parseFullTitle = require("./parse-fulltitle");
const VIDEO_URL = 'https://www.youtube.com/watch?v=';
exports.download = (input, options = {}) => __awaiter(this, void 0, void 0, function* () {
    const infos = yield (function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (/^[a-zA-Z0-9\-_]+$/.test(input)) {
                input = VIDEO_URL + input;
            }
            console.log('Searching for "' + input + '"...');
            const parsedUrl = urlLib.parse(input);
            if (parsedUrl.pathname === '/watch') {
                const streamInfo = yield ytdl.getInfo(input);
                console.log('Found track!');
                return [streamInfo];
            }
            const playlist = yield ytpl(input);
            console.log('Found playlist!');
            return playlist.items.map((item) => {
                const streamInfo = ytdl.getInfo(item.url_simple);
                return streamInfo;
            });
        });
    }());
    /*
    streamsWithInfo.forEach(([stream]) => {
        stream.on('error',(err:Error) => {
            console.error(err.message);
        });
    });
    */
    const metadatas = new Map();
    yield infos.reduce((promise, info) => {
        const parsedFullTitle = parseFullTitle(info.title);
        if (typeof options.validator === 'function') {
            return promise.then(() => {
                return Promise.resolve(options.validator(parsedFullTitle, info.title)).then((metadata) => {
                    metadatas.set(info, metadata);
                }).catch(err => {
                    metadatas.set(info, parsedFullTitle);
                });
            });
        }
    }, Promise.resolve());
    return Promise.all(Array.from(metadatas).map(([info, metadata]) => new Promise(resolve => {
        console.log('Started ' + metadata.title + '...');
        const proc = new ffmpeg(ytdl.downloadFromInfo(info, { filter: 'audioonly' }));
        proc.addOutputOption('-metadata', 'artist=' + metadata.artist);
        proc.addOutputOption('-metadata', 'title=' + metadata.title);
        proc.saveToFile(metadata.artist + ' - ' + metadata.title + '.mp3');
        proc.on('end', () => {
            console.log('Finished ' + metadata.title);
            resolve();
        });
    })));
});

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
const jsdom = require('jsdom');
const tmp = require('tmp-promise');
const path = require("path");
const fs = require("fs");
const urlLib = require("url");
const parseFullTitle = require("./parse-fulltitle");
const VIDEO_URL = 'https://www.youtube.com/watch?v=';
const inputToId = (input) => {
    if (/^[a-zA-Z0-9\-_]+$/.test(input)) {
        return input;
    }
    else {
        const parsedUrl = urlLib.parse(input, true);
        if (parsedUrl.pathname === '/watch') {
            return parsedUrl.query.v;
        }
        else if (/^\/embed\//.test(parsedUrl.pathname)) {
            return parsedUrl.pathname.replace(/^\/embed\//, '');
        }
    }
};
exports.download = (input, options = {}) => __awaiter(this, void 0, void 0, function* () {
    const id = inputToId(input);
    const streams = [ytdl(VIDEO_URL + id, { filter: 'audioonly' })];
    streams.forEach(stream => {
        stream.on('error', (err) => {
            console.error(err);
        });
    });
    const tmpDir = yield tmp.dir();
    const filePathsWithFullTitles = new Map(yield Promise.all(streams.map((stream) => __awaiter(this, void 0, void 0, function* () {
        const fullTitle = yield (new Promise(resolve => {
            stream.on('info', (info) => {
                resolve(info.title);
            });
        }));
        const p = new Promise(resolve => {
            const filePath = path.join(tmpDir.path, fullTitle + '.mp4');
            stream.pipe(fs.createWriteStream(filePath));
            stream.on('end', () => {
                resolve([filePath, fullTitle]);
            });
        });
        return p;
    }))));
    const filePathsWithMetadatas = new Map(yield Promise.all(Array.from(filePathsWithFullTitles).map(([path, fullTitle]) => new Promise(resolve => {
        const parsedFullTitle = parseFullTitle(fullTitle);
        if (typeof options.validator === 'function') {
            Promise.resolve(options.validator(parsedFullTitle, fullTitle)).then(metadata => {
                resolve([path, metadata]);
            });
        }
    }))));
    return Promise.all(Array.from(filePathsWithMetadatas).map(([filePath, metadata]) => new Promise(resolve => {
        const proc = new ffmpeg(filePath);
        proc.addOutputOption('-metadata', 'artist=' + metadata.artist);
        proc.addOutputOption('-metadata', 'title=' + metadata.title);
        proc.saveToFile(metadata.artist + ' - ' + metadata.title + '.mp3');
        proc.on('end', () => {
            resolve();
        });
    })));
});

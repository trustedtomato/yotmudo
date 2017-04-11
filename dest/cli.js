#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require('commander');
const prompt = require('prompt');
const colors = require('colors/safe');
const youtube_music_downloader_1 = require("./youtube-music-downloader");
program
    .version('0.0.1')
    .usage('<url>')
    .option('-f, --force', 'use the executed attributes, never prompt')
    .parse(process.argv);
if (program.args.length === 0) {
    program.help();
}
else {
    youtube_music_downloader_1.download(program.args[0], {
        validator: program.force
            ? null
            : ({ artist, title }, fullTitle) => new Promise(resolve => {
                console.log(colors.gray('Raw title: ') + fullTitle);
                prompt.message = '';
                prompt.delimiter = ':';
                prompt.start();
                prompt.get({ properties: {
                        artist: {
                            description: 'Artist',
                            default: artist
                        },
                        title: {
                            description: 'Title',
                            default: title
                        }
                    } }, (err, result) => {
                    prompt.stop();
                    if (err) {
                        resolve({ artist, title });
                    }
                    else {
                        resolve({ artist: result.artist, title: result.title });
                    }
                });
            })
    }).then(() => {
        console.log('Completed!');
    });
}

/// <reference path="../typings/index.d.ts" />
"use strict";
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ytdl = require("ytdl-core");
const jsdom = require("jsdom");
const urlLib = require("url");
const parseFullTitle = require("./parse-fulltitle");
const getVideoPageUrlById = (id) => {
    return 'https://www.youtube.com/watch?v=' + id;
};
const inputToId = (url) => {
    const hasCorrectProtocol = (typeof urlLib.parse(url).protocol === 'string'
        ? /^[a-z]*\:$/.test(urlLib.parse(url).protocol)
        : false);
    if (url.includes('/')) {
        if (hasCorrectProtocol) {
            url = url.split('://')[1];
        }
        const refinedUrl = 'https://youtube.com' + url.slice(url.indexOf('/'));
        const parsedRefinedUrl = urlLib.parse(refinedUrl, true);
        if (parsedRefinedUrl.pathname === '/watch') {
            return parsedRefinedUrl.query.v;
        }
    }
    return url;
};
const fetchFullTitleAlternative = (function () {
    const separators = '\u002D\u007E\u058A\u1806\u2010\u2011\u2012\u2013\u2014\u2015\u2053\u207B\u208B\u2212\u301C\u3030';
    const extractFullTitleFromElements = document => {
        const eowTitle = document.getElementById('eow-title');
        if (eowTitle !== null) {
            return eowTitle.textContent.trim();
        }
        const ogMetaTitle = document.querySelector('meta[property="og:title"]');
        if (ogMetaTitle !== null) {
            return ogMetaTitle.getAttribute('content').trim();
        }
        const metaTitle = document.querySelector('meta[name="title"]');
        if (metaTitle !== null) {
            return metaTitle.getAttribute('content').trim();
        }
    };
    const getFullTitleFromDocumentTitle = documentTitle => {
        if (/youtube\s*$/i.test(documentTitle)) {
            const regex = eval(`/\s*[${separators}]\s*youtube\s*$/i`);
            return documentTitle.replace(regex, '');
        }
    };
    const getFullTitleFromDocument = document => {
        return extractFullTitleFromElements(document) || getFullTitleFromDocumentTitle(document.title);
    };
    return (id) => new Promise(resolve => {
        jsdom.env(getVideoPageUrlById(id), (err, window) => {
            const document = window.document;
            const fullTitle = getFullTitleFromDocument(document);
            resolve(fullTitle);
        });
    });
}());
const saveToFile = (stream, { artist, title }, isVideo) => {
    const fileName = artist + ' - ' + title;
    if (!isVideo) {
        const proc = new ffmpeg({ source: stream });
        proc.addOutputOption('-metadata', 'artist=' + artist);
        proc.addOutputOption('-metadata', 'title=' + title);
        proc.saveToFile(fileName + '.mp3');
        proc.on('end', () => {
        });
    }
    else {
        stream.pipe(fs.createWriteStream(fileName + '.mp4'));
    }
};
const downloadYoutubeMusic = (input, options = {}) => {
    const id = inputToId(input);
    const stream = ytdl.ytdl(getVideoPageUrlById(id), !options.video
        ? { filter: 'audioonly' }
        : {});
    stream.on('error', (err) => {
        console.error(err);
    });
    const fullTitlePromise = new Promise(resolve => {
        stream.on('info', info => {
            if (!info.title) {
                fetchFullTitleAlternative(id).then(resolve);
            }
            else {
                resolve(info.title);
            }
        });
    });
    fullTitlePromise.then(fullTitle => {
        const parsedFullTitle = parseFullTitle(fullTitle);
        if (typeof options.validator === 'function') {
            Promise.resolve(options.validator(parsedFullTitle, fullTitle)).then(metadata => {
                saveToFile(stream, metadata, options.video);
            });
        }
    });
};
module.exports = downloadYoutubeMusic;

import * as youtubeMusicDownloader from './youtube-music-downloader';
export declare const download: (input: string, options?: {
    validator?: (parsedFullTitle: youtubeMusicDownloader.BasicMetadata, fullTitle: string) => youtubeMusicDownloader.Metadata | Promise<youtubeMusicDownloader.Metadata>;
}) => Promise<{}[]>;

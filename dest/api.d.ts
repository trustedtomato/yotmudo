import * as youtubeMusicDownloader from './youtube-music-downloader';
export declare const download: (input: string, options?: {
    output?: youtubeMusicDownloader.BasicWritableStream;
    errorOutput?: youtubeMusicDownloader.BasicWritableStream;
    formatError?: (error: Error) => string;
    type?: "playlist" | "track";
    validator?: (parsedFullTitle: youtubeMusicDownloader.BasicMetadata, fullTitle: string) => youtubeMusicDownloader.Metadata | Promise<youtubeMusicDownloader.Metadata>;
}) => Promise<void>;

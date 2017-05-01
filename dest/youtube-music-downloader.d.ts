/// <reference path="../typings/index.d.ts" />
export interface BasicMetadata {
    artist: string;
    title: string;
}
export interface Metadata extends BasicMetadata {
}
export interface BasicWritableStream {
    write: (chunk: string) => any;
}
export declare const download: (input: string, options?: {
    output?: BasicWritableStream;
    errorOutput?: BasicWritableStream;
    formatError?: (error: Error) => string;
    type?: "playlist" | "track";
    validator?: (parsedFullTitle: BasicMetadata, fullTitle: string) => Metadata | Promise<Metadata>;
}) => Promise<void>;

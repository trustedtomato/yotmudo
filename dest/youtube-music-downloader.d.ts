/// <reference path="../typings/index.d.ts" />
export interface BasicMetadata {
    artist: string;
    title: string;
}
export interface Metadata extends BasicMetadata {
}
export declare const download: (input: string, options?: {
    validator?: (parsedFullTitle: BasicMetadata, fullTitle: string) => Metadata | Promise<Metadata>;
}) => Promise<{}[]>;

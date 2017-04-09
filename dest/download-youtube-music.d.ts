/// <reference path="../typings/index.d.ts" />
declare const downloadYoutubeMusic: (input: string, options?: {
    video?: boolean;
    validator?: (parsedFullTitle: any, fullTitle: any) => any;
}) => void;
export = downloadYoutubeMusic;

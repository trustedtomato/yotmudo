import * as urlLib from 'url';

const request = (url:string) => new Promise((resolve, reject) => {
	const urlParts = urlLib.parse(url);
	const lib = urlParts.protocol === 'http:' ? require('http') : require('https');

	console.log(url);

	lib.get({
		host: urlParts.host,
		path: urlParts.path,
		headers: {
			'Accept-Language': 'en-US'
		}
	}, (resp:any) => {
		if(resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location){
			request(urlLib.resolve(url, resp.headers.location)).then(resolve).catch(reject);
			resp.destroy();
		}else if(resp.statusCode === 200){
			let body = '';
			resp.on('data', (chunk:any) => {
				body += chunk;
			});
			resp.on('end', () => {
				resolve(body);
			});
			resp.on('error', (err:any) => {
				reject(err);
			});
		}else{
			reject(resp);
		}
	});
});

export default request;
const request:any = require('request');
const Jsdom:any = require('jsdom').JSDOM;

export = (q:string):Promise<string[]> => new Promise((resolve,reject) => {
	const url = 'https://www.google.com/search?source=lnms&tbm=isch&sa=X&q='+encodeURIComponent(q);
	request({
		url: url,
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
		}
	},(err:Error,response:any,body:string) => {
		const dom = new Jsdom(body);
		const document = dom.window.document;
		const urls = Array.from(document.querySelectorAll('.rg_meta'))
			.map((rgMetaElement:any) => JSON.parse(rgMetaElement.textContent).ou);
		resolve(urls);
	});
});
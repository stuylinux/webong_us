const http = require('http');
const main = require('./main');

const port = 5000;
const ip = 'localhost';

const server = http.createServer((req, res) => {
	main.handleRequest(req, res);
});

server.listen(port, ip, () => {
	console.log(`Server running at http://${ip}:${port}/`);
});
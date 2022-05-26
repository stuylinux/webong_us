const http = require('http');
const express = require('express');
const nunjucks = require('nunjucks');

nunjucks.configure('templates', { autoescape : true });

const port = 5000;
const app = express();

app.get('/', (req, res) => {
	res.writeHead(200, {'Content-Type' : 'text/html'});
	res.end(nunjucks.render('index.html'));
});

app.use('/static', express.static('static'));
app.use(express.static('favicon'));

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}/`);
});
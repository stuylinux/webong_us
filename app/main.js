(function() {
    const nunjucks = require('nunjucks');
    nunjucks.configure('templates', { autoescape: true });

    module.exports.handleRequest = function (req, res) {
        res.writeHead(200, {
		    'Content-Type' : 'text/html'
	    });
	    res.end(nunjucks.render('index.html', { name: 'Cameron' }));
    }
}());
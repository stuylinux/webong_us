(function() {
    const nunjucks = require('nunjucks');
    nunjucks.configure('templates', { autoescape: true });

    const split_url = function (string) {
        let i = string.indexOf('?');
        if (i !== -1) {
            return [string.substring(0, i), string.substring(i + 1)];
        } else {
            return [string, ''];
        }
    }

    const handleStaticResourceRequest = function (req, res) {
        res.writeHead(200, {});
        res.end('/static access');
    }

    const page404 = function (response) {
        response.writeHead(404, {});
        response.end("Page not found");
    };

    const home = function (req, res) {
        res.writeHead(200, {});
	    res.end(nunjucks.render('index.html', { name: 'Cameron' }));
    };

    module.exports.handleRequest = function (req, res) {
        if (req.url.substring(0,8) == '/static/') {
            handleStaticResourceRequest(req, res);
        } else {
            res.setHeader('Content-Type', 'text/html');
            switch (split_url(req.url)[0]) {
                case '/':
                    home(req, res);
                    break;
                default:
                    res.writeHead(301, {Location : '/'});
                    res.end();
                    break;
            }
        }
    }
}());
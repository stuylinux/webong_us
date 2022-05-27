const http = require('http');
const express = require('express');
const nunjucks = require('nunjucks');
const websockets = require('ws');

nunjucks.configure('templates', { autoescape : true });

const port = 5000;
const app = express();

const ws_s = new websockets.Server({ port : 47777 });
const clients = new Map();

const colorArray = ['#c51111', '#123ed1', '#117f2d', '#ed54ba', '#ef7d0d', '##F6F657', '#3f474e', '#6b2fbb', '#71491e', '#50ef39'];

ws_s.on('connection' , (ws) => {
	const id = genRandomID();
	let color = '';
	for (let i = 0; i < colorArray.length; i++) {
		let good = true;
		clients.forEach((clientData, client, clients) => {
			if (clientData.color == colorArray[i]) { good = false; }
		});
		if (good) {
			color = colorArray[i];
			break;
		}
	}
	const playerData = {
		'host' : clients.size == 0,
		'color' : color,
		'id' : id,
		'name' : null,
		'pos' : [-1, -1],
		'role' : 'crewmate',
		'kill_cooldown' : -1,
		'sab_cooldown' : -1
	}
	clients.set(ws, playerData);

	ws.on('message', (messageString) => {
		const message = JSON.parse(messageString);
		/* Print message as string */
		//console.log(JSON.stringify(message));
		const playerData = clients.get(ws);
		if (message.type == 'init') {
			playerData['pos'] = [65, 10];
			playerData['name'] = message.name;

			let cont = true;
			clients.forEach((clientData, client, clients) => {
				//console.log(clientData.name, playerData.name, );
				if (client != ws && clientData.name == playerData['name'] && cont) {
					if (clientData.name.indexOf('(') != -1) {
						playerData['name'] += "(" + (parseInt(clientData.name.substring(clientData.name.indexOf('(') + 1, clientData.name.indexOf(')'))) + 1)+ ")";
					} else {
						playerData['name'] += "(2)";
					}
					cont = false;
				}
			});
			//console.log(playerData);
			if (playerData['name'] != message.name) {
				ws.send(JSON.stringify({
					'type' : 'rename',
					'newName' : playerData['name']
				}));
			}

			clients.set(ws, playerData);

			console.log('New Player! name=', message.name, '#num =', clients.size);

			var playersDataArray = [];
			clients.forEach((clientData, client, clients) => {
				playersDataArray.push(clientData);
			});
			ws.send(JSON.stringify({
				'type' : 'returnplayers',
				'data' : playersDataArray
			}));

			const outboundAll = JSON.stringify({
				'type' : 'newplayer',
				'player_data' : playerData
			});
			clients.forEach((clientData, client, clients) => {
				client.send(outboundAll);
			});
		} else if (message.type == 'update') {
			let data = clients.get(ws);
			data.pos = message.data.pos;

			clients.set(ws, data);
			clients.forEach((clientData, client, clients) => {
				if (client != ws) {
					client.send(JSON.stringify({
						'type' : 'updateplayer',
						'player_data' : data
					})); 
				}
			});
		}
	})

	ws.on('close', () => {
		const playerData = clients.get(ws);

		let v = null;
		if (playerData.host == true) {
			clients.forEach((clientData, client, clients) => {
				if (v === null && client != ws) {
					v = clientData;
					v.host = true;
				}
			});
		}

		const outboundAll = JSON.stringify({
			'type' : 'deleteplayer',
			'player_data' : playerData,
			'newhost' : (v === null) ? null : clients.get(v)
		});
		clients.forEach((clientData, client, clients) => {
			client.send(outboundAll);
		});

		console.log(clients.get(ws).name, 'disconnected! Players Remaining:', clients.size - 1);
		clients.delete(ws);

	});
});

function genRandomID() {
	return Math.trunc(Math.random() * 4294967296 /* 2^32 */);
}

app.get('/', (req, res) => {
	res.writeHead(200, {'Content-Type' : 'text/html'});
	res.end(nunjucks.render('index.html'));
});

app.use('/static', express.static('static'));
app.use(express.static('favicon'));

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}/`);
});
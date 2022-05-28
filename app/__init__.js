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
var gameIsStarted = false;

var gameInterval;
var gameTimer;

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
		'cooldowns' : [-1, -1],
		'in_vent' : false,
		'alive' : true,
	}
	clients.set(ws, playerData);

	ws.on('message', (messageString) => {
		const message = JSON.parse(messageString);
		/* Print message as string */
		console.log(JSON.stringify(message));
		const playerData = clients.get(ws);
		if (message.type == 'init') {
			playerData['pos'] = [65, 10];
			playerData['name'] = message.name;

			let namepresent = '';
			let namepresentdupe = '';
			clients.forEach((clientData, client, clients) => {
				//console.log(clientData.name, playerData.name, );
				let checkname = '';
				if (clientData.name.indexOf('(') != -1) {
					checkname = clientData.name.substring(0, clientData.name.indexOf('('));
				} else {
					checkname = clientData.name;
				}
				if (client != ws && checkname == playerData['name']) {
					if (clientData.name.indexOf('(') != -1) {
						namepresentdupe = clientData.name;
					} else {
						namepresent = clientData.name;
					}
				}
			});
			
			if (namepresentdupe != '') {
				playerData['name'] += '(' + 
				(parseInt(namepresentdupe.substring(namepresentdupe.indexOf('(') + 1, namepresentdupe.indexOf(')'))) + 1) + ')';
			} else if (namepresent != '') {
				playerData['name'] += '(2)';
			}
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
			data.in_vent = message.data.in_vent;

			clients.set(ws, data);
			clients.forEach((clientData, client, clients) => {
				if (client != ws) {
					client.send(JSON.stringify({
						'type' : 'updateplayer',
						'player_data' : data
					})); 
				}
			});
		} else if (message.type == 'startgame') {
			let clientData = clients.get(ws);
			if (clientData.host && !gameIsStarted /*&& clients.size >= 4*/) {
				gameIsStarted = true;
				let impostorIndexes = (clients.size < 6) ? [randInt(clients.size)] : getDistinctRandomInts(0, clients.size);
				let clientsArray = [];
				clients.forEach((clientData, client, clients) => {
					clientData.role = 'crewmate';
					clientsArray.push([clientData, client]);
				});

				for (let i = 0; i < impostorIndexes.length; i++) {
					let clientData = clientsArray[impostorIndexes[i]][0];
					let client = clientsArray[impostorIndexes[i]][1];
					clientData.role = 'impostor';
					clientData.cooldowns[0] = 25;
					clientData.cooldowns[1] = 35;
					//console.log(clientData);
					//console.log(client);
					clients.set(client, clientData);
				}
				
				/*const everyMessage = JSON.stringify({
					'type' : 'startgame',
					'ok' : true,
				});*/
				clients.forEach((clientData, client, clients) => {
					client.send(JSON.stringify({
						'type' : 'startgame',
						'ok' : true,
						'new_player_data' : clientData,
					}));
				});

				gameTimer = 0;
				gameIsStarted = true;
				gameNextSecond();
				setInterval(gameNextSecond, 1000);
			} else {
				ws.send(JSON.stringify({
					'type' : 'startgame',
					'ok' : false,
					'message' : 'Not enough players!',
				}));
			}
		}
	})

	ws.on('close', () => {
		const playerData = clients.get(ws);

		let v = null;
		if (playerData.host == true) {
			clients.forEach((clientData, client, clients) => {
				if (v === null && client != ws) {
					v = clients.get(client);
					v.host = true;
					clients.set(client, v);
				}
			});
		}

		const outboundAll = JSON.stringify({
			'type' : 'deleteplayer',
			'player_data' : playerData,
			'newhost' : (v === null) ? null : v
		});
		clients.forEach((clientData, client, clients) => {
			client.send(outboundAll);
		});

		console.log(clients.get(ws).name, 'disconnected! Players Remaining:', clients.size - 1);
		clients.delete(ws);

		if (clients.size == 0) {
			gameIsStarted = false;
			clearInterval(gameInterval);
			//clients = new Map();
			gameTimer = -1;
		}
	});
});

function gameNextSecond() {
	clients.forEach((clientData, client, clients) => {
		if (clientData.role == 'impostor' && gameTimer != 0) {
			//console.log(clientData);
			if (!clientData.in_vent && clientData.cooldowns[0] > 0) {clientData.cooldowns[0]--;}
			if (!clientData.in_vent && clientData.cooldowns[1] > 0) {clientData.cooldowns[1]--;}

			clients.set(client, clientData);
			client.send(JSON.stringify({
				'type' : 'updateplayer',
				'player_data' : clientData,
			}));
		}
	});

	gameTimer++;
}

function genRandomID() {
	return Math.trunc(Math.random() * 4294967296 /* 2^32 */);
}

function getDistinctRandomInts(maxexcl) {
	let r = randInt(maxexcl);
	let r2 = randInt(maxexcl - 1);
	if (r2 >= r) { r2++; }

	return [r, r2];
}

function randInt(maxexcl) {
	return Math.trunc(Math.random() * maxexcl);
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
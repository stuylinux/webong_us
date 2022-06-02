const http = require('http');
const express = require('express');
const nunjucks = require('nunjucks');
const websockets = require('ws');
const { table } = require('console');
const { clearInterval } = require('timers');

nunjucks.configure('templates', { autoescape : true });

const port = 5000;
const host = 'localhost';
const app = express();

const ws_s = new websockets.Server({ port : 47777 });
const clients = new Map();

const colorArray = ['#c51111', '#123ed1', '#117f2d', '#ed54ba', '#ef7d0d', '#F6F657', '#3f474e', '#6b2fbb', '#71491e', '#50ef39'];
var gameIsStarted = false;

var gameInterval = -1;
var gameTimer;

var meetingTimer;
var meetingInterval = -1;

var sabotageInterval = -1;
var sabotageTimer;
var sabotageType = -1;
var sabotageFixed = [false, false];

var votes;

ws_s.on('connection' , (ws) => {
	if (clients.size == 0) {
		sabotageType = -1;
	}

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
		'has_voted' : false,
		'tasksdone' : false,
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
		} else if (message.type == 'gameaction') {
			switch(message.actiontype) {
				case 'tasksdone':
					let clientData = clients.get(ws);
					clientData.tasksdone = true;
					clients.set(ws, clientData);
					let everyCrewmateTasksDone = true;
					clients.forEach((cData, client, clients) => {
						if (everyCrewmateTasksDone && cData.role == 'crewmate' && cData.tasksdone == false) {
							everyCrewmateTasksDone = false;
						}
					});
					if (everyCrewmateTasksDone) {
						const gameOverMessage = JSON.stringify({
							'type' : 'gameover',
							'winner' : 'crewmate',
						});
						clients.forEach((cData, client, clients) => {
							client.send(gameOverMessage);
							gameIsStarted = false;
							clearInterval(gameInterval);
							gameTimer = -1;
						});	
					}
					break;
				case 'meeting':
					if (meetingTimer > 0) { break; }
				case 'report':
					// New scope so i can declare vars
					{
						votes = new Map();
						votes.set('__NONE__', 0);
						clients.forEach((clientData, client, clients) => {
							votes.set(clientData.name, 0);
							clientData.has_voted = false;
							clients.set(client, clientData);
						});
						let bodydata = message.body_data;
						const messageToSend = JSON.stringify({
							'type' : 'report',
							'body_data' : bodydata,
							'reporter' : clients.get(ws),
						});
						console.log(messageToSend);
						clients.forEach((cData, client, clients) => {
							client.send(messageToSend);
						})
						clearInterval(gameInterval);
						clearInterval(meetingInterval);
					}
					break;
				case 'vote':
					// New scope
					{
						let clientData = clients.get(ws);
						if (clientData.has_voted == false && clientData.alive) {
							clientData.has_voted = true;
							clients.set(ws, clientData);

							votes.set(message.voted_player_name, 1 + votes.get(message.voted_player_name));

							let everyPlayerVoted = true;
							clients.forEach((cData, client, clients) => {
								if (cData.alive == true && cData.has_voted == false) {
									everyPlayerVoted = false;
								}
							});
							//console.log(everyPlayerVoted);
							if (everyPlayerVoted) {
								calculateVotes();
							}
						}
					}
					break;
				case 'sabotage':
					{
						let clientData = clients.get(ws);
						if (clientData.role != 'impostor' || clientData.cooldowns[0] != 0 || sabotageType != -1) {
							break;
						}
						clientData.cooldowns[0] = 25;
						clients.set(ws, clientData);
						ws.send(JSON.stringify({
							'type' : 'updateplayer',
							'player_data' : clientData,
						}));
						sabotageType = message.sab_num;
						sabotageTimer = [null, 30, 25, -1, 6][sabotageType];
						sabotageInterval = setInterval(sabotageIntervalFunction, 1000);
						const sabTypeMessage = JSON.stringify({
							'type' : 'sabotage',
							'sab_num' : sabotageType,
						});
						const sabTimerMessage = JSON.stringify({
							'type' : 'sabotage_time',
							'time' : sabotageTimer,
						});
						clients.forEach((cData, client, clients) => {
							client.send(sabTypeMessage);
							client.send(sabTimerMessage);
						});
					}
					break;
				case 'fix_sabotage':
					{
						//console.log(sabotageType);
						if (sabotageType >= 1 && sabotageType <= 2) {
							let tilenum = message.tilenum;
							if (sabotageType == 1) {
								sabotageFixed[tilenum + 23] = true;
							} else if (sabotageType == 2) {
								sabotageFixed[tilenum + 25] = true;
							}
							//console.log(sabotageFixed);
							if (sabotageFixed[0] == true && sabotageFixed[1] == true) {
								clearInterval(sabotageInterval);
								sabotageInterval = -1;
								sabotageTimer = -1;
								sabotageType = -1;
								const endSabMessage = JSON.stringify({
									'type' : 'sabotage_over',
								});
								clients.forEach((cData, client, clients) => {
									client.send(endSabMessage);
								});
							}
						} else if (sabotageType == 3) {
							clearInterval(sabotageInterval);
							sabotageInterval = -1;
							sabotageTimer = -1;
							sabotageType = -1;
							const endSabMessage = JSON.stringify({
								'type' : 'sabotage_over',
							});
							clients.forEach((cData, client, clients) => {
								client.send(endSabMessage);
							});
						}
					}
					break;
				case 'kill':
					let deadplayername = message.player_data.name;
					let killerData = clients.get(ws);
					if (killerData.cooldowns[1] != 0 || killerData.role != 'impostor') { break; } 
					killerData.cooldowns[1] = 35;
					/* 
						Set dead player to dead, update each client with that fact, then create body
					*/
					clients.set(ws, killerData);
					let found = false;					
					clients.forEach((cData, client, clients) => {
						if (found === false && cData.name == deadplayername) {							
							cData.alive = false;
							clients.set(client, cData);
							found = cData;
						}
					});
					// If murdered player exists, kill them
					if (found !== false) {
						let crewmatesAlive = 0;
						let numImpostors = 0;
						clients.forEach((cData, client, clients) => {
							if (cData.alive == true && cData.role == 'crewmate') {
								crewmatesAlive++;
							} else if (cData.alive == true && cData.role == 'impostor') {
								numImpostors++;
							}
						});
						const gameOverMessage = JSON.stringify({
							'type' : 'gameover',
							'winner' : 'impostor',
						});						
						const deadUpdateToSend = JSON.stringify({
							'type' : 'updateplayer',
							'player_data' : found,
						});
						const bodyMessage = JSON.stringify({
							'type' : 'newbody',
							'body' : {
								'pos' : found.pos,
								'color' : found.color,
								'name' : found.name
							}
						});
						clients.forEach((cData, client, clients) => {
							client.send(deadUpdateToSend);
							if (numImpostors >= crewmatesAlive) {
								client.send(gameOverMessage);
							} else {
								client.send(bodyMessage);
							}
						});
						if (numImpostors >= crewmatesAlive) {
							gameIsStarted = false;
							clearInterval(gameInterval);
							gameTimer = -1;
						}
					}
			}
		} else if (message.type == 'startgame') {
			let clientData = clients.get(ws);
			if (clientData.host && !gameIsStarted /*&& clients.size >= 4*/) {
				gameIsStarted = true;
				let impostorIndexes = (clients.size < 6) ? [randInt(clients.size)] : getDistinctRandomInts(clients.size);
				let clientsArray = [];
				clients.forEach((clientData, client, clients) => {
					clientData.role = 'crewmate';
					clientData.alive = true;
					clientData.tasksdone = false;
					clientsArray.push([clientData, client]);
				});

				for (let i = 0; i < impostorIndexes.length; i++) {
					let clientData = clientsArray[impostorIndexes[i]][0];
					let client = clientsArray[impostorIndexes[i]][1];
					clientData.role = 'impostor';
					clientData.tasksdone = true;
					clientData.cooldowns[0] = 25;
					clientData.cooldowns[1] = 35;
					//console.log(clientData);
					//console.log(client);
					clients.set(client, clientData);
					clients.forEach((cData, client, clients) => {
						client.send(JSON.stringify({
							'type' : 'updateplayer',
							'player_data' : clientData,
						}));
					});
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
				assignPositionsAroundTable();

				gameTimer = 0;
				gameIsStarted = true;
				gameInterval = setInterval(gameNextSecond, 1000);
				meetingTimer = 15;
				meetingInterval = setInterval(meetingIntervalFunction, 1000);
			} else if (clients.size < 4) {
				ws.send(JSON.stringify({
					'type' : 'startgame',
					'ok' : false,
					'message' : 'Not enough players!',
				}));
			} else if (gameIsStarted) {
				ws.send(JSON.stringify({
					'type' : 'startgame',
					'ok' : false,
					'message' : 'Game already started',
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
			clearInterval(sabotageInterval);
			//clients = new Map();
			gameTimer = -1;
			sabotageType = -1;
		} else {
			let crewmatesAlive = 0;
			let numImpostors = 0;
			clients.forEach((cData, client, clients) => {
				if (cData.alive == true && cData.role == 'crewmate') {
					crewmatesAlive++;
				} else if (cData.alive == true && cData.role == 'impostor') {
					numImpostors++;
				}
			});
			if (numImpostors == 0 || numImpostors >= crewmatesAlive) {
				const gameOverMessage = JSON.stringify({
					'type' : 'gameover',
					'winner' : (numImpostors == 0 ? 'crewmate' : 'impostor'),
				});
				clients.forEach((cData, client, clients) => {
					client.send(gameOverMessage);
				});
				gameIsStarted = false;
				clearInterval(gameInterval);
				gameTimer = -1;
			}
			
		}
	});
});

function gameNextSecond() {
	clients.forEach((clientData, client, clients) => {
		if (clientData.role == 'impostor' && gameTimer != 0) {
			//console.log(clientData);
			if (!clientData.in_vent && clientData.cooldowns[0] > 0 && sabotageType == -1) {clientData.cooldowns[0]--;}
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

function sabotageIntervalFunction() {
	if (sabotageTimer-- == 0) {
		// Reactor or O2
		if (sabotageType >= 1 && sabotageType <= 2) {
			const impostorsWinMessage = JSON.stringify({
				'type' : 'gameover',
				'winner' : 'impostor',
			});
			clients.forEach((cData, client, clients) => {
				client.send(impostorsWinMessage);
			});
			clearInterval(sabotageInterval);
			sabotageType = -1;
		// Doors
		} else if (sabotageType == 4) {
			const doorsSabDoneMessage = JSON.stringify({
				'type' : 'sabotage_over',
			});
			clients.forEach((cData, client, clients) => {
				client.send(doorsSabDoneMessage);
			});
			clearInterval(sabotageInterval);
			sabotageType = -1;
		}
	} else if (sabotageTimer > 0) {
		const sabotageTimeUpdateMessage = JSON.stringify({
			'type' : 'sabotage_time',
			'time' : sabotageTimer,
		});
		clients.forEach((cData, client, clients) => {
			client.send(sabotageTimeUpdateMessage);
		});
	}
}

function meetingIntervalFunction() {
	if (meetingTimer > 0) {
		meetingTimer--;
	}
	const meetingTimerMessage = JSON.stringify({
		'type' : 'meeting_time',
		'time' : meetingTimer,
	});
	clients.forEach((cData, client, clients) => {
		client.send(meetingTimerMessage);
	});
}

const tableSpots = [
	[70, 14],
	[72, 14],
	[74, 14],
	[75, 16],
	[75, 18],
	[75, 20],
	[73, 21],
	[71, 21],
	[69, 21],
	[68, 19],
	[68, 17],
	[68, 15],
];

function assignPositionsAroundTable() {
	let tempSpots = [];
	for (let i = 0; i < tableSpots.length; i++) {
		tempSpots.push(tableSpots[i]);
	}
	clients.forEach((clientData, client, clients) => {
		let spot;
		if (tempSpots.length != 0) {
			spot = randInt(tempSpots.length);
			spot = tempSpots.splice(spot, 1)[0];
		} else {
			spot = tableSpots[randInt(tableSpots.length)];
		}
		clientData.pos = spot;
		clients.set(client, clientData);
		const messageToSend = JSON.stringify({
			'type' : 'moveplayer',
			'player_data' : clientData
		});
		clients.forEach((cData, client, clients) => {
			client.send(messageToSend);
		});
	});
}

function calculateVotes() {
	console.log('calculateVotes() called');
	votedPlayersArray = Array();
	votes.forEach((numvotes, name, votes) => {
		votedPlayersArray.push([name, numvotes]);
	});
	votedPlayersArray.sort((a, b) => { return -1 * (a[1] - b[1]); });
	console.log(votedPlayersArray);
	let votedPlayer = [{name : '__NONE__', color : 'white'}, null];
	if (votedPlayersArray[0] != votedPlayersArray[1] && votedPlayersArray[0] != '__NONE__') {	
		clients.forEach((cData, client, clients) => {
			if (cData.name == votedPlayersArray[0][0]) {
				votedPlayer = [cData, client];
			}
		});

	}
	console.log(votedPlayer);
	if (votedPlayer[1] != null) {
		votedPlayer[0].alive = false;
		clients.set(votedPlayer[1], votedPlayer[0]);
		const deadMessage = JSON.stringify({
			'type' : 'updateplayer',
			'player_data' : votedPlayer[0],
		});
		clients.forEach((cData, client, clients) => {
			client.send(deadMessage);
		});

	}
	const voteTallyMessage = JSON.stringify({
		'type' : 'voteover',
		'ejected_player' : votedPlayer[0],
	});
	clients.forEach((cData, client, clients) => {
		client.send(voteTallyMessage);
	});

	setTimeout(() => {
		let crewmatesAlive = 0;
		let numImpostors = 0;
		clients.forEach((cData, client, clients) => {
			if (cData.alive == true && cData.role == 'crewmate') {
				crewmatesAlive++;
			} else if (cData.alive == true && cData.role == 'impostor') {
				numImpostors++;
			}
		});
		if (numImpostors == 0 || numImpostors >= crewmatesAlive) {
			const gameOverMessage = JSON.stringify({
				'type' : 'gameover',
				'winner' : (numImpostors == 0 ? 'crewmate' : 'impostor'),
			});
			clients.forEach((cData, client, clients) => {
				client.send(gameOverMessage);
			});
			gameIsStarted = false;
			clearInterval(gameInterval);
			gameTimer = -1;
		}
	}, 3500);
	setTimeout(() => {
		if (gameIsStarted == true) {
			assignPositionsAroundTable();
			meetingTimer = 15;
			meetingInterval = setInterval(meetingIntervalFunction, 1000);
			gameInterval = setInterval(gameNextSecond, 1000);
		} 
	}, 4500);
}

function genRandomID() {
	return Math.trunc(Math.random() * 4294967296 /* 2^32 */);
}

function getDistinctRandomInts(maxexcl) {
	let r = randInt(maxexcl);
	let r2 = randInt(maxexcl - 1);
	if (r2 >= r) { r2++; }
	console.log([r,r2]);
	console.log(maxexcl)
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

app.listen(port, host, () => {
	console.log(`Server running at http://${host}:${port}/`);
});
const c = document.getElementById('gameCanvas');
const ctx = c.getContext('2d');

var keyCode = -1;
var requestID = -1;

const serverIP = window.location.hostname;
const websocketURL = `wss://${serverIP}:443/ws`;

window.addEventListener('load', () => {
    requestID = window.requestAnimationFrame(promptName);
});
window.addEventListener('keydown', (e) => {
    keyCode = e.keyCode;
});

function randInt(maxexcl) {
	return Math.trunc(Math.random() * maxexcl);
}

var user_name;
function promptNameDraw() {
    if (user_name.length < 20 && ((keyCode >= 0x30 && keyCode <= 0x39) || 
        (keyCode >= 'A'.charCodeAt(0) && keyCode <= 'Z'.charCodeAt(0)) || 
        (keyCode >= 'a'.charCodeAt(0) && keyCode <= 'z'.charCodeAt(0)) ||
        keyCode == 0x20)) {
        user_name += String.fromCharCode(keyCode).toLowerCase();
    } else if (keyCode == 0x8 && user_name.length != 0) {
        user_name = user_name.substring(0, user_name.length - 1);
    } else if (keyCode == 0xD && user_name.length != 0) {
        //enter key
        window.cancelAnimationFrame(requestID);
        console.log('enter!');
        startGame();
        return;
    }
    keyCode = -1;

    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    ctx.fillStyle = 'rgb(110, 110, 110)';
    ctx.fillRect(-200 + c.clientWidth / 2, -100 + c.clientHeight / 2, 400, 200);
    ctx.fillStyle = '#000000';
    ctx.font = '32px Calibri';
    ctx.fillText('Enter a name:', -100 + c.clientWidth / 2, -25 + c.clientHeight / 2);
    ctx.font = '32px Courier New';
    ctx.fillText(user_name, user_name.length * -20 / 2 + c.clientWidth / 2, 25 + c.clientHeight / 2);
    requestID = window.requestAnimationFrame(promptNameDraw);
}
function promptName() {
    user_name = '';
    promptNameDraw();
}

var mapLoaded = false;
var mapRequested = false;
var map = [[]];
var mapdata = [];

var websocket;

var globalTimer; 

const tileSize = 30;
const halfTileSize = Math.trunc(tileSize / 2);
const centerTileOffsetX = Math.trunc(c.clientWidth / tileSize / 2);
const centerTileOffsetY = Math.trunc(c.clientHeight / tileSize / 2);

const impostorViewSize = 14;
const crewmateViewSize = 11;
const darknessViewSize = 3;

const moveSpeed = 4;

const taskRooms = [
	"",
	"",
	"",
	"Upper Engine",
	"Reactor",
	"Security",
	"Lower Engine",
	"Electrical",
	"Storage",
	"Shields",
	"Admin",
	"O2",
	"Navigation",
	"Weapons",
	"Cafeteria",
	"Comms",
	"Medbay",
];
const numOfTasks = 6;

var taskList;

const sabotageDescriptions = [
    ["", false],
    ["Reactor Meltdown", true],
    ["Oxygen Depleted", true],
    ["Lights", false],
    ["Doors", false],
];
const DOORS = 4;
const LIGHTS = 3;
const REACTOR = 1;
const O2 = 2;


var playerX;
var playerY;
var playerInVent;
var playerColor;
var playerIsHost;
var playerRole;
var playerIsAlive;
var playerID;
var role;
var playerCooldowns = Array(2);

var playerHasCalledMeeting = false;

var currentSabotage = false;
var sabotageTimer = -1;

var taskInterval = -1;
var taskTimer;
var currentTaskIndex;

var meetingTimer = 15;

var gameIsStarted = false;
var winningTeam = false;
var winningPlayersList;

var otherPlayers = [];

var deadBodies = [];

function startGame() {
    globalTimer = 0;
    playerX = 65;
    playerY = 10;
    playerColor = '#ff0000';
    playerCooldowns = [-1, -1];
    playerInVent = false;
    playerIsAlive = true;
	
	playerHasCalledMeeting = false;
	
    gameIsStarted = false;
    deadBodies = [];
    otherPlayers = [];

    mapRequested = false;

    currentSabotage = false;

    winningTeam = false;
    winningPlayersList = [];

    clearInterval(taskInterval);
    taskTimer = -1;
    taskList = [];
    currentTaskIndex = -1;

    viewingCams = false;
    numCamViewing = 0;
    oldPlayerX = -1;
    oldPlayerY = -1;
    oldInVent = false;

    document.getElementById('uiHolder').innerHTML = '';
    websocket = new WebSocket(websocketURL);
    setTimeout(() => {
        if (websocket.readyState !== 1) {
            ctx.fillStyle = 'black';
            ctx.font = "20px Arial";
            ctx.fillText("Couldn't establish a websocket connection to the server!", c.clientWidth / 8, c.clientWidth * 6 / 8);
            alert("Couldn't establish a websocket connection to the server!");
        }
    }, 3000);
	websocket.onopen = (e) => {
        websocket.send(JSON.stringify({
            'type' : 'init',
            'name' : user_name,
        }));
    };
    websocket.onmessage = (e) => {
		if (mapRequested === false) {
            mapRequested = true;
            if (mapLoaded === true) {
                requestID = window.requestAnimationFrame(nextGameFrame);
            } else {
			    fetchMap();
            }
		}
		
        const msg = JSON.parse(e.data); 
        console.log(JSON.stringify(msg));    
        switch (msg.type) {
            case 'rename':
                user_name = msg.newName;
                break;
            case 'newplayer':
                if (msg.player_data.name == user_name) {
                    [playerX, playerY] = msg.player_data.pos;
                    playerColor = msg.player_data.color;
                    playerRole = msg.player_data.role;
                    playerInVent = msg.player_data.in_vent;
                    playerCooldowns = msg.player_data.cooldowns;
                    playerIsHost = msg.player_data.host;
                    playerIsAlive = msg.player_data.alive;
                    if (playerIsHost) {
                        document.getElementById("startGameHolder").innerHTML = '<button id="startGameButton"> Start Game </button>';
                        document.getElementById("startGameButton").addEventListener('click', requestStartGame);
                    }
                } else {
                    otherPlayers.push(msg.player_data);
                }
                break;
            case 'returnplayers':
                otherPlayers = [];
                msg.data.forEach(element => {
                    if (element.name != user_name) {
                        otherPlayers.push(element);
                    }    
                });
                
                break;
            case 'moveplayer':
            case 'updateplayer':
                if (user_name == msg.player_data.name) {
                    if (msg.type == 'moveplayer') {
                        [playerX, playerY] = msg.player_data.pos;
                        playerColor = msg.player_data.color;
                        playerInVent = msg.player_data.in_vent;
                    }
                    playerRole = msg.player_data.role;
                    playerIsAlive = msg.player_data.alive;
                    if (playerRole != 'crewmate') {
                        playerCooldowns = msg.player_data.cooldowns;
                    }
                } else {
                    for (let i = 0; i < otherPlayers.length; i++) {
                        if (otherPlayers[i].name == msg.player_data.name) {
                            /* 
                            Update player info
                            */
                            otherPlayers[i] = msg.player_data;
                            break;
                        }
                    }
                }
                break;
			case 'newbody':
				deadBodies.push(msg.body);
				break;
            case 'voteover':
                window.cancelAnimationFrame(requestID);
                deadBodies = [];
                ejectedPlayer = msg.ejected_player;
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
                window.requestAnimationFrame(ejectScreen);
                playerInVent = false;
                viewingCams = false;
                numCamViewing = 0;
                setTimeout(() => {
                    if (gameIsStarted) {
                        window.cancelAnimationFrame(requestID);
                        requestID = window.requestAnimationFrame(nextGameFrame);
                    }
                }, 5000);
                break;
            case 'deleteplayer':
                for (let i = 0; i < otherPlayers.length; i++) {
                    //console.log(otherPlayers[i].name, msg.player_data.name);
                    //console.log(otherPlayers[i].name == msg.player_data.name);
                    if (otherPlayers[i].name == msg.player_data.name) {
                        otherPlayers.splice(i, 1);
                        break;
                    }
                }
                if (msg.newhost != null) {
                    if (msg.newhost.name == user_name) {
                        playerIsHost = true;
                        document.getElementById("startGameHolder").innerHTML = '<button id="startGameButton"> Start Game </button>';
                        if (gameIsStarted) {
                            document.getElementById("startGameButton").innerHTML = " Game Started !";
                        } else {
                            document.getElementById("startGameButton").addEventListener('click', requestStartGame);
                        }
                    } else {
                        for (let i = 0; i < otherPlayers.length; i++) {
                            if (otherPlayers[i].name == msg.newhost.name) {
                                otherPlayers[i].newhost = true;
                                break;
                            }
                        }
                    }
                }
                break; 
            case 'startgame':
                if (msg.ok == false) {
                    const button = document.getElementById("startGameButton");
                    button.innerHTML = msg.message;
                    button.addEventListener('click', requestStartGame);
                    setTimeout(() => {
                        document.getElementById("startGameButton").innerHTML = " Start Game ";
                    }, 3000);
                } else {
                    gameIsStarted = true;
                    playerRole = msg.new_player_data.role;
                    playerInVent = false;
                    [playerX, playerY] = msg.new_player_data.pos;
                    playerIsAlive = msg.new_player_data.alive;
                    playerCooldowns = msg.new_player_data.cooldowns;

                    viewingCams = false;
					
					if (playerRole == 'crewmate') {
                        const meetingTimerDiv = document.createElement('div');
                        meetingTimerDiv.innerHTML = "Meeting Cooldown: <span id='meetingCooldown'></span>";
                        document.getElementById("uiHolder").appendChild(meetingTimerDiv);

						const allTasks = mapdata['tasks'];
						const taskHTMLList = document.createElement('ul');
						taskHTMLList.id = "taskList";
						taskList = [];
						for (let i = 0; i < numOfTasks; i++) {
							const rand_task = allTasks[randInt(allTasks.length)];
							if (checkInTaskList(rand_task[0], rand_task[1])) {
								i--;
								continue;
							}
							taskList.push([rand_task, false]);
							const taskElement = document.createElement('li');
							taskElement.id = "gen-task" + i;
							taskElement.textContent = taskRooms[ map[ rand_task[1] ][ rand_task[0] ] ];
							taskHTMLList.appendChild(taskElement);
							
						}
						document.getElementById("uiHolder").appendChild(taskHTMLList);
					} else {
						const cooldownDiv = document.createElement('div');
						cooldownDiv.innerHTML = `
                        Kill Cooldown: <span id='killCooldown'></span><br>
                        Sabotage Cooldown: <span id='sabotageCooldown'></span><br>
                        Meeting Cooldown: <span id='meetingCooldown'></span><br>
                        <br>
                        <div>1 - Reactor Sabotage</div>
                        <div>2 - O2 Sabotage</div>
                        <div>3 - Lights Sabotage</div>
                        <div>4 - Doors Sabotage</div>`;
						document.getElementById("uiHolder").appendChild(cooldownDiv);
					}
					
                }
                break;
            case 'sabotage':
                currentSabotage = msg.sab_num;
                break;
            case 'sabotage_time':
                sabotageTimer = msg.time;
                break;
            case 'sabotage_over':
                currentSabotage = false;
                break;
            case 'meeting_time':
                meetingTimer = msg.time;
                break;
            case 'meeting':
            case 'report':
                window.cancelAnimationFrame(requestID);
                requestID = window.requestAnimationFrame(votingScreen);
                hasVoted = false;
                voteableArray = [{'name' : '__NONE__', color : '#ffffff'}];
                votingDead = msg.body_data;
                votingReporter = msg.reporter;
				if (msg.type == 'meeting' && votingReporter.name == user_name) {
					playerHasCalledMeeting = true;
				}
                if (playerIsAlive) {
                    voteableArray.push({'name' : user_name, 'color' : playerColor});
                }
                otherPlayers.forEach((other) => {
                    if (other.alive == true) {
                        voteableArray.push(other);
                    }
                });
                break;
			case 'gameover':
				window.cancelAnimationFrame(requestID);
				winningTeam = msg.winner;
                gameIsStarted = false;
                document.getElementById("sabotageHolder").innerHTML = "";
                keyCode = -1;
				requestID = window.requestAnimationFrame(winningDraw);
                clearInterval(taskInterval);
				winningPlayersList = [];
				if (playerRole == winningTeam) {
					winningPlayersList.push({'name' : user_name, 'color' : playerColor});
                }
				otherPlayers.forEach((other) => {
					if (other.role == winningTeam) {
						winningPlayersList.push(other);
					}
				});
                document.getElementById("startGameHolder").innerHTML = "";
				websocket.close();
				break;
            default:
                console.log('Websocket ??????');
                console.log(e.data);
                break;
        }
    };
}

function fetchMap() {
	fetch("/static/maps/skeld.json")
    .then(response => {
    return response.json();
    })
    .then(data => {
        map = data;

        fetch("/static/maps/skeld_extras.json")
        .then(response => {
        return response.json();
        })
        .then(data => {
            mapdata = data;
            window.requestAnimationFrame(nextGameFrame);
        });
    });
}

function requestStartGame() {
    if (typeof(websocket) !== 'undefined') {
        websocket.send(JSON.stringify({
            'type' : 'startgame',
        }));
        document.getElementById("startGameButton").removeEventListener('click', this);
        document.getElementById("startGameButton").innerHTML = 'Game started!';
    }
}

var hasVoted = false;
var votingReporter;
var votingDead;
var voteableArray;

var ejectedPlayer;

var currentScrollX = Math.max(0, playerX - centerTileOffsetX);
var currentScrollY = Math.max(0, playerX - centerTileOffsetX);
var nxg_j, nxg_i;

var viewingCams = false;
var numCamViewing = 0;
var roomWatching = -1;

var oldPlayerX = -1;
var oldPlayerY = -1;
var oldInVent = false;

function winningDraw() {
	ctx.fillStyle = '#000000';
	ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
	ctx.fillStyle = winningTeam == 'impostor' ? 'red' : 'cyan';
	ctx.fillRect(0, c.clientHeight / 3, c.clientWidth, c.clientHeight / 3);
	
    ctx.fillStyle = '#0000ff';
    ctx.font = "40px Arial";
    if (winningPlayersList.length != 0 && playerRole == winningTeam) {
        ctx.fillText('Victory', c.clientWidth / 2 - 50, c.clientHeight / 8);
    } else {
        ctx.fillText('Defeat', c.clientWidth / 2 - 50, c.clientHeight / 8);
    }

	const teamLength = winningPlayersList.length;
    const centerTileX = Math.trunc(c.clientWidth / tileSize / 2);
    const centerTileY = Math.trunc(c.clientHeight / tileSize / 2);
	for (let i = 0; i < teamLength; i++) {
    	drawPlayerScale(centerTileX - (teamLength - 1) + i * 2, centerTileY, 0, 0, winningPlayersList[i].color, winningPlayersList[i].name, 1.5, false);
	}
	
	ctx.fillStyle = 'white';
	ctx.font = "36px Arial";
	ctx.fillText("Press enter to play again", c.clientWidth / 2 - 200, c.clientHeight * 6 / 8);
	
	if (keyCode != 0x0d) {
		requestID = window.requestAnimationFrame(winningDraw);
	} else {
        keyCode = -1;
        mapLoaded = true;
		startGame();
        
	}
}


function nextGameFrame() {
	doFrameWork();

	globalTimer++;
    requestID = window.requestAnimationFrame(nextGameFrame);
}

var viewingCamsTempPlayerPos = Array(2);

function doFrameWork() {
	// Check keyboard input
    if (oldInVent === false && viewingCams === false) {
        // Movement
		if (globalTimer % moveSpeed == 0) {
			if (keyCode == 0x57 /* W */ && playerY != 0 && !tileBlocksMvmt(map[playerY - 1][playerX], playerX, playerY)) {
				playerY--;
				keyCode = -1;
			} else if (keyCode == 0x41 /* A */ && playerX != 0 && !tileBlocksMvmt(map[playerY][playerX - 1], playerX, playerY)) {
				playerX--;
				keyCode = -1;
			} else if (keyCode == 0x53 /* S */ && playerY != map.length - 1 && !tileBlocksMvmt(map[playerY + 1][playerX], playerX, playerY)) {
				playerY++;
				keyCode = -1;
			} else if (keyCode == 0x44 /* D */ && playerX != map[0].length - 1 && !tileBlocksMvmt(map[playerY][playerX + 1], playerX, playerY)){
				playerX++;
				keyCode = -1;
			} 
        // Kill
		} else if (keyCode == 79 /* O */ && playerRole == 'impostor') {
            if (playerCooldowns[1] == 0) {
                for (let i = 0; i < otherPlayers.length; i++) {
                    if (distanceFromPlayer(otherPlayers[i]) <= 3 && otherPlayers[i].role == 'crewmate' && otherPlayers[i].alive) {
                        websocket.send(JSON.stringify({
                            'type' : 'gameaction',
                            'actiontype' : 'kill',
                            'player_data' : otherPlayers[i],
                        }));
                        [playerX, playerY] = otherPlayers[i].pos;
                        otherPlayers[i].alive = false;
                        playerCooldowns[1] = 35;
                        break;
                    }
                }
            }
			keyCode = -1;
        // Venting
		} else if (keyCode == 73 /* I */ && playerRole == 'impostor' && inRange(map[playerY][playerX], -10, -19)) {
            playerInVent = true;
            keyCode = -1;
        // Fix sabotages
        } else if (keyCode == 73 /* I */ && inRange(map[playerY][playerX], -20, -25)) {
            if ((currentSabotage == REACTOR && inRange(map[playerY][playerX], -23, -22)) || 
                (currentSabotage == O2 && inRange(map[playerY][playerX], -25, -24)) || 
                (currentSabotage == LIGHTS && map[playerY][playerX] == -21)) {
                websocket.send(JSON.stringify({
                    'type' : 'gameaction',
                    'actiontype' : 'fix_sabotage',
                    'tilenum' : map[playerY][playerX],
                }));
            }
            keyCode = -1;
        // Call meeting
        } else if (keyCode == 73 /* I */ && map[playerY][playerX] == 20) {
            if (meetingTimer == 0 && playerHasCalledMeeting == false) {
                websocket.send(JSON.stringify({
                    'type' : 'gameaction',
                    'actiontype' : 'meeting',
                    'body_data' : null,
                }));
            }
            meetingTimer = 15;
            keyCode = -1;
        // Viewcams
        } else if (keyCode == 73 /* I */ && map[playerY][playerX] == 50) {
            viewingCams = true;
            keyCode = -1;
        // Sabotage
        } else if (playerRole == 'impostor' && inRange(keyCode, 0x30, 0x39)) {
            if (playerCooldowns[0] == 0) {
                websocket.send(JSON.stringify({
                    'type' : 'gameaction',
                    'actiontype' : 'sabotage',
                    'sab_num' : (keyCode - 0x30),
                }));
            }
            keyCode = -1;
        // Reporting bodies and tasks
        } else if (keyCode == 85 /* U */ && playerIsAlive && checkForBody(playerX, playerY) !== false) {
            console.log(checkForBody(playerX, playerY));
            websocket.send(JSON.stringify({
                'type' : 'gameaction',
                'actiontype' : 'report',
                'bodydata' : checkForBody(playerX, playerY),
            }));
            keyCode = -1;
        } else if (keyCode == 73 /* I */ && playerRole == 'crewmate' && inRange(map[playerY][playerX], 3, 16) && checkInTaskList(playerX, playerY) !== false) {
				console.log("task");
				taskTimer = 5;
				currentTaskIndex = checkInTaskList(playerX, playerY);
				taskInterval = setInterval(taskIntervalFunction, 1000);
				keyCode = -1;
		}
    } else if (oldInVent === true) {
        if (keyCode == 73 /* I */) {
            playerInVent = false;
            keyCode = -1;
        } else if (keyCode == 0x41 /* A */ || keyCode == 0x44 /* D */) {
            let vent_class = map[playerY][playerX];
            let d = keyCode = 0x44 ? 1 : -1; // Direction of vent cycling
            let vcl = mapdata[vent_class].length;
            for (let i = 0; i < vcl; i++) {
                if (mapdata[vent_class][i][0] == playerX && mapdata[vent_class][i][1] == playerY) {
                    [playerX, playerY] = mapdata[vent_class][(i + d) % vcl];
                    break;
                }
            }
            keyCode = -1;
        }
    } else if (viewingCams === true) {
        if (keyCode == 73 /* I */) {
            viewingCams = false;
            keyCode = -1;
        } else if (keyCode == 0x41 /* A */) {
            numCamViewing = (numCamViewing == 0 ? 4 - 1 : numCamViewing - 1);
            keyCode = -1;
        } else if (keyCode == 0x44 /* D */) {
            numCamViewing = (numCamViewing + 1) % 4;
            keyCode = -1;
        }
    }

    if (playerY != oldPlayerY || playerX != oldPlayerX || playerInVent != oldInVent) {
		if (playerRole == 'crewmate') {
			clearInterval(taskInterval);
			taskInterval = -1;
			//taskTimer = 5;
		}
        websocket.send(JSON.stringify({
            'type' : 'update',
            'data' : {
                'name' : user_name,
                'pos' : [playerX, playerY],
                'in_vent' : playerInVent,
            }
        }));
    }
	oldPlayerX = playerX;
    oldPlayerY = playerY;
    oldInVent = playerInVent;

	// Calc scroll vars 
    if (viewingCams === true) {
        viewingCamsTempPlayerPos = [playerX, playerY];
        switch (numCamViewing) {
            case 0:
                [playerX, playerY] = [113, 34];  
                break;
            case 1:
                [playerX, playerY] = [72, 43];  
                break;
            case 2:
                [playerX, playerY] = [21, 37];
                break;
            case 3:
                [playerX, playerY] = [45, 18];  
                break;
        }
    } else {
        viewingCamsTempPlayerPos = [-1, -1];   
    }
    currentScrollX = Math.max(0, playerX - centerTileOffsetX);
    currentScrollY = Math.max(0, playerY - centerTileOffsetY);
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight); 
    // Draw tiles onto canvas 
    for (nxg_j = 0; nxg_j < map.length; nxg_j++) {
        if (nxg_j < currentScrollY) {
            continue;
        } else if (nxg_j >= currentScrollY + c.clientHeight / tileSize) {
            break;
        }
        for (nxg_i = 0; nxg_i < map[nxg_j].length; nxg_i++) {
            if (nxg_i < currentScrollX) {
                continue;
            } else if (nxg_i >= currentScrollX + c.clientWidth / tileSize) {
                break;
            }
            if (map[nxg_j][nxg_i] == 1) {
                ctx.fillStyle = '#888888';
                ctx.fillRect((nxg_i - currentScrollX) * tileSize, (nxg_j - currentScrollY) * tileSize, tileSize, tileSize);
            } else if (map[nxg_j][nxg_i] == -26 && currentSabotage == DOORS) {
                ctx.fillStyle =  '#9f9f9f';
                ctx.fillRect((nxg_i - currentScrollX) * tileSize, (nxg_j - currentScrollY) * tileSize, tileSize, tileSize);       
            } else if (map[nxg_j][nxg_i] == 2) {
                ctx.fillStyle =  '#bbbbbb';
                ctx.fillRect((nxg_i - currentScrollX) * tileSize, (nxg_j - currentScrollY) * tileSize, tileSize, tileSize);
            } else if (inRange(map[nxg_j][nxg_i], -10, -19)) {
                ctx.fillStyle = '#3f3f3f';
                ctx.fillRect((nxg_i - currentScrollX) * tileSize, (nxg_j - currentScrollY) * tileSize, tileSize, tileSize);
            } else if (gameIsStarted && inRange(map[nxg_j][nxg_i], 3, 16) && (playerRole == 'impostor' || checkInTaskList(nxg_i, nxg_j) !== false)) {
				ctx.fillStyle = '#ffff00';
				ctx.fillRect((nxg_i - currentScrollX) * tileSize, (nxg_j - currentScrollY) * tileSize, tileSize, tileSize);
			} else if (currentSabotage !== false && currentSabotage >= REACTOR && currentSabotage <= DOORS) {
                if ((currentSabotage == REACTOR && inRange(map[nxg_j][nxg_i], -23, -22)) || 
                    (currentSabotage == O2 && inRange(map[nxg_j][nxg_i], -25, -24)) || 
                    (currentSabotage == LIGHTS && map[nxg_j][nxg_i] == -21)) {
                    ctx.fillStyle = "#CC8899";
                    ctx.fillRect((nxg_i - currentScrollX) * tileSize, (nxg_j - currentScrollY) * tileSize, tileSize, tileSize);
                }
            }			
        }
    }
    // Black out area's beyond character vision
    let mapViewSize = viewingCams ? (c.clientWidth / tileSize) : (playerRole == 'impostor' ? impostorViewSize : crewmateViewSize);
    let realViewSize = (currentSabotage == 3 && playerRole == 'crewmate' && playerIsAlive) ? darknessViewSize : mapViewSize;
	for (nxg_j = 0; nxg_j < c.clientHeight / tileSize; nxg_j++) {
		for (nxg_i = 0; nxg_i < c.clientWidth / tileSize; nxg_i++) {
			if (playerIsAlive && Math.abs(nxg_j - (playerY - currentScrollY)) + Math.abs(nxg_i - (playerX - currentScrollX)) > mapViewSize) {
				ctx.fillStyle = '#000000';
				ctx.fillRect(nxg_i * tileSize, nxg_j * tileSize, tileSize, tileSize);
			} else if (!inPlayerView(playerX, playerY, nxg_i + currentScrollX, nxg_j + currentScrollY, true)) {
				ctx.fillStyle = '#101010';
				ctx.fillRect(nxg_i * tileSize, nxg_j * tileSize, tileSize, tileSize);
			} else if (currentSabotage == LIGHTS && playerRole == 'crewmate' && Math.abs(nxg_j - (playerY - currentScrollY)) + Math.abs(nxg_i - (playerX - currentScrollX)) > darknessViewSize) {
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(nxg_i * tileSize, nxg_j * tileSize, tileSize, tileSize);
            }
		}   
	}
	
	// Draw any dead bodies 
	for (nxg_i = 0; nxg_i < deadBodies.length; nxg_i++) {
		if (playerIsAlive == false || (Math.abs(playerX - deadBodies[nxg_i].pos[0]) + Math.abs(playerY - deadBodies[nxg_i].pos[1]) <= realViewSize) &&
            inPlayerView(playerX, playerY, deadBodies[nxg_i].pos[0], deadBodies[nxg_i].pos[1], false)
            ) {
            drawBody(
                deadBodies[nxg_i].pos[0], deadBodies[nxg_i].pos[1], 
                currentScrollX, currentScrollY, deadBodies[nxg_i].color, 
            );
        }
    }
    // Draw other visible players
    for (nxg_i = 0; nxg_i < otherPlayers.length; nxg_i++) {
        if (playerIsAlive == false || (Math.abs(playerX - otherPlayers[nxg_i].pos[0]) + Math.abs(playerY - otherPlayers[nxg_i].pos[1]) <= realViewSize) && 
            otherPlayers[nxg_i].alive && !otherPlayers[nxg_i].in_vent &&
            inPlayerView(playerX, playerY, otherPlayers[nxg_i].pos[0], otherPlayers[nxg_i].pos[1], false)
            ) {
            drawPlayer(
                otherPlayers[nxg_i].pos[0], otherPlayers[nxg_i].pos[1], 
                currentScrollX, currentScrollY, otherPlayers[nxg_i].color, 
                otherPlayers[nxg_i].name, otherPlayers[nxg_i].role == 'impostor'
            );
            if (otherPlayers[nxg_i].alive == false) {
                drawPlayer(
                    otherPlayers[nxg_i].pos[0], otherPlayers[nxg_i].pos[1], 
                    currentScrollX, currentScrollY, 'rgba(255, 255, 255, 0.5)', ''
                ); 
            }
        }
    }
	
	// Draw player
    if (!viewingCams) {
        drawPlayer(playerX, playerY, currentScrollX, currentScrollY, playerColor, user_name, true);
        // Shade player if they are in vent
        if (playerInVent) { drawPlayer(playerX, playerY, currentScrollX, currentScrollY, 'rgba(0, 0, 0, 0.5)', '', false); }
	    // If player is dead, draw them lighter
	    if (!playerIsAlive) { drawPlayer(playerX, playerY, currentScrollX, currentScrollY, 'rgba(255, 255, 255, 0.5)', '', false); }
    } else {
        ctx.font = "32px Arial";
        ctx.fillStyle = 'red';
        ctx.fillText(`Viewing Cams... (${ numCamViewing + 1 }/4)`, c.clientWidth / 27 , c.clientHeight / 21);
        if (!playerIsAlive) {
            ctx.fillText('You are Dead!', c.clientWidth / 27, c.clientHeight / 21 * 3);
        }
    }
	
	// Draw tablet if player is doing task
	// If impostor, show cooldowns on side ui
    if (document.getElementById('meetingCooldown') != undefined && gameIsStarted) {
        document.getElementById('meetingCooldown').innerHTML = meetingTimer + (playerHasCalledMeeting ? '&#8212; <strong>You have already called a meeting!</strong>' : '');
    }
	if (playerRole == 'crewmate' && taskInterval !== -1) {
		ctx.fillStyle = "#404040";
		ctx.fillRect(c.clientWidth / 8, c.clientHeight / 8, c.clientWidth * 6 / 8, c.clientHeight * 6 / 8);
		const string = "Doing task... " + taskTimer;
		ctx.font = "32px Courier New";
		ctx.fillStyle = '#ffffff';
		ctx.fillText(string, c.clientWidth / 2 - string.length * 10, c.clientHeight / 2 - 10);
	} else if (playerRole == 'impostor') {
		if (document.getElementById('sabotageCooldown') != null) {
			if (playerIsAlive) {
				document.getElementById('sabotageCooldown').textContent = playerCooldowns[0];
				document.getElementById('killCooldown').textContent = playerCooldowns[1];
			} else {
				document.getElementById("uiHolder").innerHTML = "";	
			}
		}
	}

    if (currentSabotage !== false) {
        document.getElementById('sabotageHolder').innerHTML = "<strong>Sabotage &#8212; " +
            sabotageDescriptions[currentSabotage][0] + 
            (sabotageDescriptions[currentSabotage][1] ? (' : ' + sabotageTimer) : '') + "</strong><br>";
        if (currentSabotage >= 1 && currentSabotage <= 2) {
            const cycleLength = 120;
            const halfCycle = cycleLength / 2;
            let radius = (globalTimer % cycleLength >= halfCycle) ? cycleLength - (globalTimer % cycleLength) : (globalTimer % cycleLength)
            for (let j = 0; j <= c.clientHeight; j += c.clientHeight) {
                for (let i = 0; i <= c.clientWidth; i += c.clientWidth) {
                    ctx.beginPath();
                    ctx.arc(i, j, radius / halfCycle * c.clientWidth / 6, 0, 2 * Math.PI);
                    ctx.fillStyle = 'red';
                    ctx.fill();
                }
            }
        }
    } else {
        document.getElementById('sabotageHolder').innerHTML = "";
    }

    if (gameIsStarted == false) {
        ctx.fillStyle = 'green';
        ctx.font = '36px Arial';
        ctx.fillText(`Lobby (${ otherPlayers.length + 1 }/10)`, c.clientWidth / 2 - 100, c.clientHeight / 8);
    }

    if (viewingCamsTempPlayerPos[0] != -1 && viewingCamsTempPlayerPos[1] != -1) {
        [playerX, playerY] = viewingCamsTempPlayerPos;
    }
}

function distanceFromPlayer(player) {
	return Math.abs(playerX - player.pos[0]) + Math.abs(playerY - player.pos[1]);
}

function taskIntervalFunction() {
	if (--taskTimer <= 0) {
		taskList[currentTaskIndex][1] = true;
		console.log('task done!');
		document.getElementById("taskList").removeChild(document.getElementById("gen-task" + currentTaskIndex));
		clearInterval(taskInterval);
		taskInterval = -1;
		
		for (let i = 0; i < taskList.length; i++) {
			if (taskList[i][1] == false) {
				return;
			}
		}
		websocket.send(JSON.stringify({
			'type' : 'gameaction',
			'actiontype' : 'tasksdone',
		}));
	}
}

function checkInTaskList(x, y) {
	for (let i = 0; i < taskList.length; i++) {
		if (taskList[i][1] == false && taskList[i][0][0] == x && taskList[i][0][1] == y) {
			return i;
		}
	}
	return false;
}

function checkForBody(x, y) {
    if (typeof(deadBodies) == 'undefined') { return false; }
    for (let i = 0; i < deadBodies.length; i++) {
        if (inRange(distanceFromPlayer(deadBodies[i]), 0, 2)) {
            return deadBodies[i];
        }
    }
    return false;
}

function inPlayerView(px, py, ox, oy, alr) {
    if (ox < 0 || ox >= map[0].length || oy < 0 || oy >= map.length) {
        return false;
        
    } else if (ox == px) {
        while (oy != py) {
            oy += (oy < py) ? 1 : -1;
            if (tileBlocksView(map[oy][ox], px, py)) { return false; }
        }
    } else if (oy == py) {
        while (ox != px) {
            ox += (ox < px) ? 1 : -1;
            if (tileBlocksView(map[oy][ox], px, py)) { return false; }
        }
    }

    let dy = py - oy;
    let dx = px - ox;

    let factor = dx * dx + dy * dy;
    dy /= factor;
    dx /= factor;

    let temp_x = ox;
    let temp_y = oy;
    while (Math.round(temp_y) != py || Math.round(temp_x) != px) {
        temp_x += dx;
        temp_y += dy;
        let tile = map[Math.trunc(Math.round(temp_y))][Math.trunc(Math.round(temp_x))];
        if (tileBlocksView(tile, px, py)) {
            if (alr) {
                let xdir = dx > 0 ? 1 : -1;
                let ydir = dy > 0 ? 1 : -1;
                if (tileBlocksView(map[oy][ox], px, py)) {
                    return inPlayerView(px, py, ox + xdir, oy, false) | inPlayerView(px, py, ox, oy + ydir, false);
                }
            }
            return false;
        }
    }
    
    return true;
}

function tileBlocksView(tilenum, px, py) {
    return tilenum == 1 || (currentSabotage == DOORS && tilenum == -26 && map[py][px] != -26);
}

function tileBlocksMvmt(tilenum, px, py) {
    return tileBlocksView(tilenum, px, py) || tilenum == 2;
}

function votingScreen() {
    if (keyCode >= 0x30 && keyCode <= 0x39) {
        if (hasVoted == false && playerIsAlive && (keyCode == 0x30 ? 9 : keyCode - 0x31) < voteableArray.length) {
            hasVoted = true;
            websocket.send(JSON.stringify({
                'type' : 'gameaction',
                'actiontype' : 'vote',
                'voted_player_name' : voteableArray[keyCode == 0x30 ? 9 : keyCode - 0x31].name,
            }));
        }
        keyCode = -1;
    }

    clearInterval(taskInterval);

    ctx.fillStyle = 'gray';
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    ctx.fillStyle = "#404040";
	ctx.fillRect(c.clientWidth / 8, c.clientHeight / 8, c.clientWidth * 6 / 8, c.clientHeight * 6 / 8);

    ctx.font = "36px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Voting:", c.clientWidth / 2 - 50, c.clientHeight / 8 + 40);
    ctx.font = "16px Arial";
    ctx.fillText((votingDead == null ? "Meeting by: " : "Reported by: ") + votingReporter.name, c.clientWidth / 2 - 100, c.clientHeight / 8 + 75);

    if (hasVoted == true || playerIsAlive == false) {
        ctx.fillStyle = 'red';
        ctx.font = '20px Arial';
        ctx.fillText(playerIsAlive == true ? "Voted!" : "Can't vote!", c.clientWidth / 2 - 40, c.clientHeight * 6.5 / 8);
    }

    for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 4; i++) {
            let index = i + j * 4;
            if (index >= voteableArray.length) { break; }

            let basex = Math.trunc(c.clientWidth / tileSize / 3);
            let offsetx = Math.trunc(c.clientWidth / tileSize / 6);
            let basey = Math.trunc(c.clientWidth / tileSize / 4);
            drawPlayer(basex + j * offsetx, 
                basey + i * 3, 0, 0, 
                voteableArray[index].color, 
                voteableArray[index].name != '__NONE__' ? voteableArray[index].name : 'Nobody!', false);
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(((index + 1) % 10) + '', (basex + j * offsetx) * tileSize - 20, (basey + i * 3) * tileSize + halfTileSize);
        }
    }

    requestID = window.requestAnimationFrame(votingScreen);
}

function ejectScreen() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);

    ctx.fillStyle = '#505050';
    ctx.beginPath();
    ctx.arc(-0.5 * c.clientWidth, c.clientHeight / 2, c.clientWidth * 2 / 3, 0, 2 * Math.PI);
    ctx.fill();

    if (typeof(ejectedPlayer) != 'undefined' && ejectedPlayer.name != '__NONE__') {
        drawPlayerScale(
            Math.trunc(c.clientWidth / tileSize / 2), Math.trunc(c.clientHeight / tileSize / 2), 
           0, 0, ejectedPlayer.color, "", 1.5, false);
    }
    ctx.font = "36px Arial";
    ctx.fillStyle = 'white';
    ctx.fillText(
        ejectedPlayer.name != '__NONE__' ? 
            `${ ejectedPlayer.name } was ${ ejectedPlayer.role == 'impostor' ? '' : 'not '}an Impostor.` : "No one was ejected.", 
        c.clientWidth / 2 - 200, 
        c.clientHeight / 3 - 25);

    requestID = window.requestAnimationFrame(ejectScreen);
}

function drawBody(x, y, scrollx, scrolly, color) {
	ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse((x - scrollx) * tileSize + halfTileSize, (y - scrolly) * tileSize + halfTileSize, halfTileSize * 1.25, halfTileSize * 0.75, 0, 0, 2 * Math.PI);
    ctx.fill();
}

function drawPlayerScale(x, y, scrollx, scrolly, color, name, scale, redtext) {
	ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc((x - scrollx) * tileSize + halfTileSize, (y - scrolly) * tileSize + halfTileSize, halfTileSize * scale, 0, 2 * Math.PI);
    ctx.fill();
    ctx.font = `${ Math.trunc(Math.round(12 * scale)) }px Courier New`;
    ctx.fillStyle = (playerRole == 'impostor' && redtext) ? '#800020' : '#000000';
    ctx.fillText(name, (x - scrollx) * tileSize + halfTileSize - scale * 4 * name.length, (y - scrolly) * tileSize - 5);   
}

function drawPlayer(x, y, scrollx, scrolly, color, name, redtext) {
    drawPlayerScale(x, y, scrollx, scrolly, color, name, 1, redtext);
}

function inRange(x, a, b) {
    return x >= Math.min(a,b) && x <= Math.max(a,b);
}

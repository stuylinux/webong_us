const c = document.getElementById('gameCanvas');
const ctx = c.getContext('2d');

var keyCode = -1;
var requestID = -1;

window.addEventListener('load', () => {
    requestID = window.requestAnimationFrame(promptName);
});
window.addEventListener('keydown', (e) => {
    keyCode = e.keyCode;
});

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

var map = [];

var websocket;

const tileSize = 50;
const halfTileSize = Math.trunc(tileSize / 2);
const centerTileOffsetX = Math.trunc(c.clientWidth / tileSize / 2);
const centerTileOffsetY = Math.trunc(c.clientHeight / tileSize / 2);

var playerX;
var playerY;
var playerColor;
var playerViewSize;
var playerIsHost;
var playerRole;
var playerID;
var role;
var kill_cooldown;
var sab_cooldown;
var playerCooldowns = Array(2);

var otherPlayers = [];

function startGame() {
    playerX = 65;
    playerY = 10;
    playerColor = '#ff0000';
    playerViewSize = 9;
    playerCooldowns = [-1, -1];

    websocket = new WebSocket('ws://localhost:47777/');
    websocket.onopen = (e) => {
        websocket.send(JSON.stringify({
            'type' : 'init',
            'name' : user_name
        }));
    }
    websocket.onmessage = (e) => {
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
                    playerCooldowns = [msg.player_data.kill_cooldown, msg.player_data.sab_cooldown];
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
            case 'updateplayer':
                if (user_name == msg.player_data.name) {
                    [playerX, playerY] = msg.player_data.pos;
                    playerColor = msg.player_data.color;
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
            default:
                console.log('Websocket ??????');
                console.log(e.data);
                break;
        }
    }

    fetch("/static/maps/skeld.json")
    .then(response => {
    return response.json();
    })
    .then(data => {
        map = data;
        window.requestAnimationFrame(nextGameFrame);
    });
}


var currentScrollX = Math.max(0, playerX - centerTileOffsetX);
var currentScrollY = Math.max(0, playerX - centerTileOffsetX);
var nxg_j, nxg_i;

var oldPlayerX;
var oldPlayerY;

function nextGameFrame() {
    (() => {
    oldPlayerX = playerX;
    oldPlayerY = playerY;
    if (keyCode == 'W'.charCodeAt(0) && playerY != 0 && !inRange(map[playerY - 1][playerX], 1, 2)) {
        playerY--;
        keyCode = -1;
    } else if (keyCode == 0x41 && playerX != 0 && !inRange(map[playerY][playerX - 1], 1, 2)) {
        playerX--;
        keyCode = -1;
    } else if (keyCode == 'S'.charCodeAt(0) && playerY != map.length - 1 && !inRange(map[playerY + 1][playerX], 1, 2)) {
        playerY++;
        keyCode = -1;
    } else if (keyCode == 0x44 && playerX != map[0].length - 1 && !inRange(map[playerY][playerX + 1], 1, 2)){
        playerX++;
        keyCode = -1;
    }
    if (playerY != oldPlayerY || playerX != oldPlayerX) {
        websocket.send(JSON.stringify({
            'type' : 'update',
            'data' : {
                'name' : user_name,
                'pos' : [playerX, playerY],
            }
        }));
    }

    currentScrollX = Math.max(0, playerX - centerTileOffsetX);
    currentScrollY = Math.max(0, playerY - centerTileOffsetY);
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);  
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
                ctx.fillRect((nxg_i - currentScrollX) * 50, (nxg_j - currentScrollY) * 50, tileSize, tileSize);
            } else if (map[nxg_j][nxg_i] == 2) {
                ctx.fillStyle =  '#bbbbbb';
                ctx.fillRect((nxg_i - currentScrollX) * 50, (nxg_j - currentScrollY) * 50, tileSize, tileSize);
            } else if (map[nxg_j][nxg_i] <= -10 && map[nxg_j][nxg_i] > -20) {
                ctx.fillStyle = '#3f3f3f';
                ctx.fillRect((nxg_i - currentScrollX) * 50, (nxg_j - currentScrollY) * 50, tileSize, tileSize);
            }
        }
    }
    for (nxg_j = 0; nxg_j < c.clientHeight / tileSize; nxg_j++) {
        for (nxg_i = 0; nxg_i < c.clientWidth / tileSize; nxg_i++) {
            if (Math.abs(nxg_j - (playerY - currentScrollY)) + Math.abs(nxg_i - (playerX - currentScrollX)) > playerViewSize) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(nxg_i * tileSize, nxg_j * tileSize, tileSize, tileSize);
            } else if (!inPlayerView(playerX, playerY, nxg_i + currentScrollX, nxg_j + currentScrollY, true)) {
                if (map[nxg_j][nxg_i] == 1) {
                    ctx.fillStyle = '#505050';
                } else {
                    ctx.fillStyle = '#101010';
                }
                ctx.fillRect(nxg_i * tileSize, nxg_j * tileSize, tileSize, tileSize);
            }
        }   
    }
    drawPlayer(playerX, playerY, currentScrollX, currentScrollY, playerColor, user_name);

    for (nxg_i = 0; nxg_i < otherPlayers.length; nxg_i++) {
        if ((Math.abs(playerX - otherPlayers[nxg_i].pos[0]) + Math.abs(playerY - otherPlayers[nxg_i].pos[1]) < playerViewSize) && 
            otherPlayers[nxg_i].visible &&
            inPlayerView(playerX, playerY, otherPlayers[nxg_i].pos[0], otherPlayers[nxg_i].pos[1], false)
            ) {
            drawPlayer(
                otherPlayers[nxg_i].pos[0], otherPlayers[nxg_i].pos[1], 
                currentScrollX, currentScrollY, otherPlayers[nxg_i].color, 
                otherPlayers[nxg_i].name
            );
        }
    }
    })();

    window.requestAnimationFrame(nextGameFrame);
}

function inPlayerView(px, py, ox, oy, alr) {
    if (ox < 0 || ox >= map[0].length || oy < 0 || oy >= map.length) {
        return false;
        
    } else if (ox == px) {
        while (oy != py) {
            oy += (oy < py) ? 1 : -1;
            if (inRange(map[oy][px], 1, 2)) { return false; }
        }
    } else if (oy == py) {
        while (ox != px) {
            ox += (ox < px) ? 1 : -1;
            if (inRange(map[py][ox], 1, 2)) { return false; }
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
        if (inRange(map[Math.trunc(Math.round(temp_y))][Math.trunc(Math.round(temp_x))], 1, 2)) {
            if (alr) {
                let xdir = dx > 0 ? 1 : -1;
                let ydir = dy > 0 ? 1 : -1;
                if (inRange(map[oy][ox], 1 ,2)) {
                    return inPlayerView(px, py, ox + xdir, oy, false) | inPlayerView(px, py, ox, oy + ydir, false);
                }
            }
            return false;
        }
    }
    
    return true;
}

function drawPlayer(x, y, scrollx, scrolly, color, name) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc((x - scrollx) * tileSize + halfTileSize, (y - scrolly) * tileSize + halfTileSize, halfTileSize, 0, 2 * Math.PI);
    ctx.fill();
    ctx.font = '12px Courier New';
    ctx.fillStyle = '#000000';
    ctx.fillText(name, (x - scrollx) * tileSize + halfTileSize - 4 * user_name.length, (y - scrolly) * tileSize - 5);   
}

function inRange(x, min, max) {
    return x >= min && x <= max;
}
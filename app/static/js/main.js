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

const tileSize = 50;
const halfTileSize = Math.trunc(tileSize / 2);
const centerTileOffsetX = Math.trunc(c.clientWidth / tileSize / 2);
const centerTileOffsetY = Math.trunc(c.clientHeight / tileSize / 2);

var playerX;
var playerY;
var playerViewSize;


function startGame() {
    playerX = playerX = 65;
    playerY = 10;
    playerViewSize = 7;

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

function nextGameFrame() {
    (() => {
    if (keyCode == 'W'.charCodeAt(0) && playerY != 0 && map[playerY - 1][playerX] != 1) {
        playerY--;
        keyCode = -1;
    } else if (keyCode == 0x41 && playerX != 0 && map[playerY][playerX - 1] != 1) {
        playerX--;
        keyCode = -1;
    } else if (keyCode == 'S'.charCodeAt(0) && playerY != map.length - 1 && map[playerY + 1][playerX] != 1) {
        playerY++;
        keyCode = -1;
    } else if (keyCode == 0x44 && playerX != map[0].length - 1 && map[playerY][playerX + 1] != 1) {
        playerX++;
        keyCode = -1;
    }


    currentScrollX = Math.max(0, playerX - centerTileOffsetX);
    currentScrollY = Math.max(0, playerY - centerTileOffsetY);
    //ctx.setTransform(1, 0, 0, 1, 0, 0);
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
            } else if (map[nxg_j][nxg_i] <= -10) {
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
                ctx.fillStyle = '#101010';
                ctx.fillRect(nxg_i * tileSize, nxg_j * tileSize, tileSize, tileSize);
            }
        }   
    }
    ctx.fillStyle = '#ff0000';
    //console.log((playerX - currentScrollX) * tileSize + halfTileSize, (playerY - currentScrollY) * tileSize + halfTileSize, halfTileSize, 0, 4 * Math.PI);
    ctx.beginPath();
    ctx.arc((playerX - currentScrollX) * tileSize + halfTileSize, (playerY - currentScrollY) * tileSize + halfTileSize, halfTileSize, 0, 2 * Math.PI);
    ctx.fill();
    })();

    window.requestAnimationFrame(nextGameFrame);
}

function inPlayerView(px, py, ox, oy, alr) {
    if (ox == px) {
        while (oy != py) {
            oy += (oy < py) ? 1 : -1;
            if (map[oy][px] == 1) { return false; }
        }
    } else if (oy == py) {
        while (ox != px) {
            ox += (ox < px) ? 1 : -1;
            if (map[py][ox] == 1) { return false; }
        }
    }

    if (ox < 0 || ox >= map[0].length || oy < 0 || oy >= map.length) {
        return false;
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
        if (map[Math.trunc(Math.round(temp_y))][Math.trunc(Math.round(temp_x))] == 1) {
            if (alr) {
                let xdir = dx > 0 ? 1 : -1;
                let ydir = dy > 0 ? 1 : -1;
                if (map[oy][ox] == 1 && inPlayerView(px, py, ox + xdir, oy, false)) {return true; }
                if (map[oy][ox] == 1 && inPlayerView(px, py, ox, oy + ydir, false)) {return true; }
            }
            return false;
        }
    }
    
    return true;
}


console.log('Hello');

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
        console.log('enter!');
        startGame();
        return;
    }
    keyCode = -1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    ctx.fillStyle = 'rgb(110, 110, 110)';
    ctx.setTransform(1, 0, 0, 1, c.clientWidth / 2, c.clientHeight / 2);
    ctx.fillRect(-200, -100, 400, 200);
    ctx.fillStyle = '#000000';
    ctx.font = '32px Calibri';
    ctx.fillText('Enter a name:', -100, -25);
    ctx.font = '32px Courier New';
    ctx.fillText(user_name, user_name.length * -20 / 2, 25);
    requestID = window.requestAnimationFrame(promptNameDraw);
}
function promptName() {
    user_name = '';
    promptNameDraw();
}

function startGame() {

}


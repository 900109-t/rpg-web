const socket = io();

function join() {
    const nickname = document.getElementById("nickname").value;
    socket.emit("joinGame", nickname);
    document.getElementById("login").style.display = "none";
    document.getElementById("game").style.display = "block";
}

function send() {
    const msg = document.getElementById("msg").value;
    socket.emit("chat", msg);
    document.getElementById("msg").value = "";
}

function createGuild() {
    const name = document.getElementById("guildName").value;
    socket.emit("createGuild", name);
}

function joinGuild() {
    const name = document.getElementById("guildName").value;
    socket.emit("joinGuild", name);
}

function attackBoss() {
    socket.emit("attackBoss");
}

socket.on("chatMessage", (msg) => {
    const chat = document.getElementById("chat");
    chat.innerHTML += `<div>${msg}</div>`;
    chat.scrollTop = chat.scrollHeight;
});

socket.on("bossUpdate", (data) => {
    document.getElementById("boss").innerText =
        `Guild: ${data.guild} | Boss HP: ${data.bossHp}`;
});
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* ===== 데이터 구조 ===== */

let players = {}; // socket.id 기준
let accounts = {}; // nickname 기준
let guilds = {};

/* ===== 유틸 ===== */

function baseStats(job) {
    if (job === "warrior") return { hp: 200, atk: 20, def: 10 };
    if (job === "mage") return { hp: 120, atk: 30, def: 5 };
    if (job === "archer") return { hp: 150, atk: 25, def: 7 };
}

function levelUp(player) {
    player.level++;
    player.exp = 0;
    player.stats.atk += 5;
    player.stats.def += 3;
    player.stats.hp += 20;
}

/* ===== 소켓 ===== */

io.on("connection", (socket) => {

    socket.on("register", ({ nickname, job }) => {
        if (accounts[nickname]) {
            socket.emit("system", "이미 존재하는 닉네임");
            return;
        }

        const stats = baseStats(job);

        const newPlayer = {
            nickname,
            job,
            level: 1,
            exp: 0,
            gold: 0,
            guild: null,
            stats,
            damage: 0
        };

        accounts[nickname] = newPlayer;
        players[socket.id] = newPlayer;

        socket.emit("loginSuccess", newPlayer);
        io.emit("system", `${nickname} 접속`);
    });

    socket.on("chat", (msg) => {
        const player = players[socket.id];
        if (!player) return;

        io.emit("chat", `${player.nickname}: ${msg}`);
    });

    socket.on("guildChat", (msg) => {
        const player = players[socket.id];
        if (!player || !player.guild) return;

        const guild = guilds[player.guild];
        guild.members.forEach(id => {
            io.to(id).emit("chat", `[길드] ${player.nickname}: ${msg}`);
        });
    });

    socket.on("createGuild", (name) => {
        const player = players[socket.id];
        if (!player || guilds[name]) return;

        guilds[name] = {
            name,
            members: [socket.id],
            bossHp: 5000
        };

        player.guild = name;
        socket.emit("system", "길드 생성 완료");
    });

    socket.on("joinGuild", (name) => {
        const player = players[socket.id];
        const guild = guilds[name];
        if (!player || !guild) return;

        guild.members.push(socket.id);
        player.guild = name;
        socket.emit("system", "길드 가입 완료");
    });

    socket.on("hunt", () => {
        const player = players[socket.id];
        if (!player) return;

        const damage = player.stats.atk + Math.floor(Math.random() * 10);
        const expGain = Math.floor(damage / 2);

        player.exp += expGain;
        player.gold += 10;

        if (player.exp >= 100) {
            levelUp(player);
            socket.emit("system", "레벨업!");
        }

        socket.emit("update", player);
    });

    socket.on("jobChange", (newJob) => {
        const player = players[socket.id];
        if (!player || player.level < 5) {
            socket.emit("system", "레벨 5 이상 필요");
            return;
        }

        player.job = newJob;
        player.stats.atk += 10;
        player.stats.def += 5;

        socket.emit("system", "전직 완료");
        socket.emit("update", player);
    });

    socket.on("attackBoss", () => {
        const player = players[socket.id];
        if (!player || !player.guild) return;

        const guild = guilds[player.guild];
        const damage = player.stats.atk + Math.floor(Math.random() * 20);

        guild.bossHp -= damage;
        player.damage += damage;

        if (guild.bossHp <= 0) {
            guild.bossHp = 5000;
            io.emit("system", `길드 ${guild.name} 보스 처치`);
        }

        io.emit("bossUpdate", {
            guild: guild.name,
            hp: guild.bossHp
        });
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running");
});
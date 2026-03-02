const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* ===== 데이터 저장소 (메모리 기반) ===== */

let players = {};   // socket.id 기준
let accounts = {};  // nickname 기준
let guilds = {};    // guildName 기준

/* ===== 기본 스탯 ===== */

function baseStats(job) {
    if (job === "warrior") return { hp: 200, atk: 20, def: 10 };
    if (job === "mage") return { hp: 120, atk: 30, def: 5 };
    if (job === "archer") return { hp: 150, atk: 25, def: 7 };
    return { hp: 150, atk: 20, def: 5 };
}

function levelUp(player) {
    player.level++;
    player.exp = 0;
    player.stats.atk += 5;
    player.stats.def += 3;
    player.stats.hp += 20;
}

/* ===== 소켓 연결 ===== */

io.on("connection", (socket) => {

    /* ===== 회원가입 ===== */

    socket.on("register", ({ nickname, job }) => {

        if (!nickname || accounts[nickname]) {
            socket.emit("system", "이미 존재하거나 잘못된 닉네임");
            return;
        }

        const newPlayer = {
            nickname,
            job,
            level: 1,
            exp: 0,
            gold: 0,
            guild: null,
            stats: baseStats(job),
            damage: 0,
            jobChanged: false
        };

        accounts[nickname] = newPlayer;
        players[socket.id] = newPlayer;

        socket.emit("loginSuccess", newPlayer);
        io.emit("system", `${nickname} 접속`);
    });

    /* ===== 전체 채팅 ===== */

    socket.on("chat", (msg) => {
        const player = players[socket.id];
        if (!player) return;

        io.emit("chat", `${player.nickname}: ${msg}`);
    });

    /* ===== 길드 채팅 ===== */

    socket.on("guildChat", (msg) => {
        const player = players[socket.id];
        if (!player || !player.guild) return;

        const guild = guilds[player.guild];
        if (!guild) return;

        guild.members.forEach(memberNick => {
            for (let id in players) {
                if (players[id].nickname === memberNick) {
                    io.to(id).emit("chat", `[길드] ${player.nickname}: ${msg}`);
                }
            }
        });
    });

    /* ===== 길드 생성 ===== */

    socket.on("createGuild", (name) => {
        const player = players[socket.id];
        if (!player || guilds[name]) {
            socket.emit("system", "길드 생성 실패");
            return;
        }

        guilds[name] = {
            name,
            members: [player.nickname],
            bossHp: 5000
        };

        player.guild = name;
        socket.emit("system", "길드 생성 완료");
    });

    /* ===== 길드 가입 ===== */

    socket.on("joinGuild", (name) => {
        const player = players[socket.id];
        const guild = guilds[name];

        if (!player || !guild) {
            socket.emit("system", "길드 없음");
            return;
        }

        if (!guild.members.includes(player.nickname)) {
            guild.members.push(player.nickname);
        }

        player.guild = name;
        socket.emit("system", "길드 가입 완료");
    });

    /* ===== 사냥 ===== */

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

    /* ===== 전직 ===== */

    socket.on("jobChange", (newJob) => {
        const player = players[socket.id];

        if (!player || player.level < 5 || player.jobChanged) {
            socket.emit("system", "전직 불가 (레벨5 이상 & 1회만 가능)");
            return;
        }

        player.job = newJob;
        player.stats.atk += 10;
        player.stats.def += 5;
        player.jobChanged = true;

        socket.emit("system", "전직 완료");
        socket.emit("update", player);
    });

    /* ===== 길드 보스 공격 ===== */

    socket.on("attackBoss", () => {
        const player = players[socket.id];
        if (!player || !player.guild) return;

        const guild = guilds[player.guild];
        if (!guild) return;

        const damage = player.stats.atk + Math.floor(Math.random() * 20);

        guild.bossHp -= damage;
        if (guild.bossHp < 0) guild.bossHp = 0;

        player.damage += damage;

        if (guild.bossHp === 0) {
            io.emit("system", `길드 ${guild.name} 보스 처치`);
            guild.bossHp = 5000;
        }

        io.emit("bossUpdate", {
            guild: guild.name,
            hp: guild.bossHp
        });
    });

    /* ===== 연결 종료 ===== */

    socket.on("disconnect", () => {
        delete players[socket.id];
    });

});

/* ===== 서버 실행 ===== */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
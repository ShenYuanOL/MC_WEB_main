// LiteLoader-AIDS automatic generated
/// <reference path="lib/dts/HelperLib-master/src/index.d.ts"/>

let fs = require("fs");
const { sqlite } = require("./yoyo.js");
var wsc = new WSClient();

//#配置文件检查
let configdata = new JsonConfigFile(`./plugins/MC_WEB/config.json`, JSON.stringify({
    "webSocket": "ws://localhost:11072",
    "setInterval": 10000,
}));

//~预设值区===========================
//配置文件
var config = {
    "getWebsocket": function () {
        configdata.reload()
        return configdata.get("webSocket")
    },
    "getSerInterval": function () {
        configdata.reload()
        return configdata.get("setInterval")
    }
}
//死亡列表
const damageCauseMap = {
    [-0x01]: "其他",
    [0x00]: "非正常方式",
    [0x01]: "接触伤害（如仙人掌）",
    [0x02]: "实体攻击",
    [0x03]: "抛射物攻击",
    [0x04]: "窒息（密封空间）",
    [0x05]: "掉落",
    [0x06]: "着火",
    [0x07]: "着火",
    [0x08]: "熔岩",
    [0x09]: "溺水",
    [0x0a]: "方块爆炸",
    [0x0b]: "实体爆炸",
    [0x0c]: "虚空",
    [0x0d]: "自杀",
    [0x0e]: "尖牙对生物造成的伤害、守卫者对生物造成的魔法伤害和药水伤害等",
    [0x0f]: "凋零效果",
    [0x10]: "饥饿",
    [0x11]: "下落的铁砧",
    [0x12]: "荆棘",
    [0x13]: "下落的方块",
    [0x14]: "活塞",
    [0x15]: "动态能量（滑翔撞墙）",
    [0x16]: "岩浆块",
    [0x17]: "烟花",
    [0x18]: "闪电",
    [0x19]: "神秘死法",
    // [0x19]: '？？？',
    [0x1a]: "温度 （雪人？）",
    [0x1b]: "冰冻",
    [0x1c]: "被钟乳石砸到",
    [0x1d]: "掉落到石笋上",
    [0x1f]: "所有",
};
//用于缓存监听玩家产生的数据变化
let changes = {};
//时间格式化
function formatDate() {
    const date = new Date(Date.now());
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
    )}-${String(date.getDate()).padStart(2, "0")}-${String(
        date.getHours()
    ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(
        date.getSeconds()
    ).padStart(2, "0")}`;
};
//维度
const dimMap = {
    0: "主世界",
    1: "末地",
    2: "下界",
};
//~预设值区===========================

//#插件初始化
logger.info("MC_WEB 插件已加载");
LogFile("MC_WEB", `插件已加载`);
WebSockET(); //启动WebSocket
checkDataBase(); //连接数据库

//#ws通信
function WebSockET() {
    Ws_log("AD", "插件已接入", "admin");
    logger.info(CheckWS());
    LogFile("WebSocket", CheckWS());
}
//但是会出现websocket产生单个端口多个连接发送消息，偶发情况，少见
wsc.connect(config.getWebsocket());
function Ws_log(type, message, identifier) {
    const logMessage = {
        type: type,
        message: message,
        identifier: identifier,
    };
    wsc.send(JSON.stringify(logMessage));
}
function CheckWS() {
    if (!wsc) {
        return "WebSocket 服务未接入，WEB端日志将无法输出（不影响插件运行）";
    } else {
        return "WebSocket 服务已成功接入";
    }
}
//#数据库校验与创建
function checkDataBase() {
    let path = "./plugins/MC_WEB/data.db";
    if (!fs.existsSync(path)) {
        var isSetConfig = sqlite.connectDb({
            path: path,
            create: true,
        });
        Ws_log("AD", "数据库文件不存在，已自动创建", "admin");
        logger.info("数据库文件不存在，已自动创建");
        LogFile("MC_WEB", "数据库文件不存在，已自动创建");
        //创建表
        let sql = sqlite.createTable("MC_user", {
            id: {
                key: true, //是否为主键(每个表只有一个)
                auto: true, //默认true 如果不需要自增可以设置false
            },
            xuid: {
                type: "TEXT", //字段类型
                unique: true, //是否保持唯一值
            },
            name: {
                type: "varchar(30)",
            },
            fristjoin: {
                type: "TEXT",
            },
        });
        let sqll = sqlite.createTable("MC_userData", {
            id: {
                key: true, //是否为主键(每个表只有一个)
                auto: true, //默认true 如果不需要自增可以设置false
            },
            xuid: {
                type: "TEXT", //字段类型
                unique: true, //是否保持唯一值
            },
            pl_join: {
                type: "int",
            },
            pl_die: {
                type: "int",
            },
            pl_chat: {
                type: "int",
            },
            pl_jump: {
                type: "int",
            },
            pl_kill: {
                //攻击实体，监听被攻击实体的死亡事件
                type: "int",
            },
            pl_ate: {
                type: "int",
            },
            pl_destroy: {
                //破坏方块（破坏完成）
                type: "int",
            },
            pl_place: {
                //放置方块（放置完成）
                type: "int",
            },
            // pl_move:{//玩家移动格数
            //     type:'int'
            // }
        });
    } else {
        var isSetConfig = sqlite.connectDb({
            path: path,
            create: false,
        });
        logger.info("数据库已连接");
    }
}

//#玩家数据监听
mc.listen("onJoin", (pl) => {
    const haspl = sqlite.table("MC_user").where("xuid", pl.xuid).find();
    const joinpl = sqlite.table("MC_userData").where("xuid", pl.xuid).find();
    if (!haspl) {
        const MC_user = sqlite
            .table("MC_user")
            .insert({ xuid: pl.xuid, name: pl.name, fristjoin: formatDate() });
        logger.info("玩家首次加入游戏，已将其添加到数据库");
    }
    if (!joinpl) {
        const result = sqlite.table("MC_userData").insert({
            xuid: pl.xuid,
            pl_join: 1,
            pl_die: 0,
            pl_chat: 0,
            pl_jump: 0,
            pl_kill: 0,
            pl_ate: 0,
            pl_destroy: 0,
            pl_place: 0,
        });
    } else {
        const result = sqlite
            .table("MC_userData")
            .where("xuid", pl.xuid)
            .update({ pl_join: joinpl.pl_join + 1 });
    }

    Ws_log("sever", `${pl.name} 加入了游戏`, "all");
    LogFile("sever", `${pl.name} 加入了游戏`);
});


function recordChange(pl, value) {
    if (!changes[pl.xuid]) {
        changes[pl.xuid] = {};
    }
    if (!changes[pl.xuid][value]) {
        changes[pl.xuid][value] = 0;
    }
    changes[pl.xuid][value] += 1;
}

mc.listen("onPlayerDie", (pl) => {
    recordChange(pl, "pl_die");
});

mc.listen("onChat", (pl, msg) => {
    recordChange(pl, "pl_chat");
    Ws_log("playerChat", `${pl.name} 说: ${msg}`, "all");
    LogFile("playerChat", `${pl.name} 说: ${msg}`);
});

mc.listen("onJump", (pl) => {
    recordChange(pl, "pl_jump");
});

mc.listen("onAte", (pl) => {
    recordChange(pl, "pl_ate");
});

mc.listen("onDestroyBlock", (pl) => {
    recordChange(pl, "pl_destroy");
});

mc.listen("afterPlaceBlock", (pl) => {
    recordChange(pl, "pl_place");
});

// mc.listen("onMobDie", (mob, en) => {
//     if (en) {
//         // 这层if是为了防止触发该事件时输出奇怪的报错
//         const people = mc.getOnlinePlayers().find((p) => p.name === en.name);
//         if (people) {
//             const killer = en.toPlayer();
//             recordChange(killer, "pl_kill");
//         }
//     }
// });

//#事件监听
mc.listen("onPreJoin", (pl) => {
    Ws_log("sever", `${pl.name} 正在连接服务器...`, "admin");
    LogFile("sever", `${pl.name} 正在连接服务器...`);
});

mc.listen("onLeft", (pl) => {
    Ws_log("sever", `${pl.name} 退出游戏`, "all");
    LogFile("sever", `${pl.name} 退出游戏`);
});

// mc.listen("onMobDie", (mob, source, cause) => {
//     let pl = mc.getOnlinePlayers().find((p) => p.name === mob.name);
//     if (pl) {
//         if (source !== undefined) {
//             Ws_log("sever", `${pl.name} 死亡,因为${source.name}`, "user");
//             Ws_log("playerDie", `${pl.name} 死亡,死因：${source.name}`, "admin");
//             LogFile("playerDie", `${pl.name} 死亡,死因：${source.name}`);
//         } else {
//             const causeDescription = damageCauseMap[cause] || "未知";
//             Ws_log("server", `${pl.name} 死亡,因为${causeDescription}`, "user");
//             Ws_log("playerDie", `${pl.name} 死亡,死因: ${causeDescription}`, "admin");
//             LogFile("playerDie", `${pl.name} 死亡,死因: ${causeDescription}`);
//         }
//     }
// });

mc.listen("onMobDie", (mob, source, cause) => {
    let pl = mc.getOnlinePlayers().find((p) => p.name === mob.name);
    if (pl) {
        if (source !== undefined) {
            Ws_log("sever", `${pl.name} 死亡,因为${source.name}`, "user");
            Ws_log("playerDie", `${pl.name} 死亡,死因：${source.name}`, "admin");
            LogFile("playerDie", `${pl.name} 死亡,死因：${source.name}`);
        } else {
            const causeDescription = damageCauseMap[cause] || "未知";
            Ws_log("server", `${pl.name} 死亡,因为${causeDescription}`, "user");
            Ws_log("playerDie", `${pl.name} 死亡,死因: ${causeDescription}`, "admin");
            LogFile("playerDie", `${pl.name} 死亡,死因: ${causeDescription}`);
        }
    }
    if (source) {
        // 这层if是为了防止触发该事件时输出奇怪的报错
        const people = mc.getOnlinePlayers().find((p) => p.name === source.name);
        if (people) {
            const killer = source.toPlayer();
            recordChange(killer, "pl_kill");
        }
    }
});

mc.listen("onPlayerCmd", (pl, cmd) => {
    Ws_log("playerCmd", `${pl.name} 输入了命令: ${cmd}`, "admin");
    LogFile("playerCmd", `${pl.name} 输入了命令: ${cmd}`);
});

mc.listen("onRespawn", (pl) => {
    Ws_log(
        "playerRespawn",
        `${pl.name} 重生，重生坐标${pl.getRespawnPosition()}，死亡坐标${pl.lastDeathPos
        }`,
        "admin"
    );
    LogFile(
        "playerRespawn",
        `${pl.name} 重生，重生坐标${pl.getRespawnPosition()}，死亡坐标${pl.lastDeathPos
        }`
    );
});

mc.listen("onChangeDim", (pl, dimid) => {
    Ws_log(
        "playerChangeDim",
        `${pl.name} 切换了维度，当前维度${dimMap[dimid]}`,
        "admin"
    );
    LogFile("playerChangeDim", `${pl.name} 切换了维度，当前维度${dimMap[dimid]}`);
});

//#数据定时写入
function batchUpdate() {
    for (const xuid in changes) {
        const data = changes[xuid];
        const find = sqlite.table("MC_userData").where("xuid", xuid).find();

        const updateData = {};
        for (const key in data) {
            updateData[key] = (find[key] || 0) + data[key];
        }

        sqlite.table("MC_userData").where("xuid", xuid).update(updateData);
    }

    // 清空缓存
    changes = {};
}

// 每隔10秒执行一次批量更新
setInterval(batchUpdate, config.getSerInterval());

//#日志文件入系统
function getTime() {
    var time = new Date();
    var year = time.getFullYear();
    var month = String(time.getMonth() + 1).padStart(2, "0");
    var day = String(time.getDate()).padStart(2, "0");
    var hours = String(time.getHours()).padStart(2, "0");
    var minutes = String(time.getMinutes()).padStart(2, "0");
    var seconds = String(time.getSeconds()).padStart(2, "0");

    var formattedTime = `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`;
    return formattedTime;
}
function LogFile(type, msg) {
    const check_log = File.exists("plugins/MC_WEB/log.txt");
    if (!check_log) {
        logger.info("MC_WEB 日志文件不存在,正在创建");
        fs.writeFile(
            "plugins/MC_WEB/log.txt",
            `[${getTime()}][MC_WEB]this log created at ${getTime()}\n`,
            "utf-8",
            function (err) {
                if (err) throw err;
                logger.info("MC_WEB 日志文件创建成功.");
            }
        );
    } else {
        fs.appendFile(
            "plugins/MC_WEB/log.txt",
            `[${getTime()}][${type}]${msg}\n`,
            "utf-8",
            function (err) {
                if (err) throw err;
            }
        );
    }
}

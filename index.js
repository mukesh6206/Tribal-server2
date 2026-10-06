const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({
        status: "online",
        service: "Tribal relay"
    }));
});

const wss = new WebSocket.Server({
    server,
    path: "/ws"
});

const children = new Map();
const parents = new Map();

wss.on("connection", (ws) => {
    console.log("WEBSOCKET CONNECTED");

    let role = null;
    let id = null;

    ws.on("message", (data, isBinary) => {
        if (isBinary) {
            if (role === "child" && id) {
                const parent = parents.get(id);

                if (parent && parent.readyState === WebSocket.OPEN) {
                    parent.send(data, {binary: true});
                }
            }
            return;
        }

        try {
            const msg = JSON.parse(data.toString());

            console.log("MESSAGE:", msg);

            if (msg.type === "child") {
                role = "child";
                id = String(msg.child || "child1");

                children.set(id, ws);

                console.log("CHILD CONNECTED:", id);

                ws.send(JSON.stringify({
                    status: "child-registered",
                    child: id
                }));
            }

            else if (msg.type === "parent") {
                role = "parent";
                id = String(msg.child || "child1");

                parents.set(id, ws);

                console.log("PARENT CONNECTED:", id);

                ws.send(JSON.stringify({
                    status: "parent-connected",
                    child: id
                }));
            }

            else if (msg.type === "command" && msg.child) {
                const childId = String(msg.child);
                const child = children.get(childId);

                console.log(
                    "COMMAND:",
                    msg.cmd,
                    "TO:",
                    childId,
                    "ONLINE:",
                    !!child
                );

                if (child && child.readyState === WebSocket.OPEN) {
                    child.send(JSON.stringify({
                        type: "command",
                        child: childId,
                        cmd: String(msg.cmd || "")
                    }));

                    console.log("COMMAND SENT TO CHILD:", childId);
                } else {
                    ws.send(JSON.stringify({
                        status: "child-offline"
                    }));

                    console.log("CHILD OFFLINE:", childId);
                }
            }

        } catch (e) {
            console.log("MESSAGE ERROR:", e.message);
        }
    });

    ws.on("close", () => {
        console.log("WEBSOCKET CLOSED:", role, id);

        if (role === "child" && children.get(id) === ws) {
            children.delete(id);
            console.log("CHILD REMOVED:", id);
        }

        if (role === "parent" && parents.get(id) === ws) {
            parents.delete(id);
            console.log("PARENT REMOVED:", id);
        }
    });

    ws.on("error", (err) => {
        console.log("WEBSOCKET ERROR:", err.message);
    });
});

server.listen(3000, () => {
    console.log("Tribal server listening on :3000");
});

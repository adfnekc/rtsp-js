import Koa from "koa";
import websockify from "koa-websocket";
import { router, wsRouter } from "./router.js";

const app = websockify(new Koa());
const listenPort = 9999;

app.use(router.routes()).use(router.allowedMethods());
app.ws.use(wsRouter.routes()).use(wsRouter.allowedMethods());

app.listen(listenPort, "127.0.0.1");
console.log(`listening on https://127.0.0.1:${listenPort}/...`);

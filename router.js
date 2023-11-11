import { createVideoStream } from "./videoStream.js";
import Router from "koa-router";

let router = new Router();
router.all("/", async (ctx, next) => {
  ctx.status = 500;
  return;
});

let wsRouter = new Router();
wsRouter.all("/rtsp", async (ctx, next) => {
  if (!("rtsp_url" in ctx.query)) {
    ctx.websocket.close();
    return;
  }
  let rtsp_url = ctx.query["rtsp_url"];
  console.log("open rtsp: ", rtsp_url);

  try {
    let video = getvideo(ctx, rtsp_url);
    ctx.websocket.on("connection", (socket, request) => {
      onSocketConnect(socket, request, video);
    });

    ctx.websocket.on("close", (code, reason) => {
      video.close();
      if (code == "1001") {
        return "";
      }
      console.log("websocket on close", code, reason);
    });

    video.on("camdata", (data) => {
      // console.log("on camdata", data);
      return ctx.websocket.send(data);
    });
  } catch (error) {
    console.error(error);
  }
});

function getvideo(ctx, rstp_url) {
  if (!ctx.app.videos) ctx.app.videos = {};
  if (rstp_url in ctx.app.videos && ctx.app.videos[rstp_url].closed == false) return ctx.app.videos[rstp_url]

  let video = createVideoStream(rstp_url);
  ctx.app.videos[rstp_url] = video;

  video.on("camdata", (data) => {
    video.timeoutId && clearTimeout(video.timeoutId);
    video.timeoutId = setTimeout(() => {
      video.close();
    }, 1000 * 20);
  });
  video.on("close", () => {
    ctx.app.videos[rstp_url] && delete ctx.app.videos[rstp_url];
  });
  return video;
}

function onSocketConnect(socket, request, video) {
  console.log("on connection");
  let streamHeader;
  // Send magic bytes and video size to the newly connected socket
  // struct { char magic[4]; unsigned short width, height;}
  streamHeader = Buffer.alloc(8);
  streamHeader.write(STREAM_MAGIC_BYTES);
  streamHeader.writeUInt16BE(video.width || 1920, 4);
  streamHeader.writeUInt16BE(video.height || 1080, 6);
  socket.send(streamHeader, {
    binary: true,
  });
  console.log(`New WebSocket Connection (${socket}) total)`);

  socket.remoteAddress = request.connection.remoteAddress;
}

export { router, wsRouter };

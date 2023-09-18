import ws from "ws";
import util from "util";
import events from "events";
import child_process from "child_process";

function Mpeg1Muxer(options) {
  this.url = options.url;
  this.ffmpegOptions = options.ffmpegOptions;
  this.exitCode = undefined;
  this.additionalFlags = [];
  if (this.ffmpegOptions) {
    for (let key in this.ffmpegOptions) {
      this.additionalFlags.push(key);
      if (String(this.ffmpegOptions[key]) !== "") {
        this.additionalFlags.push(String(this.ffmpegOptions[key]));
      }
    }
  }
  this.spawnOptions = [
    "-rtsp_transport",
    "tcp",
    "-i",
    this.url,
    "-f",
    "mpegts",
    "-codec:v",
    "mpeg1video",
    // additional ffmpeg options go here
    ...this.additionalFlags,
    "-",
  ];
  this.stream = child_process.spawn(options.ffmpegPath, this.spawnOptions, {
    detached: false,
  });
  this.inputStreamStarted = true;
  this.stream.stdout.on("data", (data) => {
    return this.emit("camdata", data);
  });
  this.stream.stderr.on("data", (data) => {
    return this.emit("ffmpegStderr", data);
  });
  this.stream.on("exit", (code, signal) => {
    if (code === 1) {
      console.error("RTSP stream exited with error");
      this.exitCode = 1;
      return this.emit("exitWithError");
    }
  });

  this.close = () => {
    this.stream.kill("SIGINT");
  };
  return this;
}

util.inherits(Mpeg1Muxer, events.EventEmitter);

const STREAM_MAGIC_BYTES = "jsmp"; // Must be 4 bytes

function createVideoStream(rstp_url, ffmpegOptions = {}) {
  let video = new Mpeg1Muxer({
    ffmpegOptions: ffmpegOptions,
    url: rstp_url,
    ffmpegPath: ffmpegOptions.ffmpegPath ? ffmpegOptions.ffmpegPath : "ffmpeg",
  });
  let gettingInputData = false;
  let inputData = [];
  video.on("ffmpegStderr", (data) => {
    let size;
    data = data.toString();
    if (data.indexOf("Input #") !== -1) {
      gettingInputData = true;
    }
    if (data.indexOf("Output #") !== -1) {
      gettingInputData = false;
    }
    if (gettingInputData) {
      inputData.push(data.toString());
      size = data.match(/\d+x\d+/);
      if (size != null) {
        size = size[0].split("x");
        if (video.width == null) video.width = parseInt(size[0], 10);
        if (video.height == null) video.height = parseInt(size[1], 10);
      }
    }
  });
  video.on("ffmpegStderr", function (data) {
    return global.process.stderr.write(data);
  });
  return video;
}

export { createVideoStream };

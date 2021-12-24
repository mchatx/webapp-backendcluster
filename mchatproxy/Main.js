const YTHandler = require("./src/youtube");
const TWHandler = require("./src/twitch");
const TCHandler = require("./src/twitcast");
const BLHandler = require("./src/bilibili");
const INHandler = require("./src/17live");

const axios = require('axios');
const request = require('request');

const parse = require('node-html-parser');
const express = require("express")
const cors = require('cors')
const bodyParser = require("body-parser")
const compression = require('compression');
const Config = require('../Config/Config.json');

const PORT = process.env.PORT || 31023
const app = express()
app.use(bodyParser.json( { limit: '20mb'} ))
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }))
app.use(cors(corsOptions));
//app.use(cors());
app.use(compression());

const head = {'user-agent': 'Mozilla5.0 (Windows NT 10.0; Win64; x64) AppleWebKit537.36 (KHTML, like Gecko) Chrome75.0.3770.142 Safari537.36'}    

var corsOptions = {
  origin: Config.CORSOrigin,
  optionsSuccessStatus: 200 
}

//-----------------------------------------  SERVER HANDLER  -----------------------------------------
app.get('/ChatProxy', async function (req, res) {
  console.log(req.query);
  if (req.query.link) {
    switch(req.query.link.substring(0,3)){
      case "YT_":
        req.query.link = req.query.link.substring(3);
        request("https://www.youtube.com/watch?v=" + req.query.link, function (error, response, body) {
          if (error){
            return res.status(400).send("NOT OK");
          }
  
          if (body.indexOf('<meta itemprop="channelId"') == -1){
            return res.status(400).send("NOT OK");
          }
  
          var idx = body.indexOf('content="', body.indexOf('<meta itemprop="channelId"'));
  
          if (idx == -1){
            return res.status(400).send("NOT OK");
          }
  
          idx += ('content="').length;
          req.query.channel = body.substr(idx, body.indexOf('">', idx) - idx);
  
          YTHandler.MainGate(req, res);
          });
        break;
      case "TW_":
        req.query.link = req.query.link.substring(3);
        req.query.channel = req.query.link;
        TWHandler.MainGate(req, res);
        break;
      case "TC_":
        req.query.link = req.query.link.substring(3);
        req.query.channel = req.query.link;
        TCHandler.MainGate(req, res);
        break;
      case "NL_":
        res.status(400).send("Unable to handle this stream link");
        break;
      case "BL_":
        req.query.link = req.query.link.substring(3);
        req.query.channel = req.query.link;
        BLHandler.MainGate(req, res);
        break;
      case "IN_":
        req.query.link = req.query.link.substring(3);
        req.query.channel = req.query.link;
        INHandler.MainGate(req, res);
        break;
      default:
        return res.status(400).send("Unable to handle this stream link");
    }
  } else if (req.query.channel) {
    switch(req.query.channel.substring(0,3)){
      case "YT_":
        req.query.channel = req.query.channel.substring(3);
        var res2 = await axios.get("https://www.youtube.com/channel/" + req.query.channel+ "/live", {headers: head});
        let idx = res2.data.indexOf('"liveStreamabilityRenderer":{"videoId":"');
      
        if (idx == -1){
          return res.status(400).send("NOT LIVE");
        }
        idx += ('"liveStreamabilityRenderer":{"videoId":"').length;
      
        req.query.link = res2.data.substring(idx, res2.data.indexOf('","', idx));
        YTHandler.MainGate(req, res);
        break;
      case "TW_":
        req.query.channel = req.query.channel.substring(3);
        req.query.link = req.query.channel;
        TWHandler.MainGate(req, res);
        break;
      case "TC_":
        req.query.channel = req.query.channel.substring(3);
        req.query.link = req.query.channel;
        TCHandler.MainGate(req, res);
        break;
      case "NL_":
        res.status(400).send("Unable to handle this stream link");
        break;
      case "BL_":
        req.query.channel = req.query.channel.substring(3);
        req.query.link = req.query.channel;
        BLHandler.MainGate(req, res);
        break;
      case "IN_":
        req.query.channel = req.query.channel.substring(3);
        req.query.link = req.query.channel;
        INHandler.MainGate(req, res);
        break;
      default:
        return res.status(400).send("Unable to handle this stream link");
    }
  } else {
    return res.status(400).send("NO ID TO STREAM");
  }
})

app.get('/AuxData', async function (req, res)  {
  if (!req.query.ChannelID) {
    return res.status(400).send("NO CHANNEL ID");
  }

  if (req.query.ChannelID.slice(0,2) != "TW") {
    return res.status(400).send("ONLY WORKS FOR TWITCH");
  }

  TWHandler.AuxInfo(req, res);
});

app.get('/ChannelLive', async function (req,res) {
  if (!req.query.ChannelID) {
    return res.status(400).send("NO CHANNEL ID");
  }

  var res2 = await axios.get("https://www.youtube.com/channel/" + req.query.ChannelID + "/live", {headers: head});
  let idx = res2.data.indexOf('"liveStreamabilityRenderer":{"videoId":"');

  if (idx == -1){
    return res.status(400).send("NOT LIVE");
  }
  idx += ('"liveStreamabilityRenderer":{"videoId":"').length;

  let vidID = res2.data.substring(idx, res2.data.indexOf('","', idx));
  return res.status(200).send(vidID);  
})

app.listen(PORT, async function () {
  setInterval(YTHandler.Pinger, 1000*10);
  setInterval(TWHandler.Pinger, 1000*10);
  setInterval(TCHandler.Pinger, 1000*10);
  setInterval(TWHandler.SendBucket, 1000*2);
  setInterval(TCHandler.Pinger, 1000*10);
  setInterval(TCHandler.SendBucket, 1000*2);
  console.log(`Server initialized on port ${PORT}`);
})
/*
    {
        "action":15,
        "id":"1ZKp7ZMH-d:0",
        "connectionSerial":6,
        "channel":"15864175",
        "channelSerial":"11dTNUN2AB2SgD36996064:19305",
        "timestamp":1631333669386,
        "messages": [{
            "data":"H4sIAAAAAAAA/5RWzW7jNhB+F56trGXL8c/NdtKFi00b2Ju9FItgRI5lRhSpJSk5auDT3vsOBXrqe7VA36KgZDGSN4uiN803HA7nm+FHvRBb5UgW4XhAStSGK0kWshBiQCQef1RcbvFLgca26JHbA9Pwlgsoxdy+4dD4hPQtx5ODlMpaWyCU2AVSTtPu96rapRVW2GIoIRa4EhC3COPmEtJN0tvnnGsfmYO2nPIc5IXDWI2QoV4rKZHaH4CL1kVVlqG0dybxi4vYUM1j1LfSou54NALtrmTc5AKqB9NblRSgGQe5kXvlMb5vAl+6Qc4sDOrNDVkQGE3243jMAhbhdRBFo30wY8NxEE2m9HrP4tF4QonP+RNkSBbk79+//vXHn/98/e0xhrgiA5JzagtXOEE6j+dhtA+mozkNojmNg3hCw2DPoghDOhlOZ+HVU54Q16ISBVmMRgPCzafNPVnsQRh01vtzMR6iB6Qplx+akHBAcq1YQV0xw9pINGT1dwwswYftB7Ig7mD751UPsCrf8uRgN1RJD8bJWgmlG2PfNSjXVGB/C9BZtQWZ1ukOYO7b7P749/5wHtqdZ6ED3XBtq0u7adAZy871Dj0BK5b4c5yhdWY9lAilK62A3SmGdZxHmrl4Ibni0tYu4cnknoyDtblZvHsHxqA1QTiFPL+CFDLgvyK7kmjfzafheIRRHCBSFkQsGgWzGRsFbD4bRcP5lEb74VUuXYfrXmz+1+bXEzqdTDDAcTQLotkEgphCFFwP4wljs8mMzsN689OpGe96iMNZGD4+5Y8MuKgybpz2jB5D16sSLOj2PnCzQ8mWQniGX9lwm31UKUqyCMMoHA9n40k0IPjcpCBtOkMWv3w34efznUMLbt0LsaATtO//+6CioGm1glc5EMp2xCKue0dV4U4bDkgJgrObQoPlSt4ZshgPh8MBAcmzGtqiUYWm2J7dO9qJOrna01cNU8JrUwxaQ4IuoTmo46o1a8pO57l5yNvlB5DsRsNxZzlN0XNdF+TwFrD43GjE2Q+VKnyJSS0s7vv0+VRPbQziw5mTjsoJXmJzlVZuqCmYrjI2YW7SH3IGFrsuyPBiH95RSsfFpmcL0bUzZBzu0JiaiW62pZSqkBQv5Pz1oPdaZappk/dazUsOPY1nt7JEoXK8LVHabu5L361kb0duMeGq9wCUyvbK0oqmnzgeUZvOFlm11Fn1c4m65HjsONC9RMt2dLpPEII93D5jltcOZNBjy/IMd5WknQgnmhtZcnu51V6jOTjVu3z28qzVzO+QscXmFe2ykSlpbD/Cqv6QZKC/FNgdhvadXhrDjYVeH9Exvv7mtS45Q7U+QK/lECu9xSNo5p6Hwt8QBtX6ADLBi5UUeYlNQPd8jSxsMeOSeTLSJb0gLk93VL3eJ3/De2Pczt5med/Fa/35CCbtUcsNl8nOQu+3QqsiX4MQ3+T3njvMYtQ7C7boThWtS3a/YB48/QsAAP//AQAA//9aZ2TuJAoAAA=="
        }]
    }
*/

const axios = require('axios');
const FormData = require('form-data');
const WebSocket = require('ws');
const zlib = require('zlib');
const Config = require('../../Config/Config.json')

const HeaderPrivate = {
    "Content-Type": "text/event-stream",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": Config.CORSOrigin,
    "X-Accel-Buffering": "no"
  }
  
  const HeaderPublic = {
    "Content-Type": "text/event-stream",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no"
  }
  

const ReservedChannel = [
];

//-------------------------------------------------------- LISTENER HANDLER --------------------------------------------------------
var ListenerPack = [];
/*
    ListenerPack {
        ID: channel // ID
        TL: Boolean // AUTO TL OR NOT
        BoolPool: number Check if connection errory before 
        WS: Client for listener,
        WSlink: link to the wss,
        MsgBucket: Bucket to be emptied and processed every 2 seconds
        ConnList: [
            {
                id:
                TL:
                res:
            },
            ...
        ]
    }
*/

function SeekID(VidID){
    if (ListenerPack.length == 0){
        return (-1);
    }

    for (var i = 0; i < ListenerPack.length; i++){
        if (ListenerPack[i].ID == VidID){
            return (i);
        } else if ( i == ListenerPack.length - 1){
            return (-1);
        }
    }
}

async function AddListener(req, res){
  const vidID = req.query.channel;

  var TL = false;
  if (req.query.TL){
    if (req.query.TL == "OK"){
        TL = true;
    }      
  }

  const newID = Date.now();
  const NewConn = {
      id: newID,
      TL: TL,
      res: res      
  };

  res.writeHead(200, HeaderPrivate);
  res.flushHeaders();
  res.write("data: { \"flag\":\"Connect\", \"content\":\"CONNECTED TO SERVER\"}\n\n");

  var indextarget = SeekID(vidID);
  if (indextarget != -1){
      ListenerPack[indextarget].ConnList.push(NewConn);
      if (TL == true){
          ListenerPack[indextarget].TL = true;
      }
  } else {
    const ws = new WebSocket(req.query.wss);

    const Pack = {
        Active: true,
        BoolPool: 0,
        ID: vidID,
        TL: TL,
        WS: ws,
        WSlink: req.query.wss,
        MsgBucket: [],
        ConnList: [NewConn]
    }

    ListenerPack.push(Pack);
    /*
    ws.onopen = function (event) {
        console.log("CONNECTED");
    };
    
    ws.onclose = function (event) {
        console.log("CLOSED");
    };
    */
    ws.onmessage = function (event) {
        JSON.parse(event.data).forEach(e => {
            switch (e.type) {
                case "gift":
                    console.log({
                        type: e.type,
                        author: e.sender.name,
                        screenName: e.sender.screenName,
                        thumbnailURL: e.sender.profileImage,
                        message: decodeURIComponent(e.message),
                        item: e.item
                    });
                    break;
            
                case "comment":
                    console.log("comment");
                    var TLContent = decodeURIComponent(e.message),
                    TLContent = TLContent.replace(/https:\/\/[^\s]*/g, "").trim();
            
                    Pack.MsgBucket.push({
                        author: e.author.name,
                        screenname: e.author.screenName,
                        thumbnailURL: e.author.profileImage,
                        message: decodeURIComponent(e.message),
                        TL: TLContent
                    })
                    break;
                
                default:
                    console.log(e.type);
                    break;
            }
        });
    };
  }

  req.on('close', () => {
    const idx = SeekID(vidID);
    if (idx != -1){
        ListenerPack[idx].ConnList = ListenerPack[idx].ConnList.filter(c => c.id !== newID);
        if (ListenerPack[idx].ConnList.length == 0){
            ListenerPack[idx].WS.close()
            ListenerPack.splice(idx, 1);
        } else if (TL == true) {
            if (ListenerPack[idx].ConnList.filter(c => c.TL == true).length == 0){
                ListenerPack[idx].TL = false;
            }
        }
        
    }
  });
}

function broadcastTL(idx, data){
    if (ListenerPack[idx]){
        ListenerPack[idx].ConnList.filter(c => c.TL == true).forEach(c => c.res.write("data:" + data + "\n\n"));
    }    
}

function broadcastNormal(idx, data){
    if (ListenerPack[idx]){
        ListenerPack[idx].ConnList.filter(c => c.TL != true).forEach(c => c.res.write("data:" + data + "\n\n"));
    }    
}

function broadcastAll(idx, data) {
    if (ListenerPack[idx]){
        ListenerPack[idx].ConnList.forEach(c => c.res.write("data:" + data + "\n\n"));
    }    
}


async function BroadcastDelete(CID, VID){
    if (CID != undefined){    
      //UCmRd9ZiaD41vCqfJ3K5JrpQ meta itemprop="name"
      var res = await axios.get("https://www.youtube.com/channel/" + CID, {headers: head});
      let idx = res.data.indexOf('<meta itemprop="name"');
      
      if (idx == -1) {
        return;
      }
  
      idx = res.data.indexOf('content="', idx);
      if (idx == -1) {
        return(400);
      }
      idx += ('content="').length;
      let text = res.data.substr(idx, res.data.indexOf('">', idx) - idx);
  
      idx = SeekID(VID);
      if (idx != -1){
        ListenerPack[idx].ConnList.forEach(c => {
          c.res.write("data: { \"flag\":\"DELETE\", \"Nick\":\"" + text + "\"}\n\n");
          c.res.flush();
        });
      }
    }
  }

function FlushCloseConnections(idx) {
    for(;ListenerPack[idx].ConnList.length != 0;){
        ListenerPack[idx].ConnList[0].res.write("data: { \"flag\":\"MSG Fetch Stop\", \"content\":\"MSG Fetch Stop\" }\n\n");
        ListenerPack[idx].ConnList[0].res.end();
        ListenerPack[idx].ConnList.splice(0, 1);
        if (ListenerPack[idx].ConnList.length == 0){
            ListenerPack.splice(idx, 1);
            break;
        }
    }
}

exports.SendBucket = async function() {
    ListenerPack.forEach(async (e) => {
        var MsgChunk = e.MsgBucket.splice(0, e.MsgBucket.length);
        var TLContent = [];
        for (let i = 0; i < MsgChunk.length; i++) {
            let s = MsgChunk[i].TL;
      
            switch (s.toLowerCase()) {
                case "lol":
                    MsgChunk[i].TL = "草";
                    continue;
  
                case "lmao":
                    MsgChunk[i].TL = "大草原";
                    continue;
  
                case "rofl":
                    MsgChunk[i].TL = "天まで広がる大草原";
                    continue;
            }

            s = s.replace(/w{3,}/gi, "草");

            if (s.length < 16){
                delete MsgChunk[i].TL;
                continue;
            }
    
            //  SKIP IF THERE'S A TRANSLATION BRACKET
            if (s.match(/\[.*\w\w.*\]|\(.*\w\w.*\)/) != null){
                delete MsgChunk[i].TL;
                continue;
            }
    
            //  CANCEL IF THERE'S NO MORE THAN 3 CONSECUTIVE LETTERS
            if (s.match(/\p{L}\p{L}\p{L}\p{L}+/u) == null){
                delete MsgChunk[i].TL;
                continue;
            }
    
            //  REMOVE EMOJIS
            s = s.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
            let s2 = s.replace(/\s/g, '');
    
            //  SKIP IF LESS THAN 3
            if (s2.length < 4){
                delete MsgChunk[i].TL;
                continue;
            }
      
            //  CANCEL IF LESS THAN HALF IS JAPANESE CHARACTERS
            if (s2.replace(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/g, '').length*4.0 < s2.length*3.0){
                delete MsgChunk[i].TL;
                continue;
            }
    
            s = s.trim();
    
            //  REPLACE ALL THE REPEATING MORE THAN 3 TIMES
            s2 = s.match(/(.+)\1{3,}/ug)
            if (s2 != null){
                s2.forEach(e => {
                    for (let dt = e[0], i = 0; dt.length != e.length; dt += e[++i]){
                        if (e.replace(new RegExp(dt.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'g'), '') == ""){
                            switch (dt.length) {
                                case 1:
                                    s = s.replace(e, dt + dt + dt);
                                    break;
                                case 2:
                                    s = s.replace(e, dt + dt);
                                    break;
                                default:
                                    s = s.replace(e, dt);
                                    break;
                            }
                        break;
                        }
                    }
                });
            }
  
            switch (s.toLowerCase()) {
                case "lol":
                    MsgChunk[i].TL = "草";
                    break;
  
                case "lmao":
                    MsgChunk[i].TL = "大草原";
                    break;
  
                case "rofl":
                    MsgChunk[i].TL = "天まで広がる大草原";
                    break;
          
                default:
                    MsgChunk[i].TL = "ok";
                    TLContent.push(s);
                break;
            }
        }

        //  GET TRANSLATION
        if (TLContent.length != 0){
            var textlist = "";
            TLContent.forEach(dt => {
                textlist += "text=" + dt + "&";
            });

            textlist = "auth_key=" + Config.DeepLAPIKey + "&" + textlist + "target_lang=JA";

            const TLres = await axios.post("https://api-free.deepl.com/v2/translate", textlist).catch(e => e.response)
            console.log(TLres.status);
            console.log(TLres.data.translations);

            if (TLres.status == 200){
                let j = 0;
                for(let i = 0; i < MsgChunk.length; i++){
                    if (MsgChunk[i].TL){
                        if (MsgChunk[i].TL == "ok"){
                            MsgChunk[i].TL = TLres.data.translations[j++].text;
                            if(j == TLres.data.translations.length){
                                break;
                            }
                        }
                    }        
                }

                e.ConnList.forEach(c => c.res.write("data:" + JSON.stringify(MsgChunk) + "\n\n"));
            } else {
                for(let i = 0; i < MsgChunk.length; i++){
                    if (MsgChunk[i].TL){
                        delete MsgChunk[i].TL;
                    }
                }
                e.ConnList.forEach(c => c.res.write("data:" + JSON.stringify(MsgChunk) + "\n\n"));
            }  
        } else {
            e.ConnList.forEach(c => c.res.write("data:" + JSON.stringify(MsgChunk) + "\n\n"));
        }    
    });
}

exports.Pinger = function() {
    for(i = 0; i < ListenerPack.length;){
        if (ListenerPack[i].Active){
            if (ListenerPack[i].ConnList.length == 0){
                ListenerPack.splice(i, 1);
            } else {
                ListenerPack[i].Active = false;
                ListenerPack[i].BoolPool = 0;
                i++;
            }
        } else {
            ListenerPack[i].BoolPool += 1;
            if (ListenerPack[i].BoolPool == 30){
                for(;ListenerPack[i].ConnList.length != 0;){
                    ListenerPack[i].ConnList[0].res.write("data: { \"flag\":\"timeout\", \"content\":\"Timeout\" }\n\n");
                    ListenerPack[i].ConnList[0].res.end();
                    ListenerPack[i].ConnList.splice(0, 1);
                    if (ListenerPack[i].ConnList.length == 0){
                        ListenerPack.splice(i, 1);
                        break;
                    }
                }
            } else {
                broadcastTL(i, "{}");
                broadcastNormal(i, "{}");
                i++;
            }
        }
    }
}
//======================================================== LISTENER HANDLER ========================================================



exports.MainGate = async function (req, res) {
    return res.status(400).send("Unable to handle this stream link");
    //startws(req, res);
    /*
    if (req.query.link.indexOf("/") == -1){
        req.query.channel = req.query.link;

        const idx = SeekID(req.query.channel);

        if (idx != -1){
            GrabWSLink(req, res);
        } else {
            request("https://frontendapi.twitcasting.tv/users/" + req.query.channel + "/latest-movie", function (error, response, body) {
                if (error){
                  return res.status(400).send("NOT OK");
                }
            
                try {
                    body = JSON.parse(body);    
                } catch (error) {
                    return res.status(400).send("NOT OK");
                }
                
                if (!body.movie.is_on_live){
                    return res.status(400).send("NOT LIVE");
                } else {
                    req.query.link = body.movie.id;
                    GrabWSLink(req, res);        
                }
            });
        }
    } else {
        req.query.channel = req.query.link.split("/")[0];
        req.query.link = req.query.link.split("/")[1];
        GrabWSLink(req, res);
    }
    */
}

function GrabWSLink(req, res){
    const idx = SeekID(req.query.channel);
    if (idx == -1){
        var bodyFormData = new FormData();
        bodyFormData.append("movie_id", req.query.link);

        axios.post("https://twitcasting.tv/eventpubsuburl.php", bodyFormData, 
        {        
            headers: {
                "Content-Type": "multipart/form-data; boundary=" + bodyFormData.getBoundary()
            }
        }
        ).then(function (response) {
            req.query.wss = response.data.url;
            DivergencePoint(req, res);
        }).catch(function (error) {
            return res.status(400).send("POST NOT OK");
        });
    } else {
        req.query.wss = ListenerPack[idx].WSlink;
        DivergencePoint(req, res);
    }
}

function DivergencePoint(req, res) {
    if (!req.query.TL){
        return res.status(200).send(req.query.wss);
      } else {
        if (req.query.channel){
          if (ReservedChannel.indexOf(req.query.channel) != -1){
            AddListener(req, res);
          } else {
            return res.status(200).send(req.query.wss);
          }      
        } else {
            return res.status(200).send(req.query.wss);
        }
    } 
}

function startws(req, res) {
    res.status(200).send("OK");
    const ws = new WebSocket("wss://17media-realtime.ably.io/?key=qvDtFQ.0xBeRA:iYWpd3nD2QHE6Sjm&format=json&heartbeats=true&v=1.1&lib=js-web-1.1.22");
    var data = {                           
		"action": 10,
		"channel": req.query.link
	};

    ws.onopen = function (event) {
        console.log("CONNECTED");
        ws.send(JSON.stringify(data));
    };
    
    /*
    ws.onclose = function (event) {
        console.log("CLOSED");
    };
    */
    ws.onmessage = function (event) {
        const dt= JSON.parse(event.data);
        console.log(dt.action);
        if (dt.messages){
            dt.messages.forEach(e => {
                if (e.data){
                    console.log(e.data);
                }
            });
        }
    };
}
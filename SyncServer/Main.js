const express = require("express");
const cors = require('cors');
const bodyParser = require("body-parser");
const crypto = require("crypto");
const Config = require("../Config/Config.json");

const PORT = process.env.PORT || 31000
const app = express()
app.use(bodyParser.json( { limit: '5mb'} ))
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }))
app.use(cors());

var corsOptions = {
  origin: Config.CORSOrigin,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

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

/*
    Connection Collection
    {
        UID: "ASDFG"
        Token: ""
        Client: [
          {
            UID:
            res:
          }
        ]
        Master: 
        {
          UID:
          res:
        }
    }
*/
var ConCol = [];

/*
    Sync Token
    {
      UID: ""
      Token: ""
      Link: ""
      Res: ""
      Timer:
    }
*/
var SyncToken = [];



//-------------------------------------- AUTO SYNC HANDLER --------------------------------------
app.post('/AutoSync/SignIn', async function (req, res) {
  const UID = Date.now();
  const Token = crypto.createHash('sha256').update(Date.now().toString() + "MINTO SUKI").digest('hex');
  if (!req.body.BToken) {
    return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
  }

  try {
    var content = JSON.parse(TGDecoding(req.body.BToken));
  } catch (error) {
    return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
  }

  SyncToken.push({
    UID: UID,
    Token: Token,
    Link: content.link,
    Res: undefined,
    Timer: Date.now()
  })

  return res.status(200).send({ Token: Token });
});

app.post('/AutoSync/Sync', async function (req, res) {
  if (!req.body.BToken) {
    return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
  }

  try {
    var content = JSON.parse(TGDecoding(req.body.BToken));
  } catch (error) {
    return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
  }

  if (content.Token) {
    var Test = SyncToken.filter(e => e.Token === content.Token);
    if (Test.length == 0){
      return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.")
    } else {
      Test[0].Res = res;
      req.on('close', () => {
        SyncToken.filter(e => e.Token === content.Token).map(e => { 
          e.Res = undefined;
          return e;
        })
      })
    }
  } else {
    return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.")
  }
});

app.post('/AutoSync/Master', cors(corsOptions), async function (req, res) {
  if (!req.body.BToken) {
    return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
  }

  try {
    var content = JSON.parse(TGDecoding(req.body.BToken));
  } catch (error) {
    return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
  }

  if ((content.Token) && (content.SyncToken)) {
    var Test = SyncToken.filter(e => e.Token === content.Token);
    if (Test.length == 0){
      return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.")
    } else {
      if (Test[0].Res){
        try {
          Test[0].Res.status(200).send({ SyncToken: content.SyncToken});          
        } catch (error) {
          console.log(error);
        }
      }
      return res.status(200).send({ Link: Test[0].Link });
    }
  } else {
    return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.")
  }
});

//====================================== AUTO SYNC HANDLER ======================================



//-------------------------------------- CLIENT HANDLER --------------------------------------
//curl "http://localhost:31000/Client?token=btoken%204b494%20TESTING"
//curl "http://repo.mchatx.org/APISync/Client?token=btoken%203aaff%20TESTING"
app.get('/Client', verifyUID, async function (req, res) {
  const UID = req.UID2;
  res.writeHead(200, HeaderPublic);
  res.flushHeaders();
  res.write("data: { \"flag\":\"Connect\", \"content\":\"CONNECTED TO SERVER\"}\n\n");

  ConCol.filter(e => e.UID === req.UID).map(e => {
    e.Client.push({
      UID: UID,
      res: res
    });

    if (e.Master){
      e.Master.res.write("data: " + JSON.stringify({ 
        "Act": 'MChad-RollCall',
        "UID": UID
      }) +"\n\n");
    }
    return e;
  })

  req.on('close', () => {
    ConCol.filter(e => e.UID === req.UID).map(e => {
      if (e.Master){
        e.Master.res.write("data: " + JSON.stringify({ 
          "Act": 'MChad-Disconnect',
          "UID": UID
        }) +"\n\n");
      }

      e.Client = e.Client.filter(c => c.UID !== UID);
      return e;
    });
  });
})

app.post('/Client', verifyUID, async function (req, res) {
  if (!req.body.broadcast){
    return res.status(400).send("BAD BAD REQUEST");
  }

  res.status(200).send("OK");
  ConCol.filter(e => e.UID === req.UID).filter(e => e.Client.filter(c => c.UID === req.UID2).length !== 0).forEach(e => {
    e.Master.res.write("data:" + JSON.stringify(req.body.broadcast) + "\n\n");
  });
})

//====================================== CLIENT HANDLER ======================================



//-------------------------------------- MASTER HANDLER --------------------------------------
app.get('/Master', verifyToken, async function (req,res) {
  const UID = "M_" + Date.now().toString();
  res.writeHead(200, HeaderPrivate);
  res.flushHeaders();
  res.write("data: { \"flag\":\"Connect\", \"content\":\"CONNECTED TO SERVER\"}\n\n");

  ConCol.filter(e => e.Token === req.token).map(e => {
    var TempMaster = e.Master;
    e.Master = {
      UID: UID,
      res: res
    };
    if (TempMaster){
      TempMaster.res.end();
    }
    return e;
  })

  req.on('close', () => {
    ConCol.filter(e => e.Master.UID === UID).forEach(e => {
      e.Client.forEach(c => {
        c.res.write("data: " + JSON.stringify({ 
          "Act": 'MChad-Disconnect',
          "UID": c.res.UID
        }) +"\n\n");

        c.res.end();
      })
    })
    ConCol = ConCol.filter(e => e.Master.UID !== UID);
  });
})

app.post('/Master', verifyToken, async function (req, res) {
  switch (req.body.flag) {
    case "UNSYNC":
      ConCol.filter(e => e.Token === req.token).forEach(e => {
        if (e.Master){
          e.Master.res.end();
        }
      
        e.Client.forEach(c => {
          c.res.end();
        })
      })

      for (var i = 0; i < ConCol.length; i++) {
        if (ConCol[i].Token == req.token){
          ConCol.splice(i, 1);
          break;
        }
      }
      res.status(200).send("OK");
      break;

    case "ROLLCALL":
      const IDLIST = ConCol.filter(e => e.Token === req.token).map(e => {return e.Client.map(e.UID)});
      if (IDLIST.length == 0){
        res.status(200).send([]);
      } else {
        res.status(200).send(IDLIST[0]);
      }
      
      break;

    default:
      if (!req.body.broadcast){
        return res.status(400).send("BAD BAD REQUEST");
      }
      res.status(200).send("OK");

      switch (req.body.broadcast.Act) {
        case "MChad-LiveSend":
          ConCol.filter(e => e.Token === req.token).forEach(e => {
            e.Client.forEach(c => {
              c.res.write("data:" + JSON.stringify({
                Act: req.body.broadcast.Act,
                UID: c.UID,
                Text: req.body.broadcast.Text
              }) + "\n\n");
            });
          });          
          break;
        
        default:
          ConCol.filter(e => e.Token === req.token).forEach(e => {
            e.Client.forEach(c => {
              c.res.write("data:" + JSON.stringify(req.body.broadcast) + "\n\n");
            });
          });          
          break;
      }

      break;
  }
})

app.post('/SignIn', cors(corsOptions), async function (req, res) {
  if (!req.body.data) {{
    return res.status(400).send("NOT OK");
  }}

  req.body.data = TGDecoding(req.body.data);
  try {
    req.body.data = JSON.parse(req.body.data);
  } catch (error) {
    return res.status(400).send("NOT OK");
  }

  if (!req.body.data.time){
    return res.status(400).send("NOT OK");
  }

  if (req.body.data.time > Date.now() + 1000*60*10){
    return res.status(400).send("NOT OK");
  }

  var UID;
  for (UID = crypto.createHash('sha256').update(Date.now().toString()).digest('hex').substr(0,5); ConCol.filter(e => e.UID === UID).length != 0;){
    UID = crypto.createHash('sha256').update(Date.now().toString()).digest('hex').substr(0,5);
  }
  const token = crypto.createHash('sha256').update(Date.now().toString() + "Y4g00").digest('hex');

  ConCol.push({
    UID: UID,
    Token: token,
    Client: [],
    Master: undefined,
    Ping: 0
  })

  return res.status(200).send(TGEncoding(JSON.stringify({
      token: token,
      UID: UID
    }))
  );
})
//====================================== MASTER HANDLER ======================================



//------------------------ TSUGE GUSHI ENCODING------------------------
function TGEncoding(input){
  var output = "";
  var key = "";
  var teethsize = 0;
  var head = 0;

  while (head == 0){
      head = Date.now() % 100;
  }
  
  input = input.replace(/([^\x00-\x7F]|\%)+/g, SelectiveURIReplacer);
  output = Buffer.from(input, 'binary').toString('base64');

  key = head.toString();
  
  teethsize = Math.floor(output.length*3.0/4.0);
  for (var i  = 0; i <= head; i++){
      output = output.slice(teethsize) + output.slice(0, teethsize);
  }
  
  for (var i = 0; i <= head; i++){
      if ((/[a-zA-Z]/).test(output[i])){
          key += output[i];
          break;
      }
  }

  for (; key.length < output.length;){
      var TeethLoc = Math.floor(Math.random()*output.length);
      var Halfend = output.slice(TeethLoc);
      output = output.slice(0, TeethLoc);
      key += TeethLoc.toString();
        
      if (Date.now() % 2 == 0){
        key += "~";
      } else {
        key += "|";
      }

      key += Halfend[0];

        
      Halfend = Halfend.slice(1);
  
      for (var i = 0;((Date.now() % 2 == 0) && (i < 5));i++){
          if (Halfend.length != 0){
              key += Halfend.slice(0,1);
              Halfend = Halfend.slice(1);
          }
          if (key.length > output.length + Halfend.length){
            break;
          }
      }
  
      output += Halfend;
      if (Date.now() % 2 == 0){
          key += "_";
      } else {
          key += "\\";
      }
  
      if (key.length >= output.length){
          break;
      }
  }

  for (var i = 0; ((i < 3) || (Date.now() % 2 != 0)) && (i < key.length/3.0); i++){
      var incision = Math.floor(Math.random()*output.length);
      if (Date.now() % 2 == 0){
          output = output.slice(0, incision) + "~" + output.slice(incision);
      } else {
          output = output.slice(0, incision) + "_" + output.slice(incision);
      }
  }

  output = output + " " + key;
  
  head = Math.floor((Date.now() % 100) * 16.0 / 100.0);
  teethsize = Math.floor(output.length*3.0/4.0);
  for (var i = 0; i <= head; i++){
      output = output.slice(teethsize) + output.slice(0, teethsize);
  }

  key = head.toString(16);
  output = key + output;

  return (output);
}
  
function TGDecoding(input) {
  var teeth = Number.parseInt(input.slice(0, 1), 16);
  input = input.slice(1);

  var teethsize = input.length - Math.floor(input.length*3.0/4.0);
  for (var i = 0; i <= teeth; i++){
      input = input.slice(teethsize) + input.slice(0, teethsize);
  }

  var output = input.split(" ")[0];
  output = output.replace(/~|_/g, "");
  var key = input.split(" ")[1];

  var cutloc = 0;
  for (cutloc = 0; cutloc < key.length; cutloc++){
      if ((/[a-zA-Z]/).test(key[cutloc])){
          break;
      }
  }
  
  teeth = Number.parseInt(key.slice(0,cutloc));
  
  key = "\\" + key.slice(cutloc + 1);

  var cutstring = "";
  var cutstring2 = "";
  
  for (var taking = false; key.length > 0;){
      if((key.slice(-1) == "_") || (key.slice(-1) == "\\")) {
          if (cutstring == ""){
            cutloc = 0
          } else {
            cutloc = Number.parseInt(cutstring);
          }
          output = output.slice(0, cutloc) + cutstring2 + output.slice(cutloc);
          cutstring = "";
          cutstring2 = "";
          taking = false;
      } else if ((key.slice(-1) == "~") || (key.slice(-1) == "|")) {
          taking = true;
      } else if (taking){
          cutstring = key.slice(-1) + cutstring;
      } else {
          cutstring2 = key.slice(-1) + cutstring2;
      }
      key = key.slice(0, key.length - 1);
  }

  teethsize = output.length - Math.floor(output.length*3.0/4.0);
  for (var i = 0; i <= teeth; i++){
      output = output.slice(teethsize) + output.slice(0, teethsize);
  }
  
  output = Buffer.from(output, 'base64').toString('binary');
  output = decodeURI(output);
  return (output);
}

function SelectiveURIReplacer(match){
  return(encodeURI(match));
}
//======================== TSUGE GUSHI ENCODING ========================



function verifyToken(req, res, next) {
  var bearerHeader = req.headers['authorization'];
  if (req.query.token){
    bearerHeader = req.query.token;
  }

  if (bearerHeader) {
    const bearer = bearerHeader.split(' ');
    if (bearer.length < 2) {
      return res.sendStatus(403);  
    }
    req.token = bearer[1];

    if (ConCol.filter(e => e.Token === req.token).length == 0){
      return res.sendStatus(403);  
    }

    next();
  } else {
    return res.sendStatus(403);  
  }
}

function verifyUID(req, res, next) {
  var bearerHeader = req.headers['authorization'];
  if (req.query.token){
    bearerHeader = req.query.token;
  }

  if (bearerHeader) {
    const bearer = bearerHeader.split(' ');
    if (bearer.length < 3) {
      return res.sendStatus(403);  
    }
    req.UID = bearer[1];
    
    req.UID2 = "";
    for (var i = 2; i < bearer.length; i++){
      req.UID2 += bearer[i] + " ";
    }
    req.UID2 = req.UID2.trim();

    if (ConCol.filter(e => e.UID === req.UID).length == 0){
      return res.sendStatus(403);  
    }

    next();
  } else {
    return res.sendStatus(403);  
  }
}

function Pinger() {
  for(var i = 0; i < ConCol.length; i++){
    if (ConCol[i].Ping > 31){
      ConCol[i].Client.forEach(c => {
        c.res.end();
      });
      if (ConCol[i].Master) {
        ConCol[i].Master.res.end();
      }
      ConCol.splice(i, 1);
      i--;
      continue;
    }

    if (ConCol[i].Master) {
      ConCol[i].Master.res.write("data:{}\n\n");
      ConCol[i].Ping = 0;
    } else {
      ConCol[i].Ping += 1;
    }

    ConCol[i].Client.forEach(c => {
      c.res.write("data:{}\n\n");
    });
  }
}

function CleanupAutoSync() {
  var TimeLimit = Date.now() - 1000*60*10;
  SyncToken.filter(e => e.Timer < TimeLimit).forEach(e => {
    if (e.Res) {
      e.Res.status(400).send("Timeout");
    }
  })
  SyncToken = SyncToken.filter(e => e.Timer > TimeLimit);
}

app.listen(PORT, async function () {
  setInterval(Pinger, 1000*10);
  setInterval(CleanupAutoSync, 1000*60*5);
  console.log(`Server initialized on port ${PORT}`);
})
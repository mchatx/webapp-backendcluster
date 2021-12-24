const express = require("express")
const bodyParser = require("body-parser")
const cors = require('cors')
const { MongoClient, ObjectId } = require("mongodb")
const jwtgen = require("jsonwebtoken");
const crypto = require("crypto");
const compression = require('compression');
const axios = require('axios');
const Config = require("../Config/Config.json");

const ConnStringManager = Config.MongoWriter;
const clientmanager = new MongoClient(ConnStringManager, { useUnifiedTopology: true, maxPoolSize: 200 });

var Firebase = require("firebase-admin");
var serviceAccount = require(Config.FirebaseCred);

const { urlencoded } = require("body-parser");

Firebase.initializeApp({
  credential: Firebase.credential.cert(serviceAccount),
  databaseURL: Config.FirebaseDBURL
});
const db = Firebase.database();

const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    "Access-Control-Allow-Origin": "*",
    'X-Accel-Buffering': 'no'
  };

const headersLocked = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    "Access-Control-Allow-Origin": Config.CORSOrigin,
    'X-Accel-Buffering': 'no'
  };


 var corsOptions = {
    origin: Config.CORSOrigin,
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }
  

const PORT = process.env.PORT || 2434;
const app = express()
app.use(bodyParser.json( { limit: '30mb'} ))
app.use(bodyParser.urlencoded({ extended: true, limit: '30mb' }))
app.use(cors(corsOptions));

//---------------------------------------- AUTH ---------------------------------------
function minttoken(room){
    return (jwtgen.sign({
            id: room,
            timestamp: Date.now()
        },
        Config.JWTKey
    ));
}

function checktoken(token){
    try {
        var decoded = jwtgen.verify(token, Config.JWTKey);
        return (decoded);
      } catch(err) {
        return (undefined);
      }
}

function VerifyToken(req, res, next) {
    if (!req.headers.authorization){
        return res.status(400).send("NO");
    }
    if (req.headers.authorization.split(" ")[0] != "Bearer"){
        return res.status(400).send("NO2");
    }

    var token = checktoken(req.headers.authorization.split(" ")[1]);
    if (!token){
        return res.status(400).send("CO2");
    }
    if (token.timestamp < Date.now() - 2*24*60*60*1000){ // TOKEN 1 day
        return res.status(400).send("H2SO4");
    }
    req.room = token.id;

    if (token.timestamp < Date.now() - 1*24*60*60*1000){
        token = minttoken(token.room);
    } else {
        token = "";
    }
    req.token = token;
    next();
}
//======================================== AUTH ========================================



//---------------------------------- HEAD NEXUS ----------------------------------
app.options('/Login', cors());
app.post('/Login/', cors(corsOptions), async function (req, res) {
    if (!req.body.BToken) {
        return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
    }
    
    try {
        var content = JSON.parse(TGDecoding(req.body.BToken));
    } catch (error) {
        return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
    }

    if (!content.room){
        return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
    }

    if (content.pass){
        var QueryRes = await clientmanager.db('WBData').collection('AccountList').findOne({ $and: [{ Nick: { $eq: content.room } }, { Pass: { $eq: crypto.createHash('sha256').update(content.pass).digest('hex') } }, { Role: { $eq: "TL" } }] }, {projection:{ _id: 1}});

        if (QueryRes == null){
            return res.status(400).send("ERROR : WRONG PASSWORD OR ROOM");
        } else {
            return res.status(200).send({ BToken: TGEncoding(minttoken(content.room))});
        } 
    } else if (content.verivied){
        return res.status(200).send({ BToken: TGEncoding(minttoken(content.room))});
    } else {
        return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
    }
})

app.options('/FetchRaw', cors());
app.post('/FetchRaw', cors(corsOptions), VerifyToken, compression(), async function (req,res) {
    if (!req.body.BToken) {
        return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
    }
    
    try {
        var content = JSON.parse(TGDecoding(req.body.BToken));
    } catch (error) {
        return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
    }

    if (!req.room){
        return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
    }

    switch(content.act){
        case "Get First":
            GetFirst(req, res);
            break;

        case "Get MetaData":
            GetMetaData(req, res);
            break;

        case "New Entry":
            req.body.data = content.data;
            req.body.ExtShare = content.ExtShare;
            SendEntry(req, res);
            break;

        case "Update Entry":
            req.body.data = content.data;
            req.body.ExtShare = content.ExtShare;
            req.body.OT = content.OT;
            UpdateEntry(req, res);
            break;

        case "Clear Room":
            ClearRoom(req, res);
            break;

        case "Update Metadata":
            req.body.data = content.data;
            switch (content.mode) {
                case 0:
                    ChangeHostPass(req, res);
                    break;
                
                case 1:
                    ChangeLTN(req, res);
                    break;

                case 2:
                    ChangePassProt(req, res);
                    break;

                case 3:
                    ChangeThirdParty(req, res);
                    break;

                default:
                    return res.status(400).send("UNRECOGNIZED MODE");
                    break;
            }
            break;

        case "Broadcast":
            req.body.data = content.data;
            BroadcastStart(req, res);
            break;
        
        case "SAVE ARCHIVE":
            req.body.data = content.data;
            SaveArchive(req, res);
            break;

        case "Export Room":
            FetchCurrentRoomExport(req, res);
            break;

        default:
            return res.status(400).send("UNRECOGNIZED DATA.");
    }
});

app.options('/HolodexBounce', cors());
app.post('/HolodexBounce', cors(corsOptions), async function (req,res) {
    if (!req.body.BToken) {
        return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
    }
    
    try {
        var content = JSON.parse(TGDecoding(req.body.BToken));
    } catch (error) {
        return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
    }
    
    if ((!content.nick) || (!content.Stext) || (!content.Stime) || (!content.Lang) || (!content.VidID)) {
        return res.status(400).send("NOPE");
    }    

    content.VidID.forEach(e => {
        axios.post("https://holodex.net/api/v2/videos/" + e + "/chats?lang=" + content.Lang, {
            name: content.nick,
            timestamp: content.Stime,
            message: content.Stext,
            source: "MChad"
          }, {
            headers: {
                'X-APIKEY' : Config.HolodexAPIKey
            }
          })
          .then((response) => {
            return res.status(200).send("OK");
          })
          .catch((error) => {
            return res.status(200).send("NOT OK");
        })
    });
});
//================================== HEAD NEXUS ==================================



//---------------------------------- MAIN NEXUS ----------------------------------
async function GetMetaData(req, res) {
    var Roomdt = {};
    var QueryRes = await clientmanager.db('RoomList').collection("List").find({ Nick: req.room}).toArray();
    if (QueryRes.length == 0){
        return res.status(400).send("NOT OK1");
    }
   
    QueryRes = QueryRes[0];
    if (QueryRes["EntryPass"]){
        Roomdt["EntryPass"] = QueryRes["EntryPass"];
    } else {
        Roomdt["EntryPass"] = false;
    }

    if (QueryRes["Empty"]){
        Roomdt["Empty"] = QueryRes["Empty"];
    } else {
        Roomdt["Empty"] = false;
    }

    if (QueryRes["AuxLink"]) {
        Roomdt["AuxLink"] = QueryRes["AuxLink"];
    } else {
        Roomdt["AuxLink"] = [];
    }

    Roomdt["Hidden"] = false;

    if (QueryRes["ExtShare"]){
        Roomdt["ExtSharing"] = QueryRes["ExtShare"];
    } else {
        Roomdt["ExtSharing"] = false;
    }

    if (QueryRes["StreamLink"]){
        Roomdt["StreamLink"] = QueryRes["StreamLink"];
    } else {
        Roomdt["StreamLink"] = "";
    }

    if (QueryRes["Tags"]){
        Roomdt["Tags"] = QueryRes["Tags"];
    } else {
        Roomdt["Tags"] = "";
    }

    QueryRes = await db.ref('Session/Chat_' + req.room + '/ExtraInfo').once('value');
    QueryRes = QueryRes.val();
    if (QueryRes){
        Roomdt["Note"] = QueryRes;
    } else {
        Roomdt["Note"] = ""
    }
    
    QueryRes = await db.ref('RoomList/' + req.room + '/EntryPass').once('value');
    QueryRes = QueryRes.val();
    if (QueryRes){
        Roomdt["PassList"] = QueryRes;
    } else {
        Roomdt["PassList"] = "";
    }

    QueryRes = await db.ref('Room/' + req.room + '/OpenPass').once('value');
    QueryRes = QueryRes.val();
    if (QueryRes){
        Roomdt["SessPass"] = QueryRes;
    } else {
        Roomdt["SessPass"] = "";
    }

    return res.status(200).send({
        BToken: TGEncoding(JSON.stringify(Roomdt))
    });
}

async function GetFirst(req, res) {
    const ref = db.ref('Session/Chat_' + req.room);
    var BeegData = await ref.limitToLast(50).once('value');
    BeegData = BeegData.val();

    var DataArr = [];
    for (const dt in BeegData){
        if (dt != "ExtraInfo"){
            DataArr.push({
                ...BeegData[dt],
                key: dt
            });
        }
    }

    res.status(200).send({
        BToken: TGEncoding(JSON.stringify(DataArr))
    });
}

async function SendEntry(req, res) {
    if (!req.body.data){
        return res.status(400).send("BAD DATA");
    }

    var dt = {
        Stext: req.body.data.Stext,
    };
    if (req.body.data.CC){
        dt.CC = req.body.data.CC
    }
    if (req.body.data.OC){
        dt.OC = req.body.data.OC
    }

    const ref = db.ref('Session/Chat_' + req.room).push();
    await ref.set({
        ...dt,
        Stime: req.body.data.Stime
    });
      
    if (req.body.data.Empty == true){
        await db.ref('RoomList/' + req.room + '/Empty').set(false);
        await clientmanager.db('RoomList').collection("List").updateOne({ Nick: req.room }, {$set: { Empty: true }});
    }

    if (req.body.ExtShare == true){
        var queryRes = await clientmanager.db('ActiveSession').collection(req.room).insertOne({
            ...dt,
            Stime: req.body.data.Stime2
        })
    
        //console.log(queryRes.insertedId.toString());
    }

    res.status(200).send({
        BToken: TGEncoding(JSON.stringify({
            key: ref.key
        }))
    });
}

async function ClearRoom(req, res) {
    await db.ref('Room/' + req.room + '/OpenPass').remove();
    await db.ref('RoomList/' + req.room + '/Empty').set(true);
    await db.ref('Session/Chat_' + req.room).set({
        ExtraInfo: ""
    });
    await db.ref('SessionMessage/' + req.room).set({
        PlaceHolder: ""
    });
    await clientmanager.db('RoomList').collection('List').updateOne({ Nick: req.room }, {$set: {Empty: true}});
    await clientmanager.db('ActiveSession').collection(req.room).deleteMany({});

    return res.status(200).send("OK");
}

async function UpdateEntry(req, res) {
    if (!req.body.data){
        return res.status(400).send("BAD DATA");
    }

    if (!req.body.data.key || !req.body.data.Stext) {
        return res.status(400).send("BAD DATA");
    }
    
    var UpdateJson = { $set: { Stext: req.body.data.Stext}, $unset: {}};
    var dt = {
        Stext: req.body.data.Stext,
    };
    if (req.body.data.CC){
        dt.CC = req.body.data.CC
        UpdateJson["$set"].CC = req.body.data.CC;
    } else {
        dt.CC = null;
        UpdateJson["$unset"].CC = "";
    }

    if (req.body.data.OC){
        dt.OC = req.body.data.OC
        UpdateJson["$set"].OC = req.body.data.OC;
    } else {
        dt.OC = null;
        UpdateJson["$unset"].OC = "";
    }

    await db.ref("Session/Chat_" + req.room + "/" + req.body.data.key).update(dt);

    if (req.body.ExtShare == true){
        clientmanager.db('ActiveSession').collection(req.room).updateMany({ Stext: req.body.OT }, UpdateJson);
    }

    res.status(200).send("OK");
}

async function ChangeHostPass(req, res) {
    if(req.body.data == undefined){
        return res.status(400).send("UH OH, NOT OK");
    }
    
    await db.ref("Room/" + req.room + "/OpenPass").set(req.body.data);
    return res.status(200).send("OK");
}

async function ChangeLTN(req, res) {
    if((req.body.data.Link == undefined) || (req.body.data.Tags == undefined) || (req.body.data.Note == undefined)){
        return res.status(400).send("UH OH, NOT OK");
    }
    
    if (!req.body.data.AuxLink) {
        req.body.data.AuxLink = [];
    }

    await db.ref("Session/Chat_" + req.room + "/ExtraInfo").set(req.body.data.Note);
    await clientmanager.db("RoomList").collection("List").updateOne({ Nick: req.room }, {$set: { AuxLink: req.body.data.AuxLink, StreamLink: req.body.data.Link, Tags: req.body.data.Tags, Note: req.body.data.Note }});

    return res.status(200).send("OK");
}

async function ChangePassProt(req, res) {
    if(req.body.data.PString == undefined){
        return res.status(400).send("UH OH, NOT OK");
    }
    
    if (req.body.data.PString == ""){
        await db.ref("RoomList/" + req.room + "/EntryPass").set("");
        await clientmanager.db("RoomList").collection("List").updateOne({ Nick: req.room }, {$set: { EntryPass: false }});
        await clientmanager.db("RoomList").collection("Pass").updateOne({ Nick: req.room }, {$set: { EntryPass: "" }});
    
        return res.status(200).send("OK");
    } else {
        await db.ref("RoomList/" + req.room + "/EntryPass").set(req.body.data.PString);
        await clientmanager.db("RoomList").collection("List").updateOne({ Nick: req.room }, {$set: { EntryPass: true }});
        await clientmanager.db("RoomList").collection("Pass").updateOne({ Nick: req.room }, {$set: { EntryPass: crypto.createHash('sha256').update(req.body.data.PString).digest('hex')}});
    
        return res.status(200).send("OK");
    }
}

async function ChangeThirdParty(req, res) {
    await clientmanager.db("RoomList").collection("List").updateOne({ Nick: req.room}, {$set: {ExtShare: req.body.data}});

    return res.status(200).send("OK");
}

async function BroadcastStart(req, res) {
    var dt = {
        Room: req.room
    }

    if (req.body.StreamLink != undefined){
        dt.Link = req.body.StreamLink;
    }

    if (req.body.Tags != undefined){
        dt.Tag = req.body.Tags;
    }

    if (req.body.AuxLink != undefined) {
        dt.AuxLink = req.body.AuxLink;
    }
    
    await clientmanager.db("DiscordBot").collection("Broadcast").insertOne(dt);

    return res.status(200).send("OK");
}

async function SaveArchive(req, res) {
    const DateStamp = new Date();
    var Archivedt = {
        Link: req.room + "_" + DateStamp.getUTCFullYear().toString() + "-"
    }
    if (DateStamp.getUTCMonth() < 10){
        Archivedt.Link += "0" + DateStamp.getUTCMonth().toString() + "-";
    } else {
        Archivedt.Link += DateStamp.getUTCMonth().toString() + "-";
    }
    if (DateStamp.getUTCDate() < 10){
        Archivedt.Link += "0" + DateStamp.getUTCDate().toString() + "_";
    } else {
        Archivedt.Link += DateStamp.getUTCDate().toString() + "_";
    }
    if (DateStamp.getUTCHours() < 10){
        Archivedt.Link += "0" + DateStamp.getUTCHours().toString() + "-";
    } else {
        Archivedt.Link += DateStamp.getUTCHours().toString() + "-";
    }
    if (DateStamp.getUTCMinutes() < 10){
        Archivedt.Link += "0" + DateStamp.getUTCMinutes().toString() + "-";
    } else {
        Archivedt.Link += DateStamp.getUTCMinutes().toString() + "-";
    }
    if (DateStamp.getUTCSeconds() < 10){
        Archivedt.Link += "0" + DateStamp.getUTCSeconds().toString();
    } else {
        Archivedt.Link += DateStamp.getUTCSeconds().toString();
    }

    if (req.body.data.Title == ""){
        req.body.data.Title = Archivedt.Link;
    }

    if (req.body.data.EntryPass == ""){
        req.body.data.PP = false;
    } else {
        req.body.data.PP = true;
    }

    if (!req.body.data.AuxLink) {
        req.body.data.AuxLink = [];
    }

    var Entries = await db.ref('Session/Chat_' + req.room).once('value');
    Entries = Entries.val();

    await db.ref('Archived/' + req.room + '/Chat_' + Archivedt.Link).set(Entries);
    delete Entries["ExtraInfo"];
    delete Entries["LOCAL"];
    
    const KeyList = Object.keys(Entries);
    var msprev = 0;
    var msnow = 0;
    var totaltime = 0;

    Archivedt.Entries = [];
    for (let i = 0; i < KeyList.length; i++){
        var dt = {
            Stext: Entries[KeyList[i]].Stext
        }

        if (Entries[KeyList[i]].CC){
            dt.CC = Entries[KeyList[i]].CC;
        }

        if (Entries[KeyList[i]].OC){
            dt.OC = Entries[KeyList[i]].OC;
        }

        if (!Entries[KeyList[i]].Stime) {
            console.log("Error entry \n" + JSON.stringify([KeyList[i]]));
            continue;
        }

        var TimeStringSplit = Entries[KeyList[i]].Stime.split(":");
        var TimeConv = parseInt(TimeStringSplit[0], 10)*3600*1000 + parseInt(TimeStringSplit[1], 10)*60*1000 + parseInt(TimeStringSplit[2], 10)*1000 + parseInt(TimeStringSplit[3], 10);
        if (msprev == 0){
            msprev = TimeConv;
        }
        msnow = TimeConv;

        if (msnow - msprev < 0){
            totaltime += msnow - msprev + 24*3600*1000;
        } else {
            totaltime += msnow - msprev;
        }
        msprev = msnow;
        
        dt.Stime = totaltime;
        delete Entries[KeyList[i]];
        Archivedt.Entries.push(dt);

        if (i == KeyList.length - 1){
            await clientmanager.db("Archive").collection(req.room).insertOne(Archivedt);
            
            var dt2 = {
                Link: Archivedt.Link,
                Hidden: req.body.data.Hidden,
                Downloadable: req.body.data.Downloadable,
                Nick: req.body.data.Title
            };
            if (req.body.data.PP == true){
                dt2.PP = true;
            }
            await db.ref("Archived/" + req.room + "/List").push().set(dt2);
            await clientmanager.db("Archive").collection("List").insertOne({
                Room: req.room,
                Link: Archivedt.Link,
                Nick: req.body.data.Title,
                Hidden: req.body.data.Hidden,
                Pass: req.body.data.PP,
                StreamLink: req.body.data.StreamLink,
                Tags: req.body.data.Tags,
                ExtShare: req.body.data.ExtShare,
                Downloadable: req.body.data.Downloadable,
                AuxLink: req.body.data.AuxLink
            })

            if (req.body.data.PP == true){
                await db.ref("Archived/" + req.room + "/EntryPass/" + Archivedt.Link).set(req.body.data.EntryPass);
                await clientmanager.db("Archive").collection("Pass").insertOne({
                    Link: Archivedt.Link,
                    EntryPass: req.body.data.EntryPass
                });
            }

            await db.ref('Room/' + req.room + '/OpenPass').remove();
            await db.ref('RoomList/' + req.room + '/Empty').set(true);
            await db.ref('Session/Chat_' + req.room).set({
                ExtraInfo: ""
            });
            await db.ref('SessionMessage/' + req.room).set({
                PlaceHolder: ""
            });
            await clientmanager.db('RoomList').collection('List').updateOne({ Nick: req.room }, {$set: {Empty: true, StreamLink: "", AuxLink: [], Tags: "", Note: ""}});
            await clientmanager.db('ActiveSession').collection(req.room).deleteMany({});
        
            return res.status(200).send(Archivedt.Link);
        }
    }
}

function BreakDownTime(s) {
    const list = s.split("':");
    return (parseInt(list[0])*3600*1000 + parseInt(list[1])*60*1000 + parseInt(list[2])*1000 + parseInt(list[3]));
}

async function FetchCurrentRoomExport(req, res) {
    const ref = db.ref('Session/Chat_' + req.room);
    var BeegData = await ref.once('value');
    BeegData = BeegData.val();
    delete BeegData["ExtraInfo"];

    var DataArr = [];
    for (const dt in BeegData){
        DataArr.push({
            ...BeegData[dt],
        });
        delete BeegData[dt];
    }

    res.status(200).send({
        BToken: TGEncoding(JSON.stringify(DataArr))
    });
}
//================================== MAIN NEXUS ==================================



//------------------------------- SYNCING SERVICE -------------------------------
var SyncPackage = [];

async function Pinger(){
    for (let i = 0; i < SyncPackage.length; i++){
        try {
            SyncPackage[i].res.write("data: {}\n\n");
        } catch (error) {
            SyncPackage[i].nodes.forEach(e => {
                e.res.write("data: {\"Act\":\"MChad-Unsync\", \"UID\":\"" + SyncPackage[i].UID + "\"}\n\n");
                e.res.end();
            });
            SyncPackage.splice(i, 1);
            i--;
            continue;
        }

        SyncPackage[i].nodes.forEach(e => {
            e.res.write("data: {}\n\n");
        });
    }
}

async function MintSyncToken(req, res) {
    var tkn = "";
    while (tkn == ""){
        tkn = crypto.createHash('sha256').update(Date.now().toString()).digest('hex').slice(-8);
        if (SyncPackage.filter(e => e.UID == tkn) != -1){
            tkn == "";
        } else {
            break;
        }
    }     

    res.writeHead(200, headersLocked);
    res.flushHeaders();
    res.write("data: " + JSON.stringify({ Token : tkn }) + "\n\n");

    SyncPackage.push({
        UID: tkn,
        res: res,
        role: req.query.role,
        nodes: []
    });

    req.on('close', () => {
        SyncPackage.filter(e => e.UID == tkn).forEach(e => {
            e.nodes.forEach(d => {
                d.res.write("data: {\"Act\":\"MChad-Unsync\", \"UID\":\"" + e.UID + "\"}\n\n");
                d.res.end();
            });
        });
        SyncPackage = SyncPackage.filter(e => e.UID != tkn);
    });
};

function SeekSyncPackage(UID) {
    if (SyncPackage.length == 0){
        return(-1);
    }

    for(let i = 0; i < SyncPackage.length; i++){
        if (SyncPackage[i].UID == UID){
            return(i);
        }

        if (i == SyncPackage.length - 1){
            return(-1);
        }
    }
}

app.options('/syncmaster', cors());
app.get("/syncmaster", cors(corsOptions), (req, res) => {
    if (!req.query.token || !req.query.role){
        return res.status(400).send("NO");
    }

    var token = checktoken(decodeURI(req.query.token));
    if (!token){
        return res.status(400).send("CO2");
    }
    if (token.timestamp < Date.now() - 2*24*60*60*1000){ // TOKEN 1 day
        return res.status(400).send("H2SO4");
    }
    req.room = token.id;

    if (!req.room){
        return res.status(400).send("BAD REQUEST, BAD BAD REQUEST.");
    }

    MintSyncToken(req, res);
});


app.get('/sync/:token', (req, res) => {
    if (!req.params.token){
        return res.status(400).send("TOKEN NOT FOUND");
    }

    const newID = Date.now();
    const idx = SeekSyncPackage(req.params.token);

    if (idx == -1){
        return res.status(400).send("TOKEN NOT FOUND");
    }

    SyncPackage[idx].nodes.push({
        UID: newID,
        res: res
    });

    res.writeHead(200, headers);
    res.flushHeaders();
    res.write("data: { \"flag\":\"Connect\", \"content\":\"CONNECTED TO SERVER\"}\n\n");

    switch (SyncPackage[idx].role) {
        case "LTL":
            
            res.write("data: {\"Act\":\"MChad-SetMode\",\"UID\":\"" + req.params.token + "\",\"Mode\":\"LiveChat\"}\n\n");
            break;
    
        default:
            res.end();
            return;
            break;
    }

    req.on('close', () => {
        const idx = SeekSyncPackage(req.params.token);
        if (idx != -1){
            SyncPackage[idx].nodes = SyncPackage[idx].nodes.filter(e => e.UID !== newID);
        }
    });
});

app.options('/sync', cors());
app.post('/sync', cors(corsOptions), (req, res) => {
    if (!req.body.UID || !req.body.data){
        return res.status(400).send("NOT OK");
    }

    if (!req.body.data.Act){
        return res.status(400).send("NOT OK");
    }

    res.status(200).send("OK");

    SyncPackage.filter(e => e.UID == req.body.UID).forEach(e => {
        e.nodes.forEach(d => {
            d.res.write("data: " + JSON.stringify(req.body.data) + "\n\n");
        }) 
    });
});
//=============================== SYNCING SERVICE ===============================



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



async function InitServer() {
    await clientmanager.connect();
    setInterval(Pinger, 1000*10);
    app.listen(PORT, async function () {
        console.log(`Server initialized on port ${PORT}`);
    })
}

InitServer();

function StringifyTime(TimeStamp){
    var Timestring = "";
    var Stime = 0;
    var SString = "";
    
    Stime = Math.floor(TimeStamp/3600000);
    SString = Stime.toString();
    if (SString.length < 2){
      SString = "0"+SString;
    }
    Timestring += SString + ":";
    TimeStamp -= Stime*3600000;

    Stime = Math.floor(TimeStamp/60000);
    SString = Stime.toString();
    if (SString.length < 2){
      SString = "0"+SString;
    }
    Timestring += SString + ":";
    TimeStamp -= Stime*60000;

    Stime = Math.floor(TimeStamp/1000);
    SString = Stime.toString();
    if (SString.length < 2){
      SString = "0"+SString;
    }
    Timestring += SString;
    TimeStamp -= Stime*1000;

    Timestring += ":" + TimeStamp.toString();

    return(Timestring);
  } 

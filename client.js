const { performance } = require('perf_hooks');
const mqtt = require('mqtt')
const options = { port: 1883, qos: 2 }
const client = mqtt.connect('mqtt://127.0.0.1', options)
var fs = require('fs');

let status = {}; //紀錄transaction的狀況:created/prepared

const args = process.argv.slice(2);

let clientNum = args[0]; //args[0] <- client編號
let accessSameRowNum = args[1]; //args[1] <- 有多少client access同一個row
let serviceNum = args[2]; //args[2] <- service數量
let buyItem = parseInt(clientNum); //buyItem:在資料庫access的item編號（access的row）
if (parseInt(clientNum) < parseInt(accessSameRowNum) ) {
    buyItem = 0; //編號在accessSameRowNum之前的都去access第0個row
}

let logFilePath = './log/client' + clientNum + '.txt'; //log檔路徑
let timeFilePath = './log/time.txt'; //time.txt路徑（記錄時間）

let services = {
    topics: [],
    responseTopics: []
};

// services data (topic and response topic)
for (var i = 0; i < serviceNum; i++) {
    services.topics.push("Topic" + i); //設定為service的topic
    services.responseTopics.push("ResponseTopic" + i + clientNum); //each client should have its own responseTopic
} 

function _uuid() {
    var d = Date.now();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        d += performance.now(); //use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

function writeIntoLog(fs, string) {
    fs.appendFile(logFilePath, string + "\n", function (err) {
        if (err) console.log(err);
    });
}

function writeIntoTime(fs, string){
    fs.appendFile(timeFilePath, string + "\n", function (err) {
        if (err) console.log(err);
    });
}

const uuid = _uuid();

function createMessage(type, reTopic, tId = "none") {
    let message = {};
    if (type === "query") {
        message = {
            mesgtype: type,
            clientId: uuid,
            payload: [10, buyItem],
            retopic: reTopic,
            tId: tId
        }
    }
    else if (type === "commit") {
        message = {
            mesgtype: type,
            clientId: uuid,
            retopic: reTopic
        }
    }
    let buf = Buffer.from(JSON.stringify(message));
    return buf;
}

writeIntoLog(fs, uuid);


//connect to mqtt -> query 1st service in services
client.on('connect', function () {
    client.subscribe(
        services.responseTopics[0],
        options,
        function (err, granted) { }
    )
    let tid = uuid + Math.random(); // transaction id

    writeIntoTime( fs, performance.timeOrigin + performance.now() );

    client.publish(
        services.topics[0],
        createMessage("query", services.responseTopics[0], tid),
        { qos: 2, retain: true },
        function (err) {
            status[tid] = "created";
            writeIntoLog(fs, JSON.stringify(status));
            if (err) {
                console.log(err);
            }
        }
    )
})

client.on('packetreceive', function (packet) {
    if (packet.cmd === 'publish') {
        let payload = JSON.parse(packet.payload.toString());
        writeIntoLog(fs, JSON.stringify(payload));
        if (status[payload.messageId] === 'created' && payload.clientId === uuid) { 
            writeIntoLog(fs, payload.service);
            let serviceNowNum = services.responseTopics.indexOf(packet.topic);//根據topic找到目前的service index
            if (payload.status === "confirm") { //if confirm, query next service
                status[payload.messageId] = 'prepared';
               
                let nextServiceNum = serviceNowNum + 1; //目前的service index+1
                if(nextServiceNum < serviceNum){ //如果還有service沒query
                    client.subscribe(
                        services.responseTopics[nextServiceNum],
                        options,
                        function (err, granted) { }
                    )
                    let tid = uuid + Math.random(); //transaction id
                    client.publish( //query next service
                        services.topics[nextServiceNum],
                        createMessage("query", services.responseTopics[nextServiceNum], tid),
                        { qos: 2, retain: true },
                        function (err) {
                            status[tid] = "created";
                            writeIntoLog(fs, JSON.stringify(status));
                            if (err) {
                                console.log(err);
                            }
                        }
                    )
                }
            }
            else {//if reject, query again
                setTimeout(function () {
                    client.publish( //query next service
                        services.topics[serviceNowNum],
                        createMessage("query", services.responseTopics[serviceNowNum], payload.messageId),
                        { qos: 2, retain: true },
                        function (err) {
                            if (err) {
                                console.log(err);
                            }
                        }
                    )
                }, getRandomInt(50, 500)); // How long you want the delay to be, measured in milliseconds.
            }
            let flag = true;
            let receievedConfirm = 0;
            for (let key in status) { // check if all serives are prepared
                if (status[key] === 'created') {
                    flag = false;
                }
                receievedConfirm++;
            }
            if( flag === true && receievedConfirm === parseInt(serviceNum) ){ // send commit to every services
                console.log("commit")
                writeIntoLog(fs, "commit!!")
                for(var i=0; i<serviceNum; i++){
                    client.publish( 
                        services.topics[i],
                        createMessage("commit", services.responseTopics[i]),
                        { qos: 2, retain: true },
                        function (err) {
                            if (err) {
                                console.log(err);
                            }
                        }
                    )
                }
                writeIntoTime( fs, performance.timeOrigin + performance.now() );
                client.end();
            }
        }
    }
})



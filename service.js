const mqtt = require('mqtt')
const options = { port: 1883, qos: 2 }
const service = mqtt.connect('mqtt://127.0.0.1', options)
const args = process.argv.slice(2);
const { MyDatabase, Service } = require('./MyService.js');

let status = []; //lock
let serviceNum = args[0]; //args[0] <- service 編號
let itemNum = args[1];
//args[1] <- item數量
//args[2] <- confirm or not

const serviceAction = function (payload, db) {
    if (payload.mesgtype === 'query') {
        console.log("===============");
        console.log("query from client " + payload.clientId);

        //check row status of db
        if (status[payload.payload[1]].status === 1 && args[2] === 'confirm') {////////!!!!!!!!!!!!!!!!!!
            var sqlInsert = 'INSERT INTO TxLog(TID,Item,Num,Status,ClientID) VALUES (?,?,?,?,?)';
            db.run(sqlInsert, [payload.tId, payload.payload[1], payload.payload[0], 0, payload.clientId]);

            var sqlSELEC = 'SELECT rowid AS id,TID,Item,Num,Status,ClientID FROM TxLog';
            console.log("------TxLog------")

            db.each(sqlSELEC, function (err, row) {
                console.log(row);
            });

            status[payload.payload[1]].status = 0;
            status[payload.payload[1]].clientId = payload.clientId;
            return 1;
        }
        else {
            return 0;
        }
    }
    // else if (payload.mesgtype === 'cancel') {///////
    //     console.log("===============");
    //     console.log("cancel form client " + payload.clientId);
    //     var sqlDel = 'DELETE FROM TxLog WHERE TID=?';
    //     db.run(sqlDel, [payload.payload[0]]);

    //     var sqlSELEC = 'SELECT rowid AS id,TID,Item,Num FROM TxLog';
    //     console.log("------TxLog------")
    //     db.each(sqlSELEC, function (err, row) {
    //         console.log(row);
    //     });
    //     return -1;
    // }
    else if (payload.mesgtype === 'commit') {
        console.log("===============");
        console.log("commit from client " + payload.clientId);

        var sqlSELECT = 'SELECT rowid AS id,TID,Item,Num,Status,ClientID FROM TxLog WHERE ClientID = ? AND Status = ?;';
        db.each(sqlSELECT, [payload.clientId, 0], function (err, row) {
            console.log("--------------")
            console.log(row);

            var sqlUPDATE = 'UPDATE DB SET Num = Num+' + row.Num + ' WHERE Item = ?';
            db.run(sqlUPDATE, [row.Item], function (err) {
                var sqlSELEC = 'SELECT rowid AS id,Item,Num FROM DB';
                console.log("------DB------")
                db.each(sqlSELEC, function (err, row) {
                    if (err) {
                        console.log(err)
                    }
                    console.log(row);
                });
            });
            status[row.Item].status = 1;

        })
        return -1;
    }
    else if (payload.mesgtype === 'abort') {
        console.log("===============");
        console.log("abort from client " + payload.clientId);
        var sqlUPDATE = "UPDATE TxLog SET Status = ? WHERE ClientID = ? "
        db.run(sqlUPDATE, [-1, payload.clientId], function (err) {
            if (err) {
                console.log(err);
            }
        })
        var sqlSELEC = 'SELECT rowid AS id,TID,Item,Num,Status,ClientID FROM TxLog';
        console.log("------TxLog------")
        db.each(sqlSELEC, function (err, row) {
            console.log(row);
        });

        for (var i = 0; i < itemNum; i++) {
            if (status[i].clientId === payload.clientId && status[i].status === 0) {
                status[i].status = 1;
            }
        }
        return -1;
    }
}

function createMessage(status, serivce, cId, tId) {
    let message = {
        status: status,
        service: serivce,
        clientId: cId,
        messageId: tId
    };

    let buf = Buffer.from(JSON.stringify(message));
    return buf;
}

let path = 'Documents/NCCU/111/MQTT_2PC/database/database' + serviceNum + '.db';
//let path = '.database/database'+serviceNum+'.db';
let dbsql = "CREATE TABLE DB (\
    Item int, \
    Num int \
    );";
let logsql = "CREATE TABLE TxLog (\
    TID int, \
    Item int, \
    Num int, \
    Status int,\
    ClientId varchar(40)\
    );";

const db = new MyDatabase(path, dbsql, logsql);
const myService = new Service("Topic" + serviceNum, serviceAction, db);
myService.createStorage();

//initialize database
var dbInitial = 'INSERT INTO DB(Item,Num) VALUES (?,?)';
for (var i = 0; i < itemNum; i++) {
    myService.database.db.run(dbInitial, [i, 0]);
}
//initialize lock
for (var i = 0; i < itemNum; i++) {
    let o1 = {
        id: i,
        clientId: "",
        status: 1 //status-> 1:unlock 0:lock
    };
    status.push(o1);
}

console.log(status)

service.on('connect', function () {
    service.subscribe('Topic' + serviceNum, options, function (err, granted) {
    })
})

service.on('packetreceive', function (packet) {
    if (packet.cmd === 'publish') {
        let payload = JSON.parse(packet.payload.toString());
        if (packet.topic === myService.topic) {
            var ii = myService.action(payload, myService.database.db);
            if (ii === 1 && args[2] === 'confirm') {//query 
                // wirte into TxLog ok! 
                service.publish(
                    payload.retopic,
                    createMessage('confirm', serviceNum, payload.clientId, payload.tId),
                    { qos: 2, retain: true },
                    function (err) {
                        if (err) {
                            console.log(err);
                        }
                    })
            }
            else if (ii === 0) { //query
                service.publish(
                    payload.retopic,
                    createMessage('reject', serviceNum, payload.clientId, payload.tId),
                    { qos: 2, retain: true },
                    function (err) {
                        if (err) {
                            console.log(err);
                        }
                    })
            }
        }
    }
})
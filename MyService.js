const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

exports.MyDatabase = function MyDatabase(path, dbsql, logsql) {
    this.path = path;
    this.dbsql = dbsql;
    this.logsql = logsql;
}

exports.Service = function Service(topic, action, database) {
    this.topic = topic;
    this.action = action;
    this.database = database;
    this.createStorage = function () {
        try {
            if (fs.existsSync(this.database.path)) {
                var db = new sqlite3.Database(this.database.path);
                this.database.db = db
            }
            else {
                var db = new sqlite3.Database(this.database.path);
                db.serialize( ()=> {
                    db.run(this.database.dbsql);
                })
                db.serialize( ()=> {
                    db.run(this.database.logsql);
                })
                this.database.db = db
            }
        } catch (err) {
            console.error(err);
        }
    }
}


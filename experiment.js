var exec = require('child_process');
var child = exec.exec('node mqtt.js ');
child.stdout.pipe(process.stdout)

for(var i=0;i<10;i++){
    //console.log(i+1);
    var child = exec.exec('node client.js '+i+' '+'5 2');
    child.stdout.pipe(process.stdout)
}
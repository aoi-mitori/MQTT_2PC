const aedes = require('aedes')()
const server = require('net').createServer(aedes.handle)
const port = 1883

//---------- server ----------//

server.listen(port, function () {
    console.log('server started and listening on port ', port)
})

aedes.on('clientError', function (client, err) {
    console.log('client error', client.id, err.message, err.stack)
})

aedes.on('connectionError', function (client, err) {
    console.log('client error', client, err.message, err.stack)
})

aedes.on('publish', function (packet, client) {
})

aedes.on('subscribe', function (subscriptions, client) {
    if (client) {
        console.log('subscribe from client', subscriptions, client.id)
    }
})

aedes.on('client', function (client) {
    console.log('new client', client.id)
})
osascript -e 'tell application "Terminal" to do script "node Documents/NCCU/111/MQTT_2PC/mqtt.js"'
osascript -e 'tell application "Terminal" to do script "node Documents/NCCU/111/MQTT_2PC/service.js 0 10 confirm"'
osascript -e 'tell application "Terminal" to do script "node Documents/NCCU/111/MQTT_2PC/service.js 1 10 confirm"'

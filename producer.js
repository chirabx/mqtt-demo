// producer.js - MQTT 消息生产者
const mqtt = require('mqtt');

// 连接到 MQTT 服务器
const client = mqtt.connect('ws://localhost:8083', {
    clientId: 'producer_' + Math.random().toString(16).substr(2, 8)
});

client.on('connect', () => {
    console.log('Producer 已连接到 MQTT 服务器');

    // 开始高频发布消息
    let messageCount = 0;
    const publishInterval = setInterval(() => {
        messageCount++;
        const topic = `metrics/${Math.floor(Math.random() * 3) + 1}/reading`;
        const message = JSON.stringify({
            id: messageCount,
            timestamp: Date.now(),
            value: Math.random() * 100,
            sensor: `sensor_${Math.floor(Math.random() * 5) + 1}`
        });

        client.publish(topic, message, { qos: 1 }, (err) => {
            if (err) {
                console.error('发布失败:', err);
            } else {
                console.log(`[Producer] 发布消息 #${messageCount} 到主题: ${topic}`);
            }
        });
    }, 100); // 每100ms发布一条消息

    // 10秒后停止发布
    setTimeout(() => {
        clearInterval(publishInterval);
        console.log('Producer 停止发布，总共发布了', messageCount, '条消息');
        client.end();
    }, 10000);
});

client.on('error', (err) => {
    console.error('Producer 连接错误:', err);
});

client.on('close', () => {
    console.log('Producer 连接已关闭');
});


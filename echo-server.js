// echo-server.js - MQTT 回显服务器
import mqtt from 'mqtt';

const client = mqtt.connect('ws://localhost:8083', {
    clientId: 'echo_server_' + Math.random().toString(16).substr(2, 8)
});

client.on('connect', () => {
    console.log('Echo Server 已连接到 MQTT 服务器');

    // 订阅请求主题
    client.subscribe('benchmark/request', { qos: 1 }, (err) => {
        if (err) {
            console.error('订阅失败:', err);
        } else {
            console.log('已订阅 benchmark/request，等待消息...');
        }
    });
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());

        // 回显消息
        const response = {
            id: data.id,
            timestamp: data.timestamp,
            data: data.data
        };

        client.publish('benchmark/response', JSON.stringify(response), { qos: 1 }, (err) => {
            if (err) {
                console.error('发布响应失败:', err);
            }
        });
    } catch (err) {
        console.error('处理消息错误:', err);
    }
});

client.on('error', (err) => {
    console.error('连接错误:', err);
});

client.on('close', () => {
    console.log('Echo Server 连接已关闭');
});

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n正在关闭 Echo Server...');
    client.end();
    process.exit(0);
});

console.log('MQTT Echo Server 启动中...');


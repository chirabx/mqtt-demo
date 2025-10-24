// worker.js - MQTT 共享订阅工作池
const mqtt = require('mqtt');

// 获取 worker ID（从命令行参数或环境变量）
const workerId = process.argv[2] || process.env.WORKER_ID || 'worker_1';

// 连接到 MQTT 服务器
const client = mqtt.connect('ws://localhost:8083', {
    clientId: workerId + '_' + Math.random().toString(16).substr(2, 8)
});

let messageCount = 0;

client.on('connect', () => {
    console.log(`[${workerId}] 已连接到 MQTT 服务器`);

    // 订阅共享订阅主题
    // $share/{group}/topic 格式实现负载均衡
    const sharedTopic = '$share/workers/metrics/+/reading';

    client.subscribe(sharedTopic, { qos: 1 }, (err) => {
        if (err) {
            console.error(`[${workerId}] 订阅失败:`, err);
        } else {
            console.log(`[${workerId}] 已订阅共享主题: ${sharedTopic}`);
        }
    });
});

client.on('message', (topic, message) => {
    messageCount++;
    const data = JSON.parse(message.toString());

    console.log(`[${workerId}] 收到消息 #${messageCount}:`, {
        topic,
        id: data.id,
        timestamp: new Date(data.timestamp).toLocaleTimeString(),
        value: data.value.toFixed(2),
        sensor: data.sensor
    });
});

client.on('error', (err) => {
    console.error(`[${workerId}] 连接错误:`, err);
});

client.on('close', () => {
    console.log(`[${workerId}] 连接已关闭，共处理了 ${messageCount} 条消息`);
});

// 优雅退出
process.on('SIGINT', () => {
    console.log(`\n[${workerId}] 正在关闭...`);
    client.end();
    process.exit(0);
});

// 模拟 worker 崩溃（可选，用于测试）
if (process.env.SIMULATE_CRASH === 'true') {
    setTimeout(() => {
        console.log(`[${workerId}] 模拟崩溃...`);
        process.exit(1);
    }, 5000);
}


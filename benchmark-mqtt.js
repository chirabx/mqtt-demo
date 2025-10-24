// benchmark-mqtt.js - MQTT 性能测试（简化版）
import mqtt from 'mqtt';

// 测试配置
const config = {
    concurrent: 10,        // 并发数
    messageSize: 100,      // 消息大小（字节）
    qos: 1,                // MQTT QoS 级别
    totalMessages: 1000    // 总消息数
};

// 生成测试消息
function generateMessage(size) {
    return 'x'.repeat(size);
}

// MQTT 回显测试
async function testMQTTEcho() {
    return new Promise((resolve) => {
        const client = mqtt.connect('ws://localhost:8083', {
            clientId: 'benchmark_' + Math.random().toString(16).substr(2, 8)
        });

        const latencies = [];
        let completed = 0;
        let sent = 0;

        client.on('connect', () => {
            console.log('[MQTT] 开始性能测试...');

            // 订阅响应主题
            client.subscribe('benchmark/response', { qos: config.qos });

            const startTime = Date.now();

            // 发送消息函数
            const sendMessage = () => {
                if (sent >= config.totalMessages) return;

                const msgId = sent++;
                const sendTime = Date.now();

                client.publish('benchmark/request', JSON.stringify({
                    id: msgId,
                    timestamp: sendTime,
                    data: generateMessage(config.messageSize)
                }), { qos: config.qos });
            };

            // 并发发送
            for (let i = 0; i < config.concurrent; i++) {
                sendMessage();
            }

            // 接收响应
            client.on('message', (topic, message) => {
                const receiveTime = Date.now();
                const data = JSON.parse(message.toString());
                const latency = receiveTime - data.timestamp;

                latencies.push(latency);
                completed++;

                // 继续发送
                if (sent < config.totalMessages) {
                    sendMessage();
                }

                // 完成测试
                if (completed >= config.totalMessages) {
                    const totalTime = Date.now() - startTime;
                    const throughput = (config.totalMessages / totalTime * 1000).toFixed(2);

                    resolve({
                        latencies,
                        totalTime,
                        throughput
                    });

                    client.end();
                }
            });
        });
    });
}

// 计算统计信息
function calculateStats(latencies) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const len = sorted.length;

    return {
        avg: (sorted.reduce((a, b) => a + b, 0) / len).toFixed(2),
        p50: sorted[Math.floor(len * 0.5)].toFixed(2),
        p95: sorted[Math.floor(len * 0.95)].toFixed(2),
        p99: sorted[Math.floor(len * 0.99)].toFixed(2)
    };
}

// 主测试函数
async function runBenchmark() {
    console.log('=== MQTT 性能测试 ===\n');
    console.log(`测试参数:`);
    console.log(`  并发数: ${config.concurrent}`);
    console.log(`  消息大小: ${config.messageSize} B`);
    console.log(`  QoS: ${config.qos}`);
    console.log(`  总消息数: ${config.totalMessages}\n`);

    // 测试 MQTT
    const mqttResult = await testMQTTEcho();
    const mqttStats = calculateStats(mqttResult.latencies);

    console.log('MQTT 结果:');
    console.log(`  平均延迟: ${mqttStats.avg} ms`);
    console.log(`  P50: ${mqttStats.p50} ms`);
    console.log(`  P95: ${mqttStats.p95} ms`);
    console.log(`  P99: ${mqttStats.p99} ms`);
    console.log(`  吞吐量: ${mqttResult.throughput} msg/s`);
    console.log(`  总耗时: ${mqttResult.totalTime} ms`);

    console.log('\n=== 测试结果 ===');
    console.log(`* 测试参数：并发 ${config.concurrent}，消息大小 ${config.messageSize} B，QoS ${config.qos}`);
    console.log(`* MQTT：avg ${mqttStats.avg} ms，P50 ${mqttStats.p50}，P95 ${mqttStats.p95}，P99 ${mqttStats.p99}`);
    console.log(`* 结论：MQTT 在并发 ${config.concurrent} 的情况下，平均延迟为 ${mqttStats.avg}ms，吞吐量为 ${mqttResult.throughput} msg/s`);
}

// 运行测试
runBenchmark().catch(console.error);


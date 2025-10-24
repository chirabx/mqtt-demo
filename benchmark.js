// benchmark.js - MQTT vs HTTP 性能测试
import mqtt from 'mqtt';
import http from 'http';

// 测试配置
const config = {
    concurrent: 10,        // 并发数
    messageSize: 100,      // 消息大小（字节）
    qos: 1,                // MQTT QoS 级别
    totalMessages: 1000     // 总消息数
};

// 生成测试消息
function generateMessage(size) {
    return 'x'.repeat(size);
}

// MQTT 测试
async function testMQTT() {
    return new Promise((resolve) => {
        const client = mqtt.connect('ws://localhost:8083', {
            clientId: 'benchmark_client_' + Math.random().toString(16).substr(2, 8)
        });

        const latencies = [];
        let completed = 0;
        let sent = 0;

        client.on('connect', () => {
            console.log('[MQTT] 开始性能测试...');

            // 订阅响应主题
            client.subscribe('benchmark/response', { qos: config.qos });

            const startTime = Date.now();

            // 发送消息
            const sendMessage = () => {
                if (sent >= config.totalMessages) return;

                const msgId = sent++;
                const sendTime = Date.now();

                client.publish('benchmark/request', JSON.stringify({
                    id: msgId,
                    data: generateMessage(config.messageSize)
                }), { qos: config.qos }, () => {
                    // 记录发送时间
                });
            };

            // 并发发送
            for (let i = 0; i < config.concurrent; i++) {
                sendMessage();
            }

            // 接收响应
            client.on('message', (topic, message) => {
                const receiveTime = Date.now();
                const data = JSON.parse(message.toString());
                const latency = receiveTime - data.sendTime;

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

// HTTP 测试
async function testHTTP() {
    return new Promise((resolve) => {
        const latencies = [];
        let completed = 0;
        let sent = 0;

        console.log('[HTTP] 开始性能测试...');

        const startTime = Date.now();

        const sendRequest = () => {
            if (sent >= config.totalMessages) return;

            const requestStart = Date.now();
            const msgId = sent++;

            const postData = JSON.stringify({
                id: msgId,
                data: generateMessage(config.messageSize)
            });

            const options = {
                hostname: 'localhost',
                port: 3000,
                path: '/benchmark',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(options, (res) => {
                const requestEnd = Date.now();
                const latency = requestEnd - requestStart;

                latencies.push(latency);
                completed++;

                // 继续发送
                if (sent < config.totalMessages) {
                    sendRequest();
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
                }
            });

            req.on('error', (err) => {
                console.error('[HTTP] 请求错误:', err);
                completed++;

                if (completed >= config.totalMessages) {
                    resolve({
                        latencies,
                        totalTime: Date.now() - startTime,
                        throughput: '0'
                    });
                }
            });

            req.write(postData);
            req.end();
        };

        // 并发发送
        for (let i = 0; i < config.concurrent; i++) {
            sendRequest();
        }
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
    console.log('=== MQTT vs HTTP 性能测试 ===\n');
    console.log(`测试参数:`);
    console.log(`  并发数: ${config.concurrent}`);
    console.log(`  消息大小: ${config.messageSize} B`);
    console.log(`  QoS: ${config.qos}`);
    console.log(`  总消息数: ${config.totalMessages}\n`);

    // 测试 MQTT
    console.log('测试 MQTT...');
    const mqttResult = await testMQTT();
    const mqttStats = calculateStats(mqttResult.latencies);

    console.log('\nMQTT 结果:');
    console.log(`  平均延迟: ${mqttStats.avg} ms`);
    console.log(`  P50: ${mqttStats.p50} ms`);
    console.log(`  P95: ${mqttStats.p95} ms`);
    console.log(`  P99: ${mqttStats.p99} ms`);
    console.log(`  吞吐量: ${mqttResult.throughput} msg/s`);
    console.log(`  总耗时: ${mqttResult.totalTime} ms`);

    // 测试 HTTP
    console.log('\n测试 HTTP...');
    const httpResult = await testHTTP();
    const httpStats = calculateStats(httpResult.latencies);

    console.log('\nHTTP 结果:');
    console.log(`  平均延迟: ${httpStats.avg} ms`);
    console.log(`  P50: ${httpStats.p50} ms`);
    console.log(`  P95: ${httpStats.p95} ms`);
    console.log(`  P99: ${httpStats.p99} ms`);
    console.log(`  吞吐量: ${httpResult.throughput} msg/s`);
    console.log(`  总耗时: ${httpResult.totalTime} ms`);

    // 对比分析
    console.log('\n=== 对比分析 ===');
    console.log(`延迟对比:`);
    console.log(`  平均延迟: MQTT ${mqttStats.avg}ms vs HTTP ${httpStats.avg}ms`);
    console.log(`  P50: MQTT ${mqttStats.p50}ms vs HTTP ${httpStats.p50}ms`);
    console.log(`  P95: MQTT ${mqttStats.p95}ms vs HTTP ${httpStats.p95}ms`);
    console.log(`  P99: MQTT ${mqttStats.p99}ms vs HTTP ${httpStats.p99}ms`);

    const avgDiff = ((parseFloat(mqttStats.avg) - parseFloat(httpStats.avg)) / parseFloat(httpStats.avg) * 100).toFixed(2);
    console.log(`\n平均延迟差异: ${avgDiff}%`);

    if (parseFloat(mqttStats.avg) < parseFloat(httpStats.avg)) {
        console.log('结论: MQTT 延迟更低');
    } else {
        console.log('结论: HTTP 延迟更低');
    }

    console.log(`\n吞吐量对比:`);
    console.log(`  MQTT: ${mqttResult.throughput} msg/s`);
    console.log(`  HTTP: ${httpResult.throughput} msg/s`);

    const throughputDiff = ((parseFloat(mqttResult.throughput) - parseFloat(httpResult.throughput)) / parseFloat(httpResult.throughput) * 100).toFixed(2);
    console.log(`吞吐量差异: ${throughputDiff}%`);

    if (parseFloat(mqttResult.throughput) > parseFloat(httpResult.throughput)) {
        console.log('结论: MQTT 吞吐量更高');
    } else {
        console.log('结论: HTTP 吞吐量更高');
    }
}

// 运行测试
runBenchmark().catch(console.error);


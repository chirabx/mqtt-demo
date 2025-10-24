// benchmark-compare.js - MQTT vs HTTP 性能对比测试
import mqtt from 'mqtt';
import http from 'http';

// 测试配置
const config = {
    concurrent: 10,
    messageSize: 100,
    qos: 1,
    totalMessages: 1000
};

// 生成测试消息
function generateMessage(size) {
    return 'x'.repeat(size);
}

// MQTT 测试
async function testMQTT() {
    return new Promise((resolve) => {
        const client = mqtt.connect('ws://localhost:8083', {
            clientId: 'benchmark_' + Math.random().toString(16).substr(2, 8)
        });

        const latencies = [];
        let completed = 0;
        let sent = 0;

        client.on('connect', () => {
            console.log('[MQTT] 开始测试...');

            client.subscribe('benchmark/response', { qos: config.qos });

            const startTime = Date.now();

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

            for (let i = 0; i < config.concurrent; i++) {
                sendMessage();
            }

            client.on('message', (topic, message) => {
                const receiveTime = Date.now();
                const data = JSON.parse(message.toString());
                const latency = receiveTime - data.timestamp;

                latencies.push(latency);
                completed++;

                if (sent < config.totalMessages) {
                    sendMessage();
                }

                if (completed >= config.totalMessages) {
                    resolve({
                        latencies,
                        totalTime: Date.now() - startTime
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

        console.log('[HTTP] 开始测试...');

        const startTime = Date.now();

        const sendRequest = () => {
            if (sent >= config.totalMessages) return;

            const requestStart = Date.now();
            const msgId = sent++;

            const postData = JSON.stringify({
                id: msgId,
                timestamp: requestStart,
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
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk.toString();
                });

                res.on('end', () => {
                    try {
                        const data = JSON.parse(responseData);
                        const latency = requestEnd - data.timestamp;

                        latencies.push(latency);
                        completed++;

                        if (sent < config.totalMessages) {
                            sendRequest();
                        }

                        if (completed >= config.totalMessages) {
                            resolve({
                                latencies,
                                totalTime: Date.now() - startTime
                            });
                        }
                    } catch (err) {
                        console.error('解析响应错误:', err);
                        completed++;

                        if (completed >= config.totalMessages) {
                            resolve({
                                latencies,
                                totalTime: Date.now() - startTime
                            });
                        }
                    }
                });
            });

            req.on('error', (err) => {
                console.error('[HTTP] 请求错误:', err);
                completed++;

                if (completed >= config.totalMessages) {
                    resolve({
                        latencies,
                        totalTime: Date.now() - startTime
                    });
                }
            });

            req.write(postData);
            req.end();
        };

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
    console.log('=== MQTT vs HTTP 性能对比测试 ===\n');
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

    console.log('\n=== 测试结果 ===');
    console.log(`* 测试参数：并发 ${config.concurrent}，消息大小 ${config.messageSize} B，QoS ${config.qos}`);
    console.log(`* HTTP：avg ${httpStats.avg} ms，P50 ${httpStats.p50}，P95 ${httpStats.p95}，P99 ${httpStats.p99}`);
    console.log(`* MQTT：avg ${mqttStats.avg} ms，P50 ${mqttStats.p50}，P95 ${mqttStats.p95}，P99 ${mqttStats.p99}`);

    if (parseFloat(mqttStats.avg) < parseFloat(httpStats.avg)) {
        console.log(`* 结论：MQTT 平均延迟比 HTTP 低 ${Math.abs(avgDiff)}%`);
    } else {
        console.log(`* 结论：HTTP 平均延迟比 MQTT 低 ${Math.abs(avgDiff)}%`);
    }
}

// 运行测试
runBenchmark().catch(console.error);


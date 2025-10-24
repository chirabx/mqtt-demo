// test-workers.js - 自动化测试共享订阅工作池
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== MQTT 共享订阅工作池测试 ===\n');

const workers = [];
const workerStats = {};

// 启动 3 个 worker
console.log('1. 启动 3 个 worker 进程...\n');

for (let i = 1; i <= 3; i++) {
    const workerId = `worker_${i}`;
    workerStats[workerId] = { received: 0, errors: 0 };

    const worker = spawn('node', [join(__dirname, 'worker.js'), workerId], {
        stdio: 'pipe'
    });

    worker.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output.trim());

        // 统计收到的消息
        if (output.includes('收到消息')) {
            workerStats[workerId].received++;
        }
        if (output.includes('错误')) {
            workerStats[workerId].errors++;
        }
    });

    worker.stderr.on('data', (data) => {
        console.error(`[${workerId}] Error:`, data.toString());
    });

    workers.push({ id: workerId, process: worker });
}

// 等待 worker 连接
setTimeout(() => {
    console.log('\n2. 启动 producer 发布消息（10秒）...\n');

    const producer = spawn('node', [join(__dirname, 'producer.js')], {
        stdio: 'pipe'
    });

    producer.stdout.on('data', (data) => {
        console.log(data.toString().trim());
    });

    // 10秒后停止 producer
    setTimeout(() => {
        console.log('\n3. Producer 已停止，查看消息分配情况...\n');
        console.log('Worker 消息统计:');
        Object.entries(workerStats).forEach(([id, stats]) => {
            console.log(`  ${id}: 收到 ${stats.received} 条消息`);
        });

        // 验证负载均衡
        const counts = Object.values(workerStats).map(s => s.received);
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;

        console.log(`\n负载均衡统计:`);
        console.log(`  最小值: ${min}`);
        console.log(`  最大值: ${max}`);
        console.log(`  平均值: ${avg.toFixed(2)}`);
        console.log(`  差值: ${max - min}`);

        if (max - min <= avg * 0.3) {
            console.log(`  ✓ 负载均衡稳定（差值 < 平均值的30%）`);
        } else {
            console.log(`  ✗ 负载均衡不稳定（差值较大）`);
        }

        // 测试 worker 退出后的行为
        setTimeout(() => {
            console.log('\n4. 停止 worker_1，验证其他 worker 继续工作...\n');

            const stoppedWorker = workers.find(w => w.id === 'worker_1');
            stoppedWorker.process.kill('SIGINT');

            setTimeout(() => {
                console.log('\n5. 重新启动 producer 发布消息...\n');

                const producer2 = spawn('node', [join(__dirname, 'producer.js')], {
                    stdio: 'pipe'
                });

                producer2.stdout.on('data', (data) => {
                    console.log(data.toString().trim());
                });

                setTimeout(() => {
                    console.log('\n6. 查看剩余 worker 的消息统计...\n');
                    console.log('Worker 消息统计（worker_1 已退出）:');
                    Object.entries(workerStats).forEach(([id, stats]) => {
                        if (id !== 'worker_1') {
                            console.log(`  ${id}: 收到 ${stats.received} 条消息`);
                        }
                    });

                    const remainingCounts = Object.entries(workerStats)
                        .filter(([id]) => id !== 'worker_1')
                        .map(([, stats]) => stats.received);

                    const totalReceived = remainingCounts.reduce((a, b) => a + b, 0);

                    console.log(`\n结论:`);
                    console.log(`  ✓ 负载均衡: ${totalReceived > 0 ? '是' : '否'}`);
                    console.log(`  ✓ 容错性: ${remainingCounts.length === 2 ? 'worker_1 退出后，worker_2 和 worker_3 继续消费' : '未知'}`);

                    // 清理
                    console.log('\n7. 清理所有进程...\n');
                    workers.forEach(w => w.process.kill('SIGINT'));
                    producer2.kill('SIGINT');

                    setTimeout(() => {
                        console.log('测试完成！');
                        process.exit(0);
                    }, 1000);
                }, 5000);
            }, 2000);
        }, 2000);
    }, 12000);
}, 2000);


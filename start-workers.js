// start-workers.js - 启动多个 worker 进程
const { spawn } = require('child_process');
const path = require('path');

const workerCount = 3; // 启动 3 个 worker
const workers = [];

console.log(`启动 ${workerCount} 个 worker 进程...\n`);

// 启动多个 worker
for (let i = 1; i <= workerCount; i++) {
    const worker = spawn('node', [path.join(__dirname, 'worker.js'), `worker_${i}`], {
        stdio: 'inherit',
        env: { ...process.env, WORKER_ID: `worker_${i}` }
    });

    workers.push(worker);

    worker.on('exit', (code) => {
        console.log(`\nWorker ${i} 退出，退出码: ${code}`);
    });
}

// 启动 producer
console.log('\n启动 producer...\n');
const producer = spawn('node', [path.join(__dirname, 'producer.js')], {
    stdio: 'inherit'
});

producer.on('exit', (code) => {
    console.log(`\nProducer 退出，退出码: ${code}`);
});

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n正在关闭所有进程...');
    workers.forEach(worker => worker.kill('SIGINT'));
    producer.kill('SIGINT');
    setTimeout(() => process.exit(0), 2000);
});

console.log('按 Ctrl+C 退出\n');


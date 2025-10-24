// http-echo-server.js - HTTP 回显服务器
import http from 'http';

const PORT = 3000;

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/benchmark') {
        let body = '';

        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);

                // 回显消息
                const response = {
                    id: data.id,
                    timestamp: data.timestamp,
                    data: data.data
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (err) {
                console.error('处理请求错误:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(PORT, () => {
    console.log(`HTTP Echo Server 运行在 http://localhost:${PORT}`);
});

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n正在关闭 HTTP Echo Server...');
    server.close(() => {
        process.exit(0);
    });
});


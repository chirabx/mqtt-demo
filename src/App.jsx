// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import "./App.css";

// MQTT客户端库
import mqtt from "mqtt";

function App() {
  // 状态管理
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [newTopic, setNewTopic] = useState("");
  const [publishTopic, setPublishTopic] = useState("");
  const [publishMessage, setPublishMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("未连接");

  // MQTT客户端引用
  const clientRef = useRef(null);

  const MQTT_SERVER = window.location.protocol === 'https:'
    ? 'wss://' + window.location.host + '/mqtt'
    : 'ws://localhost:8083';

  console.log('MQTT连接地址:', MQTT_SERVER);

  // 连接MQTT服务器
  const connectToBroker = () => {
    setConnectionStatus("连接中...");

    const options = {
      keepalive: 30,
      protocolId: "MQTT",
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      clientId: "mqttjs_" + Math.random().toString(16).substr(2, 8),
      // 自动重连配置
      will: {
        topic: 'WillMsg',
        payload: 'Connection Closed abnormally..!',
        qos: 0,
        retain: false
      }
    };

    try {
      clientRef.current = mqtt.connect(MQTT_SERVER, options);

      clientRef.current.on("connect", () => {
        setIsConnected(true);
        setConnectionStatus("已连接");
        console.log("成功连接到MQTT服务器");
      });

      clientRef.current.on("error", (err) => {
        console.error("连接错误:", err);
        setConnectionStatus(`连接错误: ${err.message}`);
      });

      clientRef.current.on("reconnect", () => {
        setConnectionStatus("重新连接中...");
        console.log("正在重新连接...");
      });

      clientRef.current.on("offline", () => {
        setIsConnected(false);
        setConnectionStatus("离线");
        console.log("MQTT客户端离线");
      });

      clientRef.current.on("close", () => {
        setIsConnected(false);
        setConnectionStatus("连接已关闭");
        console.log("MQTT连接已关闭");
      });

      clientRef.current.on("message", (topic, message) => {
        const payload = message.toString();
        console.log(`收到消息: [${topic}] ${payload}`);

        setMessages((prev) => [
          {
            id: Date.now(),
            topic,
            message: payload,
            timestamp: new Date().toLocaleTimeString(),
            direction: "incoming"
          },
          ...prev
        ]);
      });
    } catch (err) {
      console.error("连接异常:", err);
      setConnectionStatus(`连接异常: ${err.message}`);
    }
  };

  // 断开连接
  const disconnectFromBroker = () => {
    if (clientRef.current) {
      clientRef.current.end();
      setIsConnected(false);
      setConnectionStatus("已断开连接");
    }
  };

  // 订阅主题
  const subscribeToTopic = () => {
    if (!newTopic.trim()) return;

    if (clientRef.current && isConnected) {
      clientRef.current.subscribe(newTopic, (err) => {
        if (err) {
          console.error("订阅失败:", err);
          return;
        }

        // 添加到订阅列表
        if (!subscriptions.includes(newTopic)) {
          setSubscriptions((prev) => [...prev, newTopic]);
        }

        setNewTopic("");
      });
    }
  };

  // 取消订阅
  const unsubscribeFromTopic = (topic) => {
    if (clientRef.current && isConnected) {
      clientRef.current.unsubscribe(topic, (err) => {
        if (err) {
          console.error("取消订阅失败:", err);
          return;
        }

        setSubscriptions((prev) => prev.filter((t) => t !== topic));
      });
    }
  };

  // 发布消息
  const publishMessageToTopic = () => {
    if (!publishTopic.trim() || !publishMessage.trim()) return;

    if (clientRef.current && isConnected) {
      clientRef.current.publish(publishTopic, publishMessage);

      // 添加到消息列表
      setMessages((prev) => [
        {
          id: Date.now(),
          topic: publishTopic,
          message: publishMessage,
          timestamp: new Date().toLocaleTimeString(),
          direction: "outgoing"
        },
        ...prev
      ]);

      setPublishMessage("");
    }
  };

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.end();
      }
    };
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>MQTT发布/订阅演示</h1>
        <div className={`status ${isConnected ? "connected" : "disconnected"}`}>{connectionStatus}</div>
      </header>

      <div className="connection-controls">
        {!isConnected ? (
          <button onClick={connectToBroker} className="connect-btn">
            连接到MQTT服务器
          </button>
        ) : (
          <button onClick={disconnectFromBroker} className="disconnect-btn">
            断开连接
          </button>
        )}
      </div>

      <div className="main">
        <div className="container">
          <div className="subscription-section">
            <h2>订阅主题</h2>
            <div className="input-group">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="输入要订阅的主题"
                disabled={!isConnected}
              />
              <button onClick={subscribeToTopic} disabled={!isConnected || !newTopic.trim()}>
                订阅
              </button>
            </div>

            <div className="subscriptions-list">
              <h3>已订阅主题:</h3>
              {subscriptions.length > 0 ? (
                <ul>
                  {subscriptions.map((topic, index) => (
                    <li key={index}>
                      {topic}
                      <button onClick={() => unsubscribeFromTopic(topic)} className="unsubscribe-btn">
                        取消订阅
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>未订阅任何主题</p>
              )}
            </div>
          </div>

          <div className="publish-section">
            <h2>发布消息</h2>
            <div className="input-group">
              <input
                type="text"
                value={publishTopic}
                onChange={(e) => setPublishTopic(e.target.value)}
                placeholder="输入主题"
                disabled={!isConnected}
              />
            </div>
            <div className="input-group">
              <textarea
                value={publishMessage}
                onChange={(e) => setPublishMessage(e.target.value)}
                placeholder="输入消息内容"
                disabled={!isConnected}
                rows={3}
              />
            </div>
            <button
              onClick={publishMessageToTopic}
              disabled={!isConnected || !publishTopic.trim() || !publishMessage.trim()}
              className="publish-btn"
            >
              发布消息
            </button>
          </div>
        </div>

        <div className="messages-section">
          <h2>消息日志</h2>
          <div className="messages-container">
            {messages.length > 0 ? (
              <ul>
                {messages.map((msg) => (
                  <li key={msg.id} className={`message ${msg.direction}`}>
                    <div className="message-header">
                      <span className="topic">{msg.topic}</span>
                      <span className="timestamp">{msg.timestamp}</span>
                    </div>
                    <div className="message-content">{msg.message}</div>
                    <div className="message-direction">{msg.direction === "incoming" ? "接收" : "发送"}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>没有消息</p>
            )}
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>MQTT服务器: {MQTT_SERVER}</p>
        <p>当前时间: {new Date().toLocaleString()}</p>
      </footer>
    </div>
  );
}

export default App;

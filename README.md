# Document Converter MCP Server

一个功能强大的文档转换 MCP (Model Context Protocol) 服务器，支持多种文档格式之间的转换，并提供 Streamable HTTP、SSE 和 Stdio 三种传输方式。

## 🚀 功能特性

### 支持的文档格式
- **输入格式**: TXT, Markdown, HTML, DOCX, PDF, RTF
- **输出格式**: TXT, Markdown, HTML, DOCX, PDF, RTF

### 传输方式
- **Streamable HTTP**: 支持 HTTP 请求/响应和服务器发送事件 (SSE)
- **Server-Sent Events (SSE)**: 实时流式消息传输
- **Stdio**: 标准输入输出传输，适用于命令行集成

### 核心工具
1. **convert-document**: 单个文档格式转换
2. **list-supported-formats**: 列出所有支持的格式和依赖状态
3. **convert-file-batch**: 批量文档转换

## 📁 项目结构

```
document-converter/
├── server/                     # Python 实现
│   ├── document_converter.py   # 主服务器 (Streamable HTTP)
│   ├── stdio_server.py         # Stdio 传输服务器
│   ├── pyproject.toml          # Python 依赖配置
│   └── Dockerfile              # Python Docker 配置
├── typescript-server/          # TypeScript 实现
│   ├── src/
│   │   ├── document-converter.ts # 主服务器 (Streamable HTTP)
│   │   ├── stdio-server.ts     # Stdio 传输服务器
│   │   └── index.ts            # 入口文件
│   ├── package.json            # Node.js 依赖配置
│   ├── tsconfig.json           # TypeScript 配置
│   └── Dockerfile              # TypeScript Docker 配置
├── docker-compose.yml          # Docker Compose 配置
├── nginx.conf                  # Nginx 负载均衡配置
└── README.md                   # 项目文档
```

## 🛠️ 安装和运行

### 方式一：Docker Compose (推荐)

```bash
# 克隆项目
cd document-converter

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

服务端口：
- Nginx 负载均衡: `http://localhost:80`
- Python 服务器: `http://localhost:3000`
- TypeScript 服务器: `http://localhost:3001`

### 方式二：Python 本地运行

```bash
cd server

# 安装依赖
pip install .

# 安装可选依赖 (用于完整功能)
pip install pypandoc python-docx weasyprint mammoth PyPDF2

# 启动 Streamable HTTP 服务器
python document_converter.py

# 或启动 Stdio 服务器
python stdio_server.py
```

### 方式三：TypeScript 本地运行

```bash
cd typescript-server

# 安装依赖
npm install

# 安装可选依赖 (用于完整功能)
npm install marked turndown puppeteer officegen mammoth pdf-parse

# 构建项目
npm run build

# 启动 Streamable HTTP 服务器
npm start

# 或开发模式
npm run dev
```

## 📖 使用方法

### HTTP API 使用

#### 1. 健康检查
```bash
curl http://localhost:3000/health
```

#### 2. 初始化 MCP 会话
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "document-converter-client",
        "version": "1.0.0"
      }
    }
  }'
```

#### 3. 列出可用工具
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

#### 4. 文档转换示例
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "convert-document",
      "arguments": {
        "content": "# Hello World\n\nThis is a **markdown** document.",
        "input_format": "md",
        "output_format": "html",
        "filename": "example.md"
      }
    }
  }'
```

### Stdio 使用

```bash
# Python Stdio 服务器
echo '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "test-client", "version": "1.0.0"}
  }
}' | python server/stdio_server.py

# TypeScript Stdio 服务器
echo '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "test-client", "version": "1.0.0"}
  }
}' | node typescript-server/dist/stdio-server.js
```

## 🔧 配置选项

### 环境变量

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `PORT` | 3000 (Python), 3001 (TypeScript) | 服务器端口 |
| `HOST` | localhost | 服务器主机 |
| `NODE_ENV` | development | Node.js 环境 (仅 TypeScript) |

### 依赖库状态

服务器会自动检测可选依赖的安装状态：

**Python 依赖**:
- `pypandoc`: Pandoc 集成，用于高级文档转换
- `python-docx`: DOCX 文件处理
- `weasyprint`: HTML 到 PDF 转换
- `mammoth`: DOCX 到 HTML 转换
- `PyPDF2`: PDF 文件处理

**TypeScript 依赖**:
- `marked`: Markdown 到 HTML 转换
- `turndown`: HTML 到 Markdown 转换
- `puppeteer`: PDF 生成
- `officegen`: DOCX 文件生成
- `mammoth`: DOCX 文件读取
- `pdf-parse`: PDF 文件解析

## 📝 API 文档

### convert-document

转换单个文档的格式。

**参数**:
- `content` (string): 文档内容 (二进制格式需 base64 编码)
- `input_format` (string): 输入格式 (txt|md|html|docx|pdf|rtf)
- `output_format` (string): 输出格式 (txt|md|html|docx|pdf|rtf)
- `filename` (string, 可选): 文件名，用于上下文

**返回**: 转换后的文档内容 (二进制格式为 base64 编码)

### list-supported-formats

列出所有支持的格式和依赖库状态。

**参数**: 无

**返回**: 格式化的支持格式列表和依赖状态

### convert-file-batch

批量转换多个文件到相同的输出格式。

**参数**:
- `files` (array): 文件列表，每个文件包含 content, input_format, filename
- `output_format` (string): 目标输出格式

**返回**: 批量转换结果报告

## 🐛 故障排除

### 常见问题

1. **依赖缺失错误**
   ```bash
   # Python
   pip install pypandoc python-docx weasyprint mammoth PyPDF2
   
   # TypeScript
   npm install marked turndown puppeteer officegen mammoth pdf-parse
   ```

2. **Puppeteer Chrome 下载失败**
   ```bash
   # 设置环境变量使用系统 Chrome
   export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
   ```

3. **端口冲突**
   ```bash
   # 修改环境变量
   export PORT=8080
   ```

4. **Docker 权限问题**
   ```bash
   # 确保 Docker 有足够权限
   sudo docker-compose up -d
   ```

### 日志查看

```bash
# Docker 日志
docker-compose logs -f document-converter-python
docker-compose logs -f document-converter-typescript

# 本地运行日志
# 服务器会输出详细的请求和错误信息到控制台
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

# iztro MCP Server 部署說明

這個專案現在同時提供紫微斗數函式庫、網站首頁，以及可供 Manus 使用的 MCP Streamable HTTP 服務。

## 端點

- `GET /`：服務介紹頁
- `GET /health`：健康檢查
- `POST /mcp`：MCP Streamable HTTP endpoint
- `TRANSPORT=stdio`：改用本機 stdio MCP 模式

## 本機啟動

```bash
npm install
npm run build
PORT=3000 npm start
```

## 公開容器部署

專案根目錄已提供 `Dockerfile`。部署平台需要：

- 對外監聽 `PORT`，預設 3000
- Health check path：`/health`
- MCP URL：`https://你的網域/mcp`

若要限制公開呼叫，可設定 `MCP_API_KEY`。啟用後，所有 `/mcp` POST 請求都必須帶上：

```http
Authorization: Bearer <你的金鑰>
```

## Manus 連接器

在 Manus 中新增 Custom MCP，使用公開的 `/mcp` URL。這是標準 Streamable HTTP，不是舊版 SSE endpoint。

目前提供的工具：

- `correct_solar_time`
- `generate_chart`
- `get_palace`
- `get_three_directions`
- `get_mutagens`
- `get_horoscope`
- `analyze_chart`

## 注意事項

目前命盤快取存放於記憶體中，服務重新部署或重啟後，舊的 `chartId` 會失效。正式長期使用時，請使用固定部署網址，不要依賴 Manus Sandbox 的暫時轉送網址。

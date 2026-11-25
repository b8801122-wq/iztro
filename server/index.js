import express from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import {
  buildChart,
  getPalaceData,
  getThreeDirections,
  getMutagens
} from './chart.js';

import { correctTaiwanTrueSolarTime } from './solar-time.js';

// 暫存已產生的命盤；伺服器重新啟動後會清空。
const chartCache = new Map();

function result(data) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

function errorResult(error) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: error instanceof Error ? error.message : String(error)
      }
    ]
  };
}

function registerTools(server) {
  // 1. 台灣真太陽時修正
  server.tool(
    'correct_solar_time',
    '依出生日期、時間及經度計算台灣真太陽時',
    {
      date: z.string().describe('日期，YYYY-MM-DD'),
      time: z.string().describe('時間，HH:mm'),
      longitude: z.number().describe('出生地經度，東經為正')
    },
    async (args) => {
      try {
        return result(correctTaiwanTrueSolarTime(args));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 2. 建立紫微斗數命盤
  server.tool(
    'generate_chart',
    '依出生資料建立紫微斗數命盤，回傳完整 JSON 盤面',
    {
      birthDate: z.string().describe('出生日期，YYYY-MM-DD'),
      birthTime: z.string().describe('出生時間，HH:mm'),
      gender: z.enum(['男', '女']),
      longitude: z.number().describe('出生地經度'),
      calendar: z.enum(['solar', 'lunar']).default('solar'),
      isLeapMonth: z.boolean().default(false),
      fixLeap: z.boolean().default(true),
      targetDate: z.string().optional().describe('指定流年日期，YYYY-MM-DD')
    },
    async (args) => {
      try {
        const chartData = buildChart(args);
        const chartId = randomUUID();

        chartCache.set(chartId, chartData);

        return result({
          chartId,
          chart: chartData
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 3. 查詢指定宮位
  server.tool(
    'get_palace',
    '依 chartId 查詢命盤中的指定宮位資料',
    {
      chartId: z.string(),
      palaceName: z.string().describe('例如：命宮、夫妻宮、官祿宮')
    },
    async ({ chartId, palaceName }) => {
      try {
        const chartData = chartCache.get(chartId);
        if (!chartData) throw new Error('找不到命盤，請重新產生命盤');

        return result(getPalaceData(chartData, palaceName));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 4. 查詢三方四正
  server.tool(
    'get_three_directions',
    '查詢指定宮位的三方四正資料',
    {
      chartId: z.string(),
      palaceName: z.string()
    },
    async ({ chartId, palaceName }) => {
      try {
        const chartData = chartCache.get(chartId);
        if (!chartData) throw new Error('找不到命盤，請重新產生命盤');

        return result(getThreeDirections(chartData, palaceName));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 5. 查詢四化
  server.tool(
    'get_mutagens',
    '列出命盤中所有帶有四化標記的星曜',
    {
      chartId: z.string()
    },
    async ({ chartId }) => {
      try {
        const chartData = chartCache.get(chartId);
        if (!chartData) throw new Error('找不到命盤，請重新產生命盤');

        return result(getMutagens(chartData));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 6. 查詢流年資料
  server.tool(
    'get_horoscope',
    '查詢命盤建立時指定的流年及流時資料',
    {
      chartId: z.string()
    },
    async ({ chartId }) => {
      try {
        const chartData = chartCache.get(chartId);
        if (!chartData) throw new Error('找不到命盤，請重新產生命盤');

        return result({
          meta: chartData.meta,
          horoscope: chartData.horoscope
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 7. 命盤摘要分析資料
  server.tool(
    'analyze_chart',
    '整理命盤十二宮、主星、輔星、雜曜及四化資料，供後續分析',
    {
      chartId: z.string()
    },
    async ({ chartId }) => {
      try {
        const chartData = chartCache.get(chartId);
        if (!chartData) throw new Error('找不到命盤，請重新產生命盤');

        return result({
          birth: chartData.birth,
          core: chartData.core,
          palaces: chartData.palaces.map(palace => ({
            name: palace.name,
            heavenlyStem: palace.heavenlyStem,
            earthlyBranch: palace.earthlyBranch,
            majorStars: palace.majorStars,
            auxiliaryStars: palace.auxiliaryStars,
            miscellaneousStars: palace.miscellaneousStars,
            fourTransformations: palace.fourTransformations,
            shenSha: palace.shenSha
          })),
          dataNotes: chartData.dataNotes
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

function createMcpServer() {
  const server = new McpServer({
    name: 'ziwei-chart-assistant',
    version: '0.1.0'
  });

  registerTools(server);
  return server;
}

// 支援 stdio 模式
if (process.env.TRANSPORT === 'stdio') {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
} else {
  // Render 使用 Streamable HTTP 模式
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'ziwei-chart-assistant',
      version: '0.1.0'
    });
  });

  app.post('/mcp', async (req, res) => {
    try {
      const apiKey = process.env.MCP_API_KEY;

      if (
        apiKey &&
        req.headers.authorization !== `Bearer ${apiKey}`
      ) {
        return res.status(401).json({
          error: 'Unauthorized'
        });
      }

      const server = createMcpServer();

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });

      res.on('close', () => {
        void transport.close();
        void server.close();
      });

      await server.connect(transport);

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    }
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).send('Method Not Allowed');
  });

  app.delete('/mcp', (_req, res) => {
    res.status(405).send('Method Not Allowed');
  });

  const port = Number(process.env.PORT) || 3000;

  app.listen(port, '0.0.0.0', () => {
    console.log(`Ziwei MCP server listening on ${port}`);
  });
}

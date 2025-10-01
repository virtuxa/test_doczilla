import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WeatherService } from './weather.js';
import { CacheService } from './cache.js';

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(process.cwd(), 'public');

// Инициализация сервисов
const cacheService = new CacheService(15 * 60 * 1000); // 15 минут
const weatherService = new WeatherService(cacheService);

/**
 * Отправка JSON ответа
 */
function sendJSON(res: http.ServerResponse, data: any, statusCode = 200) {
  res.writeHead(statusCode, { 
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

/**
 * Отправка файла
 */
function sendFile(res: http.ServerResponse, filePath: string, contentType: string) {
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
  });
  
  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const method = req.method || 'GET';

  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // API: Получение погоды
    if (url.pathname === '/weather' && method === 'GET') {
      const city = url.searchParams.get('city');

      if (!city) {
        sendJSON(res, { error: 'City parameter is required' }, 400);
        return;
      }

      try {
        const weatherData = await weatherService.getWeatherForCity(city);
        sendJSON(res, weatherData);
      } catch (error: any) {
        console.error('Weather API error:', error);
        sendJSON(res, { 
          error: error.message || 'Failed to fetch weather data' 
        }, 500);
      }
      return;
    }

    // API: Статистика кэша
    if (url.pathname === '/api/cache-stats' && method === 'GET') {
      const stats = cacheService.getStats();
      sendJSON(res, stats);
      return;
    }

    // Статические файлы
    let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const contentTypeMap: { [key: string]: string } = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
    };

    sendFile(res, filePath, contentTypeMap[ext] || 'text/plain');

  } catch (error) {
    console.error('Server error:', error);
    sendJSON(res, { error: 'Internal server error' }, 500);
  }
});

// Запуск сервера
server.listen(PORT, () => {
  console.log(`Weather forecast service running on http://localhost:${PORT}`);
  console.log(`Cache TTL: 15 minutes`);
  console.log(`Public directory: ${PUBLIC_DIR}`);
});



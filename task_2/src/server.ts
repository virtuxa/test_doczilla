import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

import { AuthService } from './auth.js';
import { FileStorage } from './storage.js';
import { parseMultipartData } from './multipart.js';

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

// Инициализация
const storage = new FileStorage(UPLOAD_DIR);
const authService = new AuthService();

// Создание директорий
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Парсинг тела запроса
 */
async function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Отправка JSON ответа
 */
function sendJSON(res: http.ServerResponse, data: any, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
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

/**
 * Получение токена из заголовков
 */
function getAuthToken(req: http.IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Обработчик запросов
 */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const method = req.method || 'GET';

  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // API: Регистрация
    if (url.pathname === '/api/register' && method === 'POST') {
      const body = await parseBody(req);
      const { username, password } = JSON.parse(body);
      
      if (!username || !password) {
        sendJSON(res, { error: 'Username and password required' }, 400);
        return;
      }

      const result = authService.register(username, password);
      if (!result.success) {
        sendJSON(res, { error: result.message }, 400);
        return;
      }

      sendJSON(res, { success: true, message: 'User registered successfully' });
      return;
    }

    // API: Вход
    if (url.pathname === '/api/login' && method === 'POST') {
      const body = await parseBody(req);
      const { username, password } = JSON.parse(body);

      const result = authService.login(username, password);
      if (!result.success) {
        sendJSON(res, { error: result.message }, 401);
        return;
      }

      sendJSON(res, { success: true, token: result.token });
      return;
    }

    // API: Загрузка файла
    if (url.pathname === '/api/upload' && method === 'POST') {
      const token = getAuthToken(req);
      if (!token || !authService.verifyToken(token)) {
        sendJSON(res, { error: 'Unauthorized' }, 401);
        return;
      }

      const userId = authService.getUserIdFromToken(token);
      if (!userId) {
        sendJSON(res, { error: 'Invalid token' }, 401);
        return;
      }

      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        sendJSON(res, { error: 'Content-Type must be multipart/form-data' }, 400);
        return;
      }

      const files = await parseMultipartData(req, contentType);
      
      if (files.length === 0) {
        sendJSON(res, { error: 'No file uploaded' }, 400);
        return;
      }

      const file = files[0];
      const fileInfo = await storage.saveFile(file.filename, file.data, userId);

      const downloadUrl = `${req.headers.origin || `http://localhost:${PORT}`}/download/${fileInfo.id}`;
      
      sendJSON(res, {
        success: true,
        fileId: fileInfo.id,
        filename: fileInfo.filename,
        downloadUrl,
        size: fileInfo.size,
      });
      return;
    }

    // API: Скачивание файла
    if (url.pathname.startsWith('/download/') && method === 'GET') {
      const fileId = url.pathname.split('/download/')[1];
      const fileInfo = storage.getFileInfo(fileId);

      if (!fileInfo) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('File not found');
        return;
      }

      // Обновляем время последнего скачивания
      storage.updateLastDownload(fileId);

      const filePath = path.join(UPLOAD_DIR, fileInfo.storedFilename);
      res.writeHead(200, {
        'Content-Type': fileInfo.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`,
        'Content-Length': fileInfo.size,
      });

      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
      return;
    }

    // API: Статистика по файлам
    if (url.pathname === '/api/files' && method === 'GET') {
      const token = getAuthToken(req);
      if (!token || !authService.verifyToken(token)) {
        sendJSON(res, { error: 'Unauthorized' }, 401);
        return;
      }

      const userId = authService.getUserIdFromToken(token);
      if (!userId) {
        sendJSON(res, { error: 'Invalid token' }, 401);
        return;
      }

      const files = storage.getUserFiles(userId);
      sendJSON(res, { files });
      return;
    }

    // API: Получение общей статистики
    if (url.pathname === '/api/stats' && method === 'GET') {
      const token = getAuthToken(req);
      if (!token || !authService.verifyToken(token)) {
        sendJSON(res, { error: 'Unauthorized' }, 401);
        return;
      }

      const stats = storage.getStatistics();
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
      '.json': 'application/json; charset=utf-8',
    };

    sendFile(res, filePath, contentTypeMap[ext] || 'text/plain');

  } catch (error) {
    console.error('Server error:', error);
    sendJSON(res, { error: 'Internal server error' }, 500);
  }
});

// Запуск очистки устаревших файлов каждые 24 часа
setInterval(() => {
  const deletedCount = storage.cleanupOldFiles();
  if (deletedCount > 0) {
    console.log(`Cleaned up ${deletedCount} old files`);
  }
}, 24 * 60 * 60 * 1000);

// Запуск сервера
server.listen(PORT, () => {
  console.log(`File sharing service running on http://localhost:${PORT}`);
  console.log(`Upload directory: ${UPLOAD_DIR}`);
  console.log(`Public directory: ${PUBLIC_DIR}`);
});



import * as http from 'http';

interface ParsedFile {
  filename: string;
  data: Buffer;
  mimeType: string;
}

/**
 * Парсинг multipart/form-data
 */
export async function parseMultipartData(
  req: http.IncomingMessage,
  contentType: string
): Promise<ParsedFile[]> {
  return new Promise((resolve, reject) => {
    const boundary = getBoundary(contentType);
    if (!boundary) {
      reject(new Error('No boundary found'));
      return;
    }

    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const files = parseMultipartBuffer(buffer, boundary);
        resolve(files);
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

/**
 * Извлечение boundary из Content-Type
 */
function getBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=(.+)$/);
  return match ? match[1] : null;
}

/**
 * Парсинг буфера multipart
 */
function parseMultipartBuffer(buffer: Buffer, boundary: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

  let position = 0;

  while (position < buffer.length) {
    // Ищем начало части
    const startIndex = buffer.indexOf(boundaryBuffer, position);
    if (startIndex === -1) break;

    position = startIndex + boundaryBuffer.length;

    // Проверяем, не конец ли это
    if (buffer.indexOf(endBoundaryBuffer, position - boundaryBuffer.length) === position - boundaryBuffer.length) {
      break;
    }

    // Пропускаем CRLF после boundary
    if (buffer[position] === 13 && buffer[position + 1] === 10) {
      position += 2;
    }

    // Читаем заголовки
    const headersEndIndex = buffer.indexOf(Buffer.from('\r\n\r\n'), position);
    if (headersEndIndex === -1) break;

    const headersBuffer = buffer.slice(position, headersEndIndex);
    const headers = headersBuffer.toString('utf-8');
    position = headersEndIndex + 4;

    // Парсим заголовки
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type: ([^\r\n]+)/);

    if (!filenameMatch) continue;

    const filename = filenameMatch[1];
    const mimeType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';

    // Ищем конец данных (следующий boundary)
    const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, position);
    if (nextBoundaryIndex === -1) break;

    // Извлекаем данные файла (убираем CRLF перед boundary)
    let dataEndIndex = nextBoundaryIndex;
    if (buffer[dataEndIndex - 2] === 13 && buffer[dataEndIndex - 1] === 10) {
      dataEndIndex -= 2;
    }

    const data = buffer.slice(position, dataEndIndex);
    files.push({ filename, data, mimeType });

    position = nextBoundaryIndex;
  }

  return files;
}



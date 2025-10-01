import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

interface Session {
  token: string;
  userId: string;
  createdAt: number;
}

interface AuthData {
  users: { [username: string]: User };
  sessions: { [token: string]: Session };
}

/**
 * Сервис авторизации
 */
export class AuthService {
  private dataFile: string;
  private data: AuthData;

  constructor() {
    this.dataFile = path.join(process.cwd(), 'auth.json');
    this.data = this.loadData();
  }

  /**
   * Загрузка данных авторизации
   */
  private loadData(): AuthData {
    if (fs.existsSync(this.dataFile)) {
      try {
        const content = fs.readFileSync(this.dataFile, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Error loading auth data:', error);
      }
    }
    return { users: {}, sessions: {} };
  }

  /**
   * Сохранение данных авторизации
   */
  private saveData(): void {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving auth data:', error);
    }
  }

  /**
   * Хэширование пароля
   */
  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Генерация токена
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Регистрация пользователя
   */
  register(username: string, password: string): { success: boolean; message?: string } {
    if (this.data.users[username]) {
      return { success: false, message: 'User already exists' };
    }

    const user: User = {
      id: crypto.randomBytes(16).toString('hex'),
      username,
      passwordHash: this.hashPassword(password),
      createdAt: Date.now(),
    };

    this.data.users[username] = user;
    this.saveData();

    return { success: true };
  }

  /**
   * Вход пользователя
   */
  login(username: string, password: string): { success: boolean; token?: string; message?: string } {
    const user = this.data.users[username];
    
    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }

    const passwordHash = this.hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      return { success: false, message: 'Invalid credentials' };
    }

    const token = this.generateToken();
    const session: Session = {
      token,
      userId: user.id,
      createdAt: Date.now(),
    };

    this.data.sessions[token] = session;
    this.saveData();

    return { success: true, token };
  }

  /**
   * Проверка токена
   */
  verifyToken(token: string): boolean {
    return !!this.data.sessions[token];
  }

  /**
   * Получение ID пользователя по токену
   */
  getUserIdFromToken(token: string): string | null {
    const session = this.data.sessions[token];
    return session ? session.userId : null;
  }
}



import * as https from 'https';
import { CacheService } from './cache.js';

interface Coordinates {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
}

interface WeatherData {
  city: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  hourly: {
    time: string[];
    temperature: number[];
  };
  cached: boolean;
  cacheKey: string;
}

export class WeatherService {
  private cache: CacheService;

  constructor(cache: CacheService) {
    this.cache = cache;
  }

  private async httpGet(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error('Failed to parse JSON response'));
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Получение координат города
   */
  private async getCoordinates(city: string): Promise<Coordinates> {
    const encodedCity = encodeURIComponent(city);
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodedCity}&count=1&language=en&format=json`;

    const data = await this.httpGet(url);

    if (!data.results || data.results.length === 0) {
      throw new Error(`City "${city}" not found`);
    }

    const result = data.results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name,
      country: result.country || '',
    };
  }

  /**
   * Получение прогноза погоды
   */
  private async getWeatherForecast(latitude: number, longitude: number): Promise<any> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m&forecast_days=1`;
    
    const data = await this.httpGet(url);

    if (!data.hourly || !data.hourly.time || !data.hourly.temperature_2m) {
      throw new Error('Invalid weather data format');
    }

    return {
      time: data.hourly.time,
      temperature: data.hourly.temperature_2m,
    };
  }

  /**
   * Получение погоды для города с кэшированием
   */
  async getWeatherForCity(city: string): Promise<WeatherData> {
    const cacheKey = `weather:${city.toLowerCase()}`;

    // Проверяем кэш
    const cachedData = this.cache.get<WeatherData>(cacheKey);
    if (cachedData) {
      console.log(`Cache HIT for ${city}`);
      return {
        ...cachedData,
        cached: true,
      };
    }

    console.log(`Cache MISS for ${city}, fetching from API...`);

    // Получаем координаты города
    const coordinates = await this.getCoordinates(city);

    // Получаем прогноз погоды
    const forecast = await this.getWeatherForecast(
      coordinates.latitude,
      coordinates.longitude
    );

    // Формируем ответ
    const weatherData: WeatherData = {
      city: coordinates.name,
      country: coordinates.country,
      coordinates: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
      hourly: {
        time: forecast.time,
        temperature: forecast.temperature,
      },
      cached: false,
      cacheKey,
    };

    // Сохраняем в кэш
    this.cache.set(cacheKey, weatherData);

    return weatherData;
  }
}



import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface PythonTrackingResponse {
  status: string;
  order_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  message?: string;
}

@Injectable()
export class LocationTrackerService {
  private readonly logger = new Logger(LocationTrackerService.name);
  private pythonServiceUrl: string;
  private serviceToken: string;
  private axiosInstance: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.pythonServiceUrl =
      this.configService.get<string>('PYTHON_LOCATION_TRACKER_URL') ||
      'http://localhost:8080';
    this.serviceToken =
      this.configService.get<string>('PYTHON_SERVICE_TOKEN') || '';

    this.axiosInstance = axios.create({
      baseURL: this.pythonServiceUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Track order location from Python service
   */
  async trackOrder(
    orderId: string,
    customerToken?: string,
  ): Promise<PythonTrackingResponse | null> {
    try {
      const token = this.serviceToken || customerToken;

      if (!token) {
        this.logger.warn(
          'No authentication token available for Python service. Cannot track order.',
        );
        return null;
      }

      const response = await this.axiosInstance.get<PythonTrackingResponse>(
        `/api/v1/location/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Failed to track order in Python service: ${error.message}`,
          error.response?.data,
        );
        if (error.response?.status === 404) {
          return null; // Silent failure for missing tracking data
        }
      }
      this.logger.error(
        'Unexpected error tracking order in Python service',
        error,
      );
      return null;
    }
  }
}

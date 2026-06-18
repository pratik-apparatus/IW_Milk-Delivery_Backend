import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { DeliveryPartnerLocation } from '../entities/delivery-partner-location.entity';
import { Order } from '../entities/order.entity';
import { LocationResponseDto, RouteDataDto } from '../dto/location.dto';
import axios from 'axios';
import { TenantContextService } from '../common/services/tenant-context.service';
import { TenantRepositoryService } from '../common/database/tenant-repository.service';
import { tenantWhere } from '../common/utils/tenant-scope.util';

export interface GoogleMapsDirectionsResponse {
    routes: Array<{
        legs: Array<{
            distance: { value: number };
            duration: { value: number };
        }>;
        overview_polyline: { points: string };
    }>;
    status: string;
}

@Injectable()
export class LocationService {
    private readonly logger = new Logger(LocationService.name);
    private readonly GOOGLE_MAPS_API_URL = 'https://maps.googleapis.com/maps/api';
    private readonly googleMapsApiKey: string;

    constructor(
        private readonly tenantRepos: TenantRepositoryService,
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
        private readonly tenantContext: TenantContextService,
    ) {
        this.googleMapsApiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY') || '';

        if (!this.googleMapsApiKey) {
            this.logger.warn('⚠️  GOOGLE_MAPS_API_KEY is not configured!');
        }
    }

    private validateIndiaCoordinates(latitude: number, longitude: number): void {
        const INDIA_LAT_MIN = 8;
        const INDIA_LAT_MAX = 35;
        const INDIA_LNG_MIN = 68;
        const INDIA_LNG_MAX = 97;

        if (latitude < INDIA_LAT_MIN || latitude > INDIA_LAT_MAX) {
            throw new BadRequestException(
                `Latitude ${latitude} is outside India (valid range: ${INDIA_LAT_MIN}°N to ${INDIA_LAT_MAX}°N)`
            );
        }
        if (longitude < INDIA_LNG_MIN || longitude > INDIA_LNG_MAX) {
            throw new BadRequestException(
                `Longitude ${longitude} is outside India (valid range: ${INDIA_LNG_MIN}°E to ${INDIA_LNG_MAX}°E)`
            );
        }
    }

    async updateDeliveryPartnerLocation(
        orderId: string,
        deliveryPartnerId: string,
        latitude: number,
        longitude: number,
    ): Promise<LocationResponseDto> {
        try {
            if (latitude < -90 || latitude > 90) {
                throw new BadRequestException('Latitude must be between -90 and 90');
            }
            if (longitude < -180 || longitude > 180) {
                throw new BadRequestException('Longitude must be between -180 and 180');
            }

            this.validateIndiaCoordinates(latitude, longitude);

            const tenantId = this.tenantContext.requireTenantId();
            const dedicated = this.tenantContext.usesDedicatedDatabase();
            const orderRepo = await this.tenantRepos.getRepository(Order);
            const locationRepo = await this.tenantRepos.getRepository(DeliveryPartnerLocation);
            const order = await orderRepo.findOne({
                where: tenantWhere(tenantId, { id: orderId }, dedicated),
            });

            if (!order) {
                throw new NotFoundException('Order not found');
            }

            if (order.deliveryPartnerId !== deliveryPartnerId) {
                throw new BadRequestException(
                    'This order is not assigned to you. Cannot update location for this order.'
                );
            }

            const location = locationRepo.create({
                orderId,
                deliveryPartnerId,
                latitude,
                longitude,
                tenantId: dedicated ? null : (order.tenantId ?? tenantId),
            });

            const saved = await locationRepo.save(location);

            await this.cleanupOldLocations(orderId);

            this.logger.log(
                `Location updated for order ${orderId}: (${latitude}, ${longitude})`
            );

            return {
                status: 'success',
                timestamp: saved.createdAt.toISOString(),
            };
        } catch (error) {
            this.logger.error('Error saving location:', error);

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            return {
                status: 'error',
                timestamp: new Date().toISOString(),
                message: 'Failed to save location',
                reason: error?.message || 'Unknown error',
            };
        }
    }

    private async cleanupOldLocations(orderId: string): Promise<void> {
        try {
            const KEEP_COUNT = 100;
            const locationRepo = await this.tenantRepos.getRepository(DeliveryPartnerLocation);

            const allLocations = await locationRepo.find({
                where: { orderId },
                order: { createdAt: 'DESC' },
            });

            if (allLocations.length > KEEP_COUNT) {
                const toDelete = allLocations.slice(KEEP_COUNT);
                const idsToDelete = toDelete.map(loc => loc.id);

                await locationRepo
                    .createQueryBuilder()
                    .delete()
                    .where('id IN (:...ids)', { ids: idsToDelete })
                    .execute();

                this.logger.debug(
                    `Cleaned up ${toDelete.length} old location records for order ${orderId}`
                );
            }
        } catch (error) {
            this.logger.error('Error cleaning up old locations:', error);
        }
    }

    async getLatestLocation(
        orderId: string,
    ): Promise<{ latitude: number; longitude: number; timestamp: Date; isStale: boolean } | null> {
        try {
            const tenantId = this.tenantContext.getTenantId();
            const dedicated = this.tenantContext.usesDedicatedDatabase();
            const locationRepo = await this.tenantRepos.getRepository(DeliveryPartnerLocation);
            const location = await locationRepo.findOne({
                where: tenantId ? tenantWhere(tenantId, { orderId }, dedicated) : { orderId },
                order: { createdAt: 'DESC' },
            });

            if (!location) {
                return null;
            }

            const timestampMs = location.createdAt.getTime();
            const nowMs = Date.now();
            const ageMs = nowMs - timestampMs;
            const isStale = ageMs > 300000;

            return {
                latitude: parseFloat(location.latitude.toString()),
                longitude: parseFloat(location.longitude.toString()),
                timestamp: location.createdAt,
                isStale,
            };
        } catch (error) {
            this.logger.error('Error fetching location:', error);
            return null;
        }
    }

    async getOptimizedRoute(
        orderId: string,
    ): Promise<RouteDataDto> {
        try {
            const latestLocation = await this.getLatestLocation(orderId);
            if (!latestLocation) {
                return {
                    status: 'error',
                    error: 'No location data available for delivery partner',
                };
            }

            const tenantId = this.tenantContext.getTenantId();
            const dedicated = this.tenantContext.usesDedicatedDatabase();
            const orderRepo = await this.tenantRepos.getRepository(Order);
            const order = await orderRepo.findOne({
                where: tenantId ? tenantWhere(tenantId, { id: orderId }, dedicated) : { id: orderId },
            });
            if (!order) {
                return {
                    status: 'error',
                    error: 'Order not found',
                };
            }

            if (!order.deliveryLatitude || !order.deliveryLongitude) {
                return {
                    status: 'error',
                    error: 'Delivery address not set',
                };
            }

            const response = await this.callGoogleMapsDirections(
                {
                    lat: latestLocation.latitude,
                    lng: latestLocation.longitude,
                },
                {
                    lat: parseFloat(order.deliveryLatitude.toString()),
                    lng: parseFloat(order.deliveryLongitude.toString()),
                }
            );

            if (response.status !== 'OK' || !response.routes.length) {
                return {
                    status: 'error',
                    error: response.error_message || 'No route found',
                };
            }

            const route = response.routes[0];
            const leg = route.legs[0];

            const coordinates = this.decodePolyline(route.overview_polyline.points);

            return {
                status: 'success',
                distance: leg.distance.value,
                duration: leg.duration.value,
                polyline: route.overview_polyline.points,
                coordinates,
            };
        } catch (error) {
            this.logger.error('Error getting route:', error);
            return {
                status: 'error',
                error: 'Failed to fetch route',
            };
        }
    }

    async getDistanceAndETA(
        orderId: string,
    ): Promise<{ distance_remaining: number; eta_seconds: number } | null> {
        try {
            const latestLocation = await this.getLatestLocation(orderId);
            if (!latestLocation) {
                return null;
            }

            const tenantId = this.tenantContext.getTenantId();
            const dedicated = this.tenantContext.usesDedicatedDatabase();
            const orderRepo = await this.tenantRepos.getRepository(Order);
            const order = await orderRepo.findOne({
                where: tenantId ? tenantWhere(tenantId, { id: orderId }, dedicated) : { id: orderId },
            });
            if (!order || !order.deliveryLatitude || !order.deliveryLongitude) {
                return null;
            }

            const response = await this.callGoogleMapsDistanceMatrix(
                {
                    lat: latestLocation.latitude,
                    lng: latestLocation.longitude,
                },
                {
                    lat: parseFloat(order.deliveryLatitude.toString()),
                    lng: parseFloat(order.deliveryLongitude.toString()),
                }
            );

            if (response.status !== 'OK' || !response.rows.length) {
                return null;
            }

            const element = response.rows[0].elements[0];
            if (element.status !== 'OK') {
                return null;
            }

            return {
                distance_remaining: element.distance.value,
                eta_seconds: element.duration.value,
            };
        } catch (error) {
            this.logger.error('Error getting distance and ETA:', error);
            return null;
        }
    }

    private async callGoogleMapsDirections(
        origin: { lat: number; lng: number },
        destination: { lat: number; lng: number },
    ): Promise<any> {
        try {
            const url = `${this.GOOGLE_MAPS_API_URL}/directions/json`;
            const params = {
                origin: `${origin.lat},${origin.lng}`,
                destination: `${destination.lat},${destination.lng}`,
                key: this.googleMapsApiKey,
                mode: 'driving',
            };

            const response = await axios.get(url, { params, timeout: 5000 });
            return response.data;
        } catch (error) {
            this.logger.error('Google Maps Directions API error:', error);
            throw error;
        }
    }

    private async callGoogleMapsDistanceMatrix(
        origin: { lat: number; lng: number },
        destination: { lat: number; lng: number },
    ): Promise<any> {
        try {
            const url = `${this.GOOGLE_MAPS_API_URL}/distancematrix/json`;
            const params = {
                origins: `${origin.lat},${origin.lng}`,
                destinations: `${destination.lat},${destination.lng}`,
                key: this.googleMapsApiKey,
                mode: 'driving',
            };

            const response = await axios.get(url, { params, timeout: 5000 });
            return response.data;
        } catch (error) {
            this.logger.error('Google Maps Distance Matrix API error:', error);
            throw error;
        }
    }

    private decodePolyline(polyline: string): Array<{ lat: number; lng: number }> {
        const points: Array<{ lat: number; lng: number }> = [];
        let index = 0;
        let lat = 0;
        let lng = 0;

        while (index < polyline.length) {
            let result = 0;
            let shift = 0;
            let b;

            do {
                b = polyline.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
            lat += dlat;

            result = 0;
            shift = 0;

            do {
                b = polyline.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
            lng += dlng;

            points.push({
                lat: lat / 1e5,
                lng: lng / 1e5,
            });
        }

        return points;
    }
}

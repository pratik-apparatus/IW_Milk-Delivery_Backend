import {
    Injectable,
    NotFoundException,
    InternalServerErrorException
} from '@nestjs/common';
import { Order } from '../../entities/order.entity';
import { DeliveryPartner } from '../../entities/delivery-partner.entity';
import { LocationService } from '../../delivery-partner/location.service';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import { tenantWhere } from '../../common/utils/tenant-scope.util';

@Injectable()
export class TrackingService {
    constructor(
        private readonly tenantRepos: TenantRepositoryService,
        private readonly locationService: LocationService,
        private readonly tenantContext: TenantContextService,
    ) { }

    async trackOrder(customerId: string, orderId: string) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const order = await orderRepo.findOne({
            where: tenantWhere(tenantId, { id: orderId, customerId }, dedicated),
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        let latestLocation: { latitude: number; longitude: number; timestamp: string } | null = null;
        let deliveryPartnerInfo: { id: string; username: string; phone: string } | null = null;
        let eta: string | null = null;

        try {
            const location = await this.locationService.getLatestLocation(order.id);
            if (location) {
                latestLocation = {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    timestamp: location.timestamp.toISOString(),
                };

                const distanceData = await this.locationService.getDistanceAndETA(order.id);
                if (distanceData) {
                    const minutes = Math.ceil(distanceData.eta_seconds / 60);
                    eta = `${minutes} mins`;
                }
            }
        } catch (error) {
            console.error('Failed to fetch location:', (error as any).message);
        }

        return {
            orderId: order.id,
            status: order.status,
            deliveryLatitude: order.deliveryLatitude,
            deliveryLongitude: order.deliveryLongitude,
            estimatedDeliveryTime: eta || order.estimatedDeliveryTime,
            latestLocation,
            deliveryPartner: deliveryPartnerInfo,
            createdAt: order.createdAt,
        };
    }

    async getDeliveryPartner(customerId: string, orderId: string) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const deliveryPartnerRepo = await this.tenantRepos.getRepository(DeliveryPartner);
        const order = await orderRepo.findOne({
            where: tenantWhere(tenantId, { id: orderId, customerId }, dedicated),
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (!order.deliveryPartnerId) {
            return {
                message: 'Delivery partner not assigned yet',
            };
        }

        const deliveryPartner = await deliveryPartnerRepo.findOne({
            where: tenantWhere(tenantId, { id: order.deliveryPartnerId }, dedicated),
        });

        if (!deliveryPartner) {
            throw new NotFoundException('Delivery partner not found');
        }

        return {
            deliveryPartnerId: deliveryPartner.id,
            name: deliveryPartner.name || 'N/A',
            phone: deliveryPartner.phoneNumber || 'N/A',
        };
    }

}

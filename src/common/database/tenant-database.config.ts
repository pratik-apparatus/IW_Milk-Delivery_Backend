import { Category } from '../../entities/categories.entity';
import { Product } from '../../entities/product.entity';
import { Customer } from '../../entities/customer.entity';
import { DeliveryPartner } from '../../entities/delivery-partner.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Subscription } from '../../entities/subscription.entity';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { Cart } from '../../entities/cart.entity';
import { Payment } from '../../entities/payment.entity';
import { SubscriptionDeliveryLog } from '../../entities/subscription-delivery-log.entity';
import { DeliveryPartnerLocation } from '../../entities/delivery-partner-location.entity';
import { Banner } from '../../entities/banner.entity';
import { AppConfig } from '../../entities/app-config.entity';
import { AdminAuditLog } from '../../entities/admin-audit-log.entity';

/** Business tables that live in a tenant's own database when dbName is configured. */
export const TENANT_BUSINESS_ENTITIES = [
  Category,
  Product,
  Customer,
  DeliveryPartner,
  Wallet,
  WalletTransaction,
  Subscription,
  Order,
  OrderItem,
  Cart,
  Payment,
  SubscriptionDeliveryLog,
  DeliveryPartnerLocation,
  Banner,
  AppConfig,
  AdminAuditLog,
];

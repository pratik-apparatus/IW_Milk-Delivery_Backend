import { Module } from "@nestjs/common";
import { subscriptionController } from "./subscription.controller";
import { subscriptionService } from "./subscription.service";
import { SubscriptionModule } from "../../customer/subscription/subscription.module";

@Module({
    imports: [SubscriptionModule],
    controllers: [subscriptionController],
    providers: [subscriptionService]
})
export class subscriptionModule { }

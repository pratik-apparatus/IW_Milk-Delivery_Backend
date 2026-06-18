import { ProductController } from "./product.controller";
import { ProductService } from "./product.sevices";
import { Module } from "@nestjs/common";

@Module({
    controllers: [ProductController],
    providers: [ProductService],
    exports: [ProductService]
})
export class ProductModule { }

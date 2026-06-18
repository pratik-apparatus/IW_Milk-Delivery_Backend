import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateLocationDto {
    @ApiProperty({ example: 'order-uuid-123' })
    @IsString()
    orderId: string;

    @ApiProperty({ example: 18.5235 })
    @IsNumber()
    latitude: number;

    @ApiProperty({ example: 73.8556 })
    @IsNumber()
    longitude: number;
}

export class LocationResponseDto {
    @ApiProperty()
    status: 'success' | 'error';

    @ApiProperty({ example: '2024-02-03T10:30:00.000Z' })
    timestamp: string;

    @ApiProperty({ required: false })
    message?: string;

    @ApiProperty({ required: false, description: 'Reason for error (if status is error)' })
    reason?: string;
}

export class LiveLocationResponseDto {
    @ApiProperty()
    status: 'active' | 'waiting' | 'stale';

    @ApiProperty({ required: false })
    orderId?: string;

    @ApiProperty({ required: false, description: 'Coordinates object with lat/lng' })
    coordinates?: { lat: number; lng: number };

    @ApiProperty({ required: false, description: 'Distance remaining in meters' })
    distance_remaining?: number;

    @ApiProperty({ required: false, description: 'ETA in seconds' })
    eta_seconds?: number;

    @ApiProperty({ required: false })
    timestamp?: string;

    @ApiProperty({ required: false })
    message?: string;

    @ApiProperty({ required: false, description: 'Whether location data is older than 5 minutes' })
    isStale?: boolean;
}

export class RouteDataDto {
    @ApiProperty()
    status: 'success' | 'error';

    @ApiProperty({ required: false })
    polyline?: string;

    @ApiProperty({ required: false, description: 'Distance in meters' })
    distance?: number;

    @ApiProperty({ required: false, description: 'Duration in seconds' })
    duration?: number;

    @ApiProperty({ required: false, type: 'array', items: { type: 'object' } })
    coordinates?: Array<{ lat: number; lng: number }>;

    @ApiProperty({ required: false })
    error?: string;
}

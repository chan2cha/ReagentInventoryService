# ERD

This document summarizes the current database model defined in `prisma/schema.prisma`.

## User-Facing Terminology

The Prisma schema keeps technical names for consistency, while the UI now uses friendlier operational terms.

| Schema Term | User-Facing Term |
|---|---|
| `Allergen` | 시약 |
| `ReagentLot` | 입고분 / 제조번호별 재고 |
| `lotNo` | 제조번호 |
| `expirationDate` | 유통기한 |
| `currentQuantity` | 현재 수량 |
| `initialQuantity` | 입고 수량 |
| `StockMovement` | 입출고 이력 |
| `REVERSE` | 되돌림 기록 |
| FEFO | 유통기한 빠른 순 |

## Diagram

```mermaid
erDiagram
  User {
    string id PK
    string loginId UK
    string email
    string name
    string passwordHash
    UserRole role
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }

  Allergen {
    string id PK
    string code UK
    string name
    string category
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }

  ReagentLot {
    string id PK
    string allergenId FK
    string lotNo
    datetime expirationDate
    datetime receivedDate
    int initialQuantity
    int currentQuantity
    string memo
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }

  Client {
    string id PK
    string name
    string managerName
    string phone
    string address
    string memo
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }

  Order {
    string id PK
    string orderNo UK
    string clientId FK
    OrderStatus status
    string memo
    string createdBy FK
    datetime createdAt
    datetime updatedAt
  }

  OrderItem {
    string id PK
    string orderId FK
    string allergenId FK
    int quantity
  }

  Shipment {
    string id PK
    string orderId FK
    ShipmentStatus status
    string shippedBy FK
    datetime shippedAt
    string memo
  }

  ShipmentItem {
    string id PK
    string shipmentId FK
    string reagentLotId FK
    string allergenId FK
    int quantity
  }

  StockMovement {
    string id PK
    string reagentLotId FK
    StockMovementType type
    int quantity
    string reason
    string refType
    string refId
    string createdBy FK
    datetime createdAt
  }

  User ||--o{ Order : creates
  User ||--o{ Shipment : ships
  User ||--o{ StockMovement : records

  Allergen ||--o{ ReagentLot : has
  Allergen ||--o{ OrderItem : ordered_as

  Client ||--o{ Order : places

  Order ||--o{ OrderItem : contains
  Order ||--o{ Shipment : ships_as

  Shipment ||--o{ ShipmentItem : contains
  ReagentLot ||--o{ ShipmentItem : allocated_from
  ReagentLot ||--o{ StockMovement : tracked_by
```

## Tables

| Table | Purpose |
|---|---|
| `User` | System user and role information. |
| `Allergen` | Master data for allergen/reagent item codes. |
| `ReagentLot` | LOT-level inventory with expiration and quantity. |
| `Client` | Customer or hospital information. |
| `Order` | Customer order header. |
| `OrderItem` | Allergen and quantity requested in an order. |
| `Shipment` | Shipment header for an order. |
| `ShipmentItem` | Actual LOT allocations shipped. |
| `StockMovement` | Inventory movement audit log. |

## Core Rules

| Rule | Definition |
|---|---|
| Allergen code uniqueness | `Allergen.code` is unique. |
| User login ID uniqueness | `User.loginId` is unique. |
| Order number uniqueness | `Order.orderNo` is unique. |
| LOT uniqueness | `ReagentLot` is unique by `allergenId + lotNo + expirationDate`. |
| LOT inventory unit | Inventory is managed at the `ReagentLot` level, not only at the allergen level. |
| Shipment allocation | Actual outbound stock is recorded through `ShipmentItem.reagentLotId`. |
| Movement audit | Stock changes are tracked through `StockMovement`. |

## Enums

### UserRole

| Value | Meaning |
|---|---|
| `ADMIN` | Administrator |
| `ORDER_MANAGER` | Order manager |
| `SHIPMENT_MANAGER` | Shipment manager |
| `VIEWER` | Read-only user |

### OrderStatus

| Value | Meaning |
|---|---|
| `RECEIVED` | Order received |
| `READY_TO_SHIP` | Ready to ship |
| `SHIPPED` | Shipped |
| `CANCELLED` | Cancelled |

### ShipmentStatus

| Value | Meaning |
|---|---|
| `SHIPPED` | Shipped |
| `CANCELLED` | Cancelled |

### StockMovementType

| Value | Meaning |
|---|---|
| `IN` | Inbound stock |
| `OUT` | Outbound stock |
| `ADJUST` | Manual adjustment |
| `DISPOSE` | Disposal |
| `REVERSE` | Cancellation or reversal |

## Indexes

| Model | Index |
|---|---|
| `Allergen` | `name` |
| `ReagentLot` | `lotNo` |
| `ReagentLot` | `expirationDate` |
| `ReagentLot` | `currentQuantity` |
| `Order` | `status` |
| `Order` | `createdAt` |
| `Shipment` | `shippedAt` |
| `StockMovement` | `createdAt` |

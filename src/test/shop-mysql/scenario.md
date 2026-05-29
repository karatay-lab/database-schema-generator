# Scenario: E-Commerce Shop — "MySQL Shop Schema"

## Overview

A minimal e-commerce schema covering categories, products, customers, orders,
and order line items. Five tables with a straightforward FK chain.

Designed to exercise the MySQL provider path end-to-end. No intentional migration
errors — v1 → v2 should complete cleanly, exercising the full pipeline without
needing the Fix Modal.

**Project name:** `MySQL Shop Schema`
**Provider:** MySQL
**Version:** `1.0111`

---

## Tables

| Model | PK | Purpose |
|---|---|---|
| `Category` | `id` Int | Product categories |
| `Product` | `id` Int | Items for sale |
| `Customer` | `id` Int | Buyers |
| `Order` | `id` Int | Purchase orders |
| `OrderItem` | `id` Int | Line items linking an order to a product |

---

## Fields

### Category
| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Int | no | — |
| name | String | no | — |
| slug | String | no | — |
| createdAt | DateTime | no | `now()` |

### Product
| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | Int | no | — | |
| name | String | no | — | |
| description | String | yes | — | |
| price | Int | no | — | stored in cents |
| stock | Int | no | `0` | |
| createdAt | DateTime | no | `now()` | |
| updatedAt | DateTime | no | — | @updatedAt |

### Customer
| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Int | no | — |
| email | String | no | — |
| name | String | no | — |
| phone | String | yes | — |
| createdAt | DateTime | no | `now()` |

### Order
| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Int | no | — |
| status | String | no | `"PENDING"` |
| total | Int | no | `0` |
| createdAt | DateTime | no | `now()` |
| updatedAt | DateTime | no | — |

### OrderItem
| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Int | no | — |
| quantity | Int | no | `1` |
| unitPrice | Int | no | — |
| createdAt | DateTime | no | `now()` |

---

## Relations

| Source | Relation field | Target | Back-ref | Auto FK | onDelete |
|---|---|---|---|---|---|
| `Product` | `category` | `Category` | `products` | `Product.categoryId` | Cascade |
| `Order` | `customer` | `Customer` | `orders` | `Order.customerId` | Cascade |
| `OrderItem` | `order` | `Order` | `items` | `OrderItem.orderId` | Cascade |
| `OrderItem` | `product` | `Product` | `orderItems` | `OrderItem.productId` | Cascade |

---

## Restrictions

| Model | Type | Fields | Purpose |
|---|---|---|---|
| `Category` | UNIQUE | `[slug]` | Unique URL slugs |
| `Customer` | UNIQUE | `[email]` | Login uniqueness |
| `Product` | INDEX | `[categoryId]` | Filter by category |
| `Order` | INDEX | `[status]` | Filter by order state |
| `OrderItem` | UNIQUE | `[orderId, productId]` | One line per product per order |

---

## V2 — Schema Evolution

### New table: Review
Fields: `id`(Int), `rating`(Int), `comment`(String?), `createdAt`(DateTime now())

### V2 Field Changes

| Model | Change | Notes |
|---|---|---|
| `Product` | + `sku` String unique | Stock-keeping unit |
| `Product` | + `discount` Int? | Percentage discount 0–100 |
| `Order` | `status` String → OrderStatus enum | Clean cast — all values match |

### V2 Enums

| Enum | Values |
|---|---|
| `OrderStatus` | PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED |

### V2 New Relations

| Source | Field | Target | Back-ref | FK | onDelete |
|---|---|---|---|---|---|
| `Review` | `customer` | `Customer` | `reviews` | `Review.customerId` | Cascade |
| `Review` | `product` | `Product` | `reviews` | `Review.productId` | Cascade |

### V2 New Restrictions

| Model | Type | Fields |
|---|---|---|
| `Review` | UNIQUE | `[customerId, productId]` |
| `Product` | UNIQUE | `[sku]` |

---

## Expected Migration Behaviour (v1 → v2)

Clean run — no Stage 2 Zod errors expected.

The `Order.status` String → `OrderStatus` enum binding will emit an upgrade
warning ("String values will be cast to enum"), but all seeded values
(`"PENDING"`, `"CONFIRMED"`, `"SHIPPED"`, `"DELIVERED"`) are valid enum members.

---

## Running the scenario

```bash
pnpm seed:workflows third-workflows
pnpm seed:db third-workflows mysql://user:pass@host:3306/db
```

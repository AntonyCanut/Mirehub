---
description: "NestJS WebSocket gateway patterns"
paths:
  - "**/*.gateway.ts"
  - "**/gateways/**/*.ts"
  - "**/websocket/**/*.ts"
---

# NestJS WebSockets

## Gateway Setup

- DO use `@WebSocketGateway({ cors, namespace })` — configure CORS from env, namespace per domain
- DO implement `OnGatewayConnection` + `OnGatewayDisconnect` for lifecycle management
- DO inject `@WebSocketServer() server: Server` for broadcasting

## Authentication

- DO verify JWT in `handleConnection()` — extract from `handshake.headers.authorization` or `handshake.query.token`
- DO store user payload on `client.data.user` after verification
- DO join user-specific rooms (`client.join(\`user:\${userId}\`)`) for targeted messaging
- DO disconnect unauthenticated clients immediately with an error event

## Rooms & Broadcasting

- `client.join(\`room:\${id}\`)` / `client.leave(\`room:\${id}\`)` for room management
- `this.server.to(\`room:\${id}\`).emit(event, data)` — broadcast to room
- `client.to(\`room:\${id}\`).emit(event, data)` — broadcast to room except sender
- `this.server.to(\`user:\${id}\`).emit(event, data)` — send to specific user

## Validation

- DO apply `@UsePipes(new ValidationPipe({ transform: true }))` at gateway or method level
- DO use DTOs with class-validator for all `@MessageBody()` parameters
- DO NOT trust client input — validate everything, same as HTTP endpoints

## Guards & Filters

- DO use `WsAuthGuard` checking `client.data.user` — throw `WsException` on failure
- DO use `@UseFilters(AllWsExceptionsFilter)` extending `BaseWsExceptionFilter`
- DO emit errors to the client via `client.emit('exception', { status, message })` — WS has no HTTP status codes

## Scaling

- DO use `@socket.io/redis-adapter` for multi-instance deployments — events are broadcast across all nodes
- DO NOT store connection state in gateway memory without Redis — it won't survive horizontal scaling

## Anti-patterns

- DO NOT forget `handleDisconnect()` cleanup — leaks memory for stored connections/rooms
- DO NOT perform heavy synchronous work in `@SubscribeMessage` handlers — offload to a queue
- DO NOT use `any` for `@MessageBody()` — always type with a validated DTO
- DO NOT mix HTTP and WS concerns in the same class — keep gateways separate from controllers

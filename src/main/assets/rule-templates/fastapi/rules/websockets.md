---
description: "FastAPI WebSocket patterns"
paths:
  - "**/*.py"
---

# FastAPI WebSockets

## Connection Lifecycle

1. Client connects -- handler calls `await websocket.accept()`
2. Message loop -- `receive_text()` / `receive_json()` in a `while True` loop
3. Disconnect -- catch `WebSocketDisconnect` to clean up

Always wrap the message loop in `try/except WebSocketDisconnect`.

## Authentication

- Pass token as query parameter: `ws://host/ws?token=<jwt>` -- WebSocket headers are unreliable across clients
- Validate token BEFORE `websocket.accept()` -- reject with `websocket.close(code=1008)` on failure
- NEVER accept then validate -- exposes the socket to unauthenticated messages

## Connection Management

| Pattern | Use case |
|---------|----------|
| `ConnectionManager` (list) | Broadcast to all connected clients |
| `RoomManager` (dict of lists) | Room/channel-based messaging |
| Redis Pub/Sub | Multi-process or multi-server deployments |

- `ConnectionManager` must handle concurrent access -- use `asyncio.Lock` if modifying connection lists
- Remove disconnected clients immediately in the `except WebSocketDisconnect` block

## Message Protocol

- Use JSON messages with `type` + `payload` structure for all communication
- Validate incoming messages with Pydantic: `WSMessage(**await websocket.receive_json())`
- Send responses as `model_dump()` -- consistent serialization

## Heartbeat / Keep-Alive

- Send periodic pings via `asyncio.create_task` alongside the message loop
- Use 30s interval for ping -- close if no pong received within timeout
- Cancel heartbeat task on disconnect

## Scaling

- Single-process: in-memory `ConnectionManager` is fine
- Multi-process: use Redis Pub/Sub to relay messages between workers
- Use `asyncio.gather(receive_task, send_task)` for bidirectional Pub/Sub

## Anti-patterns

- NEVER accept WebSocket before auth validation -- exposes unauthenticated channel
- NEVER use bare `except:` in message loops -- always catch `WebSocketDisconnect` specifically
- NEVER store WebSocket references after disconnect -- causes `RuntimeError` on send
- NEVER block the event loop in message handlers -- offload heavy work to background tasks
- NEVER skip rate limiting on WebSocket messages -- clients can flood the server

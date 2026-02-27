---
description: "AdonisJS controller patterns"
paths:
  - "**/app/controllers/**/*.ts"
---

# AdonisJS Controllers

## Principles

- Controllers handle HTTP concerns ONLY: parse request, validate, delegate to service, return response

## Controller Types

| Type | When to use | Convention |
|------|------------|-----------|
| Resource controller | Standard CRUD (index, store, show, update, destroy) | `router.resource('users', UsersController).apiOnly()` |
| Single-action controller | One endpoint, one concern | `handle()` method only |
| Auth controller | Authentication flows | Group under `app/controllers/auth/` |

## Resource Controller Methods

| Method | HTTP | Purpose | Response |
|--------|------|---------|----------|
| `index` | GET /resources | List all | `return items` (implicit 200) |
| `store` | POST /resources | Create | `response.status(201).json(item)` |
| `show` | GET /resources/:id | Read one | `return item` (implicit 200) |
| `update` | PUT /resources/:id | Update | `return item` (implicit 200) |
| `destroy` | DELETE /resources/:id | Delete | `response.noContent()` |

## Routing

- Use `.only()` or `.except()` to limit resource routes

## Response Helpers

Use verified response methods: `response.send()`, `response.json()`, `response.status()`, `response.redirect()`, `response.noContent()`, `response.stream()`, `response.download()`, `response.abort()`

## Anti-patterns

- Do NOT access the database directly in controllers -- delegate to services or models
- Do NOT catch exceptions in controllers unless transforming the error shape -- let the exception handler do it
- Do NOT return responses without explicit status codes for non-200 responses — use `response.status(code).json(data)`

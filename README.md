# Content Management System (CMS) Backend

A robust backend API for a content management system, built with Node.js, Express, TypeScript, PostgreSQL, Prisma, Redis, and BullMQ.

## Features

- **Authentication**: JWT-based authentication with role-based access control (Author vs Public).
- **Content Management**: Create, read, update, delete posts.
- **Content Lifecycle**: Draft, Scheduled, Published statuses.
- **Versioning**: Automatic revision history for posts on update.
- **Scheduled Publishing**: Background worker to automatically publish scheduled posts.
- **Media Upload**: Upload images for posts.
- **Full-Text Search**: Public API to search published posts.
- **Caching**: Redis caching for public endpoints to improve performance.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma (with pg adapter)
- **Queue**: BullMQ (with Redis)
- **Cache**: Redis
- **Containerization**: Docker & Docker Compose

## Prerequisites

- Docker and Docker Compose installed.
- Node.js (for local development without Docker).

## Setup & Running

### Using Docker (Recommended)

1.  Clone the repository.
2.  Run the following command to start all services (API, Worker, Database, Redis):
    ```bash
    docker-compose up --build
    ```
    The API will be available at `http://localhost:3000`.

### Local Development

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start required services (Postgres, Redis) manually or via Docker.
3.  Configure `.env` file with your database and redis credentials.
4.  Run migrations:
    ```bash
    npx prisma migrate dev
    ```
5.  Start the development server:
    ```bash
    npm run dev
    ```
6.  Start the worker in a separate terminal:
    ```bash
    npm run worker
    ```

## API Documentation

### Public Endpoints

- `GET /api/posts/published`: List all published posts (supports `?search=query` & pagination).
- `GET /api/posts/published/:id`: Get a specific published post (cached).

### Author Endpoints (Requires Authentication)

- `POST /api/auth/register`: Register a new user.
- `POST /api/auth/login`: Login and get JWT token.
- `GET /api/auth/me`: Get current user info.
- `GET /api/posts`: List your own posts.
- `POST /api/posts`: Create a new post.
- `GET /api/posts/:id`: Get your own post.
- `PUT /api/posts/:id`: Update your post (creates revision).
- `DELETE /api/posts/:id`: Delete your post.
- `POST /api/posts/:id/publish`: Publish a draft.
- `POST /api/posts/:id/schedule`: Schedule a post (body: `{ "scheduledFor": "ISO-Date" }`).
- `GET /api/posts/:id/revisions`: Get revision history.
- `POST /api/posts/:id/revisions/:revisionId/restore`: Restore a revision.
- `POST /api/media/upload`: Upload an image (form-data: `image`).

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details on the system design.

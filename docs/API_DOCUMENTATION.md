# API Documentation

## Base URL

```
https://your-domain.com/api/v1
```

All endpoints are prefixed with `/api/v1`.

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Response Format

All API responses follow this standard format:

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "details": {}
}
```

## Rate Limiting

The API implements rate limiting on various endpoints to ensure fair usage:

- **Global Rate Limit**: Applied to all API endpoints
- **Authentication Endpoints**: Stricter limits on signup/login
- **Chat Operations**: Limited to prevent abuse
- **Message Operations**: Controlled to manage AI resource usage
- **Search Operations**: Limited to prevent excessive queries

When rate limit is exceeded, you'll receive a `429 Too Many Requests` response.

---

## Endpoints

### Health Check

#### GET /health

Check if the API is running.

**Authentication**: Not required

**Response**:

```json
{
  "success": true,
  "message": "Server is healthy",
  "data": {
    "status": "ok",
    "timestamp": "2024-12-07T10:30:00.000Z"
  }
}
```

---

## Authentication Endpoints

### POST /auth/signup

Register a new user account.

**Authentication**: Not required

**Rate Limit**: Strict (signup limiter)

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Validation**:

- `email`: Must be a valid email address
- `password`: Minimum 6 characters
- `name`: Optional

**Success Response** (201 Created):

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Note**: If user already exists, returns 200 with message "User already exists. Logged in successfully"

---

### POST /auth/login

Authenticate an existing user.

**Authentication**: Not required

**Rate Limit**: Strict (login limiter)

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Validation**:

- `email`: Must be a valid email address
- `password`: Required

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response** (401 Unauthorized):

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

### GET /auth/me

Get current authenticated user's profile.

**Authentication**: Required

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "User profile fetched",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

---

## Chat Endpoints

### POST /chat

Create a new chat session with an initial message.

**Authentication**: Required

**Rate Limit**: Chat creation limiter

**Request Body**:

```json
{
  "firstMessageContent": "Hello, I need help with..."
}
```

**Success Response** (201 Created):

```json
{
  "success": true,
  "message": "Chat created successfully",
  "data": {
    "chatId": "507f1f77bcf86cd799439012",
    "title": "Auto-generated title",
    "userMessage": {
      "id": "507f1f77bcf86cd799439013",
      "role": "user",
      "content": "Hello, I need help with...",
      "timestamp": "2024-12-07T10:30:00.000Z"
    },
    "assistantMessage": {
      "id": "507f1f77bcf86cd799439014",
      "role": "assistant",
      "content": "AI response here...",
      "timestamp": "2024-12-07T10:30:05.000Z"
    }
  }
}
```

---

### GET /chat

Get all chat sessions for the authenticated user.

**Authentication**: Required

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Chats fetched successfully",
  "data": [
    {
      "id": "507f1f77bcf86cd799439012",
      "title": "Chat about programming",
      "createdAt": "2024-12-07T10:30:00.000Z",
      "updatedAt": "2024-12-07T10:35:00.000Z"
    },
    {
      "id": "507f1f77bcf86cd799439015",
      "title": "Another conversation",
      "createdAt": "2024-12-06T14:20:00.000Z",
      "updatedAt": "2024-12-06T14:25:00.000Z"
    }
  ]
}
```

---

### GET /chat/:chatId

Get a specific chat session by ID.

**Authentication**: Required

**URL Parameters**:

- `chatId`: The unique identifier of the chat

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Chat fetched successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "title": "Chat about programming",
    "userId": "507f1f77bcf86cd799439011",
    "createdAt": "2024-12-07T10:30:00.000Z",
    "updatedAt": "2024-12-07T10:35:00.000Z"
  }
}
```

**Error Response** (404 Not Found):

```json
{
  "success": false,
  "message": "Chat not found"
}
```

---

### PATCH /chat/:chatId

Rename a chat session.

**Authentication**: Required

**Rate Limit**: Chat rename limiter

**URL Parameters**:

- `chatId`: The unique identifier of the chat

**Request Body**:

```json
{
  "title": "New chat title"
}
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Chat renamed successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "title": "New chat title",
    "updatedAt": "2024-12-07T10:40:00.000Z"
  }
}
```

---

### DELETE /chat/:chatId

Delete a chat session and all associated messages.

**Authentication**: Required

**Rate Limit**: Chat delete limiter

**URL Parameters**:

- `chatId`: The unique identifier of the chat

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Chat deleted successfully"
}
```

---

## Message Endpoints

### POST /message

Create a new message without a chat ID (creates a new chat).

**Authentication**: Required

**Rate Limit**: Message limiter

**Request Body**:

```json
{
  "content": "What is the weather like today?"
}
```

**Success Response** (201 Created):

```json
{
  "success": true,
  "message": "Message created",
  "data": {
    "chatId": "507f1f77bcf86cd799439012",
    "userMessage": {
      "id": "507f1f77bcf86cd799439013",
      "role": "user",
      "content": "What is the weather like today?",
      "timestamp": "2024-12-07T10:30:00.000Z"
    },
    "assistantMessage": {
      "id": "507f1f77bcf86cd799439014",
      "role": "assistant",
      "content": "AI response about weather...",
      "timestamp": "2024-12-07T10:30:05.000Z"
    }
  }
}
```

---

### POST /message/:chatId/messages

Create a new message in an existing chat.

**Authentication**: Required

**Rate Limit**: Message limiter

**URL Parameters**:

- `chatId`: The unique identifier of the chat

**Request Body**:

```json
{
  "content": "Tell me more about that"
}
```

**Success Response** (201 Created):

```json
{
  "success": true,
  "message": "Message created",
  "data": {
    "chatId": "507f1f77bcf86cd799439012",
    "userMessage": {
      "id": "507f1f77bcf86cd799439016",
      "role": "user",
      "content": "Tell me more about that",
      "timestamp": "2024-12-07T10:32:00.000Z"
    },
    "assistantMessage": {
      "id": "507f1f77bcf86cd799439017",
      "role": "assistant",
      "content": "Detailed AI response...",
      "timestamp": "2024-12-07T10:32:05.000Z"
    }
  }
}
```

**Error Response** (500 Internal Server Error):

```json
{
  "success": false,
  "message": "LLM generation failed",
  "details": {}
}
```

---

### GET /message/:chatId/messages

Get all messages in a specific chat.

**Authentication**: Required

**URL Parameters**:

- `chatId`: The unique identifier of the chat

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Messages fetched",
  "data": {
    "messages": [
      {
        "id": "507f1f77bcf86cd799439013",
        "role": "user",
        "content": "What is the weather like today?",
        "timestamp": "2024-12-07T10:30:00.000Z"
      },
      {
        "id": "507f1f77bcf86cd799439014",
        "role": "assistant",
        "content": "AI response about weather...",
        "timestamp": "2024-12-07T10:30:05.000Z"
      }
    ]
  }
}
```

---

### PATCH /message/:messageId

Edit a user message and regenerate the assistant's response.

**Authentication**: Required

**URL Parameters**:

- `messageId`: The unique identifier of the message to edit

**Request Body**:

```json
{
  "content": "Updated message content"
}
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Message edited",
  "data": {
    "userMessage": {
      "id": "507f1f77bcf86cd799439013",
      "role": "user",
      "content": "Updated message content",
      "timestamp": "2024-12-07T10:30:00.000Z"
    },
    "assistantMessage": {
      "id": "507f1f77bcf86cd799439018",
      "role": "assistant",
      "content": "New AI response based on edited message...",
      "timestamp": "2024-12-07T10:35:00.000Z"
    }
  }
}
```

---

### POST /message/:messageId/regenerate

Regenerate the assistant's response for a specific message.

**Authentication**: Required

**Rate Limit**: Regenerate limiter

**URL Parameters**:

- `messageId`: The unique identifier of the assistant message to regenerate

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Assistant regenerated",
  "data": {
    "assistant": {
      "id": "507f1f77bcf86cd799439019",
      "role": "assistant",
      "content": "Regenerated AI response...",
      "timestamp": "2024-12-07T10:36:00.000Z"
    }
  }
}
```

---

## Search Endpoints

### GET /search

Search through all messages across all chats for the authenticated user.

**Authentication**: Required

**Rate Limit**: Search limiter

**Query Parameters**:

- `q` (required): Search query string
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of results per page (default: 20)

**Example Request**:

```
GET /search?q=weather&page=1&limit=10
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Search results",
  "data": {
    "results": [
      {
        "messageId": "507f1f77bcf86cd799439013",
        "chatId": "507f1f77bcf86cd799439012",
        "role": "user",
        "content": "What is the weather like today?",
        "timestamp": "2024-12-07T10:30:00.000Z",
        "score": 0.95
      },
      {
        "messageId": "507f1f77bcf86cd799439014",
        "chatId": "507f1f77bcf86cd799439012",
        "role": "assistant",
        "content": "The weather information...",
        "timestamp": "2024-12-07T10:30:05.000Z",
        "score": 0.87
      }
    ]
  }
}
```

**Empty Query Response** (200 OK):

```json
{
  "success": true,
  "message": "No query provided",
  "data": {
    "results": []
  }
}
```

---

## Error Codes

| Status Code | Description                             |
| ----------- | --------------------------------------- |
| 200         | Success                                 |
| 201         | Created                                 |
| 400         | Bad Request - Invalid input             |
| 401         | Unauthorized - Invalid or missing token |
| 404         | Not Found - Resource doesn't exist      |
| 429         | Too Many Requests - Rate limit exceeded |
| 500         | Internal Server Error                   |

---

## Common Error Scenarios

### Invalid Token

```json
{
  "success": false,
  "message": "Invalid token"
}
```

### Missing Required Fields

```json
{
  "success": false,
  "message": "Validation error",
  "details": {
    "email": "Invalid email address",
    "password": "Password must be at least 6 characters long"
  }
}
```

### Resource Not Found

```json
{
  "success": false,
  "message": "Chat not found"
}
```

### Rate Limit Exceeded

```json
{
  "success": false,
  "message": "Too many requests, please try again later"
}
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Message IDs and Chat IDs are MongoDB ObjectIDs
- The API uses vector search (Qdrant) for semantic message search
- AI responses are generated using Google's Gemini API
- All user messages and assistant responses are stored with embeddings for search functionality

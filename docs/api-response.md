# API Response Format

> **Note:** Semua field dalam response API menggunakan **camelCase**. Primary key `id` dikembalikan sebagai `_id` oleh `TransformIdInterceptor`.

---

## Success Response

Semua response yang berhasil akan menggunakan format berikut:

### Structure

```ts
type SuccessResponse = {
  success: boolean;
  message?: string;
  data?: unknown;
};
```

### Example

```json
{
  "success": true,
  "data": {
    "_id": "clx...abc",
    "fullname": "Budi Santoso",
    "email": "budi@mail.com"
  }
}
```

---

## Error Response

Semua response error akan menggunakan format berikut:

### Structure

```ts
type ErrorResponse = {
  success: false;
  error: {
    name: string;
    message: string;
    details?: unknown;
  };
};
```

### Fields

| Field         | Type    | Description                                  |
| ------------- | ------- | -------------------------------------------- |
| success       | boolean | Selalu bernilai `false` untuk response error |
| error.name    | string  | Nama exception/error                         |
| error.message | string  | Pesan error                                  |
| error.details | unknown | Detail tambahan error (opsional)             |

---

## HTTP Exception

Digunakan ketika aplikasi melempar `HttpException`.

### Example

```json
{
  "success": false,
  "error": {
    "name": "NotFoundException",
    "message": "User not found",
    "details": null
  }
}
```

---

## Validation Error (Zod)

Digunakan ketika validasi request gagal.

### Example

```json
{
  "success": false,
  "error": {
    "name": "ZodError",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address"
      },
      {
        "field": "password",
        "message": "Password is required"
      }
    ]
  }
}
```

### Detail Item Structure

```json
{
  "field": "field_name",
  "message": "Validation message"
}
```

> `field` menggunakan dot notation (misal `"address.city"`) untuk nested field.

---

## Prisma Error

Digunakan ketika Prisma mengembalikan error (`PrismaClientKnownRequestError` atau `PrismaClientUnknownRequestError`).

### Example

```json
{
  "success": false,
  "error": {
    "name": "PrismaClientKnownRequestError",
    "message": "Unique constraint failed on email",
    "details": null
  }
}
```

---

## Internal Server Error

Digunakan untuk error umum yang tidak ditangani secara spesifik.

### Example

```json
{
  "success": false,
  "error": {
    "name": "Error",
    "message": "Something went wrong",
    "details": null
  }
}
```
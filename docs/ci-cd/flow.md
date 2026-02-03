# CI/CD Pipeline Flow

Este documento describe el flujo completo del pipeline CI/CD desde la creación de un Pull Request hasta el despliegue en producción.

## Diagrama del Pipeline

```mermaid
flowchart TD
    subgraph PR["Pull Request"]
        A[Crear PR] --> B{PR Review}
        B -->|Aprobado| C[Merge a main]
        B -->|Rechazado| A
    end

    subgraph CI["CI Jobs"]
        C --> D[Lint]
        C --> E[Test]
        C --> F[Build]
        D --> G{CI Pass?}
        E --> G
        F --> G
    end

    subgraph Build["Build & Registry"]
        G -->|Sí| H[Build Imágenes Docker]
        G -->|No| I[Notificar Error]
        I --> A
        H --> J[Push a Container Registry]
    end

    subgraph Deploy_Dev["Deploy Development"]
        J --> K[Deploy a Dev]
        K --> L{Tests de Integración}
        L -->|Pass| M[Validación Dev OK]
        L -->|Fail| N[Rollback Dev]
        N --> I
    end

    subgraph Release["Release"]
        M --> O[Tag Release]
        O --> P[Semantic Release]
        P --> Q[Generar Changelog]
        Q --> R[Publicar Release]
    end

    subgraph Deploy_Prod["Deploy Production"]
        R --> S[Deploy a Producción]
        S --> T{Health Check}
        T -->|OK| U[✅ Despliegue Exitoso]
        T -->|Fail| V[🔄 Rollback Producción]
        V --> W[Restaurar versión anterior]
        W --> X[Notificar incidencia]
    end

    style A fill:#e1f5fe
    style U fill:#c8e6c9
    style V fill:#ffcdd2
    style N fill:#ffcdd2
    style I fill:#ffcdd2
```

## Descripción de las Etapas

### 1. Pull Request
- El desarrollador crea un Pull Request con los cambios propuestos
- El código pasa por revisión de pares
- Una vez aprobado, se hace merge a la rama principal (`main`)

### 2. CI Jobs (Continuous Integration)
- **Lint**: Verifica el estilo y calidad del código
- **Test**: Ejecuta pruebas unitarias y de integración
- **Build**: Compila el proyecto para verificar que no hay errores

### 3. Build & Registry
- Se construyen las imágenes Docker para cada servicio
- Las imágenes se suben al Container Registry (Docker Hub, GHCR, etc.)

### 4. Deploy Development
- Se despliega automáticamente en el entorno de desarrollo
- Se ejecutan tests de integración en el entorno desplegado
- Si fallan los tests, se realiza rollback automático

### 5. Release
- Se crea un tag con la versión usando semantic versioning
- Semantic Release analiza los commits y determina la versión
- Se genera el changelog automáticamente
- Se publica el release en GitHub

### 6. Deploy Production
- Se despliega a producción la nueva versión
- Se realizan health checks para verificar el estado
- Si el despliegue falla, se ejecuta rollback automático

## Rollback

El pipeline incluye mecanismos de rollback en dos puntos críticos:

1. **Rollback en Development**: Si los tests de integración fallan después del despliegue en dev
2. **Rollback en Production**: Si el health check falla después del despliegue en producción

El rollback restaura automáticamente la versión anterior estable y notifica al equipo de la incidencia.

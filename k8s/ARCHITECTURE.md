# Architecture Documentation

## 🏗️ Мікросервісна архітектура iapteca

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KUBERNETES CLUSTER                                 │
│                                 (Minikube)                                   │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    INGRESS LAYER (Nginx)                             │  │
│  │              ┌──────────────────────────────────────┐               │  │
│  │              │      API Gateway Ingress            │               │  │
│  │              │   api.iapteca.local:80 → :8000      │               │  │
│  │              └──────────────────────────────────────┘               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    API GATEWAY LAYER                                  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │  API Gateway (nginx, 2 replicas, HPA: 2-8)                     │ │  │
│  │  │  Service: LoadBalancer :80 → :8000                            │ │  │
│  │  │  Resources: 100m CPU req / 200m limit, 128Mi req / 256Mi limit│ │  │
│  │  │  PDB: Min 1 available                                          │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  │       ┌────────────────────────────────────────────────────────┐    │  │
│  │       │        nginx.conf Configuration                        │    │  │
│  │       │  /api/products    → product-catalog:3001               │    │  │
│  │       │  /api/orders      → order-processing:3002              │    │  │
│  │       │  /health          → direct response (200)              │    │  │
│  │       └────────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│           │                              │                                   │
│           ▼                              ▼                                   │
│  ┌────────────────────────┐   ┌──────────────────────────┐                  │
│  │  MICROSERVICE 1        │   │  MICROSERVICE 2          │                  │
│  │                        │   │                          │                  │
│  │ Product-Catalog       │   │ Order-Processing        │                  │
│  │ (Read-Only Database)  │   │ (Write-Enabled Database)│                  │
│  │                        │   │                          │                  │
│  │ ┌──────────────────┐  │   │ ┌──────────────────┐    │                  │
│  │ │  Deployment      │  │   │ │  Deployment      │    │                  │
│  │ │  ┌────────────┐  │  │   │ │  ┌────────────┐ │    │                  │
│  │ │  │ 2 Replicas │  │  │   │ │  │ 2 Replicas │ │    │                  │
│  │ │  │ HPA: 2-5   │  │  │   │ │  │ HPA: 2-10  │ │    │                  │
│  │ │  └────────────┘  │  │   │ │  └────────────┘ │    │                  │
│  │ └──────────────────┘  │   │ └──────────────────┘    │                  │
│  │                        │   │                          │                  │
│  │ Resources:            │   │ Resources:               │                  │
│  │ • CPU: 200m/400m     │   │ • CPU: 300m/600m        │                  │
│  │ • Mem: 256Mi/512Mi   │   │ • Mem: 512Mi/1Gi        │                  │
│  │                        │   │                          │                  │
│  │ Service: ClusterIP   │   │ Service: ClusterIP       │                  │
│  │ • :3001 (HTTP)       │   │ • :3002 (HTTP)          │                  │
│  │ • :9090 (Metrics)    │   │ • :9090 (Metrics)       │                  │
│  │                        │   │                          │                  │
│  │ Probes:               │   │ Probes:                  │                  │
│  │ ✓ Liveness           │   │ ✓ Liveness              │                  │
│  │ ✓ Readiness          │   │ ✓ Readiness             │                  │
│  │                        │   │                          │                  │
│  │ Secrets:              │   │ Secrets:                 │                  │
│  │ • MONGODB_URI        │   │ • MONGODB_URI           │                  │
│  │ • DB_READ_ONLY:true  │   │ • DB_WRITE_ENABLED:true│                  │
│  │                        │   │                          │                  │
│  │ ConfigMap:            │   │ ConfigMap:               │                  │
│  │ • NODE_ENV            │   │ • NODE_ENV              │                  │
│  │ • LOG_LEVEL           │   │ • QUEUE_WORKERS: 5      │                  │
│  │ • SERVICE_*           │   │ • MAX_RETRIES: 3        │                  │
│  │                        │   │ • BATCH_SIZE: 100      │                  │
│  │ RBAC:                 │   │ RBAC:                    │                  │
│  │ • ServiceAccount      │   │ • ServiceAccount         │                  │
│  │ • Read secrets/cms    │   │ • Read secrets/cms       │                  │
│  │                        │   │                          │                  │
│  │ PDB:                  │   │ PDB:                     │                  │
│  │ • Min 1 available     │   │ • Min 1 available        │                  │
│  │                        │   │                          │                  │
│  │ Affinity:             │   │ Affinity:                │                  │
│  │ ✓ Anti-affinity      │   │ ✓ Anti-affinity         │                  │
│  │   (prefer different   │   │   (prefer different      │                  │
│  │   nodes)              │   │   nodes)                 │                  │
│  │                        │   │                          │                  │
│  └────────────────────────┘   └──────────────────────────┘                  │
│           │                              │                                   │
│           └──────────────────┬───────────┘                                   │
│                              ▼                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         DATABASE LAYER                                │  │
│  │  ┌───────────────────────────────────────────────────────────────┐   │  │
│  │  │  MongoDB (1 Pod, no HPA - stateful)                         │   │  │
│  │  │  Service: ClusterIP :27017                                  │   │  │
│  │  │  Resources: 256m/500m CPU, 256Mi/512Mi Memory              │   │  │
│  │  │  PDB: Min 1 available                                       │   │  │
│  │  │                                                               │   │  │
│  │  │  Storage:                                                    │   │  │
│  │  │  • Main: mongodb-pvc (5Gi)                                  │   │  │
│  │  │  • Backup: mongodb-backup-pvc (2Gi)                        │   │  │
│  │  │                                                               │   │  │
│  │  │  Replica Set: rs0                                           │   │  │
│  │  │  Auth: Admin user (secret)                                  │   │  │
│  │  │                                                               │   │  │
│  │  │  Probes:                                                    │   │  │
│  │  │  ✓ Liveness: mongosh ping (30s initial delay)              │   │  │
│  │  │  ✓ Readiness: mongosh ping (10s initial delay)             │   │  │
│  │  │                                                               │   │  │
│  │  │  ConfigMap: mongod.conf, init-replica-set.sh               │   │  │
│  │  │  Secret: admin-user, admin-password, replica-key           │   │  │
│  │  └───────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     SECURITY & POLICIES                               │  │
│  │                                                                        │  │
│  │  NetworkPolicies:                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │ 1. deny-all-ingress (default deny)                         │    │  │
│  │  │ 2. allow-mongodb-from-services (from PC & OP)              │    │  │
│  │  │ 3. allow-product-catalog (from API-GW)                    │    │  │
│  │  │ 4. allow-order-processing (from API-GW)                   │    │  │
│  │  │ 5. allow-api-gateway (from all)                           │    │  │
│  │  │ 6. allow-dns-egress (UDP :53)                             │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                        │  │
│  │  RBAC (Role-Based Access Control):                                  │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │ Product-Catalog Role:                                       │    │  │
│  │  │   • get/list/watch configmaps                              │    │  │
│  │  │   • get secrets                                             │    │  │
│  │  │                                                               │    │  │
│  │  │ Order-Processing Role:                                      │    │  │
│  │  │   • get/list/watch configmaps                              │    │  │
│  │  │   • get secrets                                             │    │  │
│  │  │                                                               │    │  │
│  │  │ API-Gateway Role:                                          │    │  │
│  │  │   • get/list/watch configmaps                              │    │  │
│  │  │   • get/list/watch services                                │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                        │  │
│  │  SecurityContext:                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │ Container Security:                                         │    │  │
│  │  │ • runAsNonRoot: true (except MongoDB)                      │    │  │
│  │  │ • runAsUser: 1000 (app pods)                               │    │  │
│  │  │ • allowPrivilegeEscalation: false                          │    │  │
│  │  │ • readOnlyRootFilesystem: true (where possible)            │    │  │
│  │  │ • capabilities: DROP ALL                                    │    │  │
│  │  │                                                               │    │  │
│  │  │ Pod Security:                                               │    │  │
│  │  │ • fsGroup: 1000 (app pods)                                 │    │  │
│  │  │ • seccompProfile: RuntimeDefault                            │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    RESOURCE MANAGEMENT                                │  │
│  │                                                                        │  │
│  │  ResourceQuota (iapteca-quota):                                      │  │
│  │  • requests.cpu: 4                                                   │  │
│  │  • requests.memory: 4Gi                                              │  │
│  │  • limits.cpu: 8                                                     │  │
│  │  • limits.memory: 8Gi                                                │  │
│  │  • pods: 50                                                          │  │
│  │  • services: 10                                                      │  │
│  │  • persistentvolumeclaims: 5                                         │  │
│  │                                                                        │  │
│  │  LimitRange (iapteca-limits):                                        │  │
│  │  • Container max: 1 CPU, 1Gi Memory                                  │  │
│  │  • Container min: 50m CPU, 64Mi Memory                               │  │
│  │  • Container default: 500m CPU, 512Mi Memory                         │  │
│  │  • Pod max: 2 CPU, 2Gi Memory                                        │  │
│  │                                                                        │  │
│  │  HPA (Horizontal Pod Autoscaler):                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │ Product-Catalog:                                            │    │  │
│  │  │   • min: 2, max: 5                                          │    │  │
│  │  │   • CPU target: 70% utilization                            │    │  │
│  │  │   • Memory target: 80% utilization                         │    │  │
│  │  │   • Scale down: 50% per 60s (after 5min stable)            │    │  │
│  │  │   • Scale up: 100% per 30s (after 1min stable)             │    │  │
│  │  │                                                               │    │  │
│  │  │ Order-Processing:                                          │    │  │
│  │  │   • min: 2, max: 10                                        │    │  │
│  │  │   • CPU target: 75% utilization                            │    │  │
│  │  │   • Memory target: 85% utilization                         │    │  │
│  │  │   • Scale down: 50% per 60s (after 10min stable)           │    │  │
│  │  │   • Scale up: 100% per 20s (after 30s stable)              │    │  │
│  │  │                                                               │    │  │
│  │  │ API-Gateway:                                               │    │  │
│  │  │   • min: 2, max: 8                                         │    │  │
│  │  │   • CPU target: 65% utilization                            │    │  │
│  │  │   • Scale down: 50% per 60s (after 5min stable)            │    │  │
│  │  │   • Scale up: 100% per 30s (after 1min stable)             │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE ACCESS CONTROL                              │
│                                                                              │
│  PRINCIPLE: Least Privilege                                                 │
│                                                                              │
│  Product-Catalog User:                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Username: product-catalog-user                                     │   │
│  │ Password: product-pass                                             │   │
│  │ URI: mongodb://product-catalog-user:product-pass@mongodb:27017/   │   │
│  │      iapteca?replicaSet=rs0&directConnection=true                │   │
│  │                                                                    │   │
│  │ Permissions (Read-Only):                                          │   │
│  │ ✓ read:     products, orders, users collections                  │   │
│  │ ✗ insert:   DENIED (application-level enforcement)               │   │
│  │ ✗ update:   DENIED (application-level enforcement)               │   │
│  │ ✗ delete:   DENIED (application-level enforcement)               │   │
│  │ ✗ admin:    DENIED                                                │   │
│  │                                                                    │   │
│  │ Environmental Variable: DB_READ_ONLY=true                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Order-Processing User:                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Username: order-processing-user                                   │   │
│  │ Password: order-pass                                              │   │
│  │ URI: mongodb://order-processing-user:order-pass@mongodb:27017/  │   │
│  │      iapteca?replicaSet=rs0&directConnection=true               │   │
│  │                                                                    │   │
│  │ Permissions (Read-Write):                                        │   │
│  │ ✓ read:     orders, orderItems, products, users collections     │   │
│  │ ✓ insert:   orders, orderItems (order creation)                 │   │
│  │ ✓ update:   orders, orderItems (order status changes)           │   │
│  │ ✗ delete:   DENIED (soft delete via status field)               │   │
│  │ ✗ admin:    DENIED                                               │   │
│  │                                                                    │   │
│  │ Environmental Variable: DB_WRITE_ENABLED=true                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Admin User (MongoDB):                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Username: admin                                                   │   │
│  │ Password: secure-admin-password-change-me (CHANGE IN PROD!)       │   │
│  │ Role: root                                                         │   │
│  │ Used for: Replica set initialization, maintenance                 │   │
│  │ Access: INTERNAL ONLY (via Kubernetes secrets)                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            NETWORK FLOW                                      │
│                                                                              │
│  External Request:                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Client → Ingress (api.iapteca.local:80)                           │   │
│  │    ↓                                                                │   │
│  │ LoadBalancer Service (api-gateway, port 80 → 8000)               │   │
│  │    ↓                                                                │   │
│  │ Nginx Pod (API Gateway)                                           │   │
│  │    │                                                               │   │
│  │    ├─→ GET /api/products → Product-Catalog:3001 (allows-read)    │   │
│  │    │       └─→ MongoDB:27017 (read-only credentials)             │   │
│  │    │                                                               │   │
│  │    └─→ POST /api/orders → Order-Processing:3002 (allows-write)   │   │
│  │            └─→ MongoDB:27017 (write-enabled credentials)         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Internal Communication:                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Product-Catalog ←DNS→ product-catalog.iapteca.svc.cluster.local   │   │
│  │ Order-Processing ←DNS→ order-processing.iapteca.svc.cluster.local │   │
│  │ MongoDB ←DNS→ mongodb.iapteca.svc.cluster.local                   │   │
│  │ API-Gateway ←DNS→ api-gateway.iapteca.svc.cluster.local           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📋 Таблиця компонентів

| Компонент | Тип | Replicas | CPU (req/limit) | Mem (req/limit) | HPA | Stateful |
|-----------|-----|----------|-----------------|-----------------|-----|----------|
| MongoDB | Deployment | 1 | 250m/500m | 256Mi/512Mi | ❌ | ✅ |
| Product-Catalog | Deployment | 2 | 200m/400m | 256Mi/512Mi | ✅ (2-5) | ❌ |
| Order-Processing | Deployment | 2 | 300m/600m | 512Mi/1Gi | ✅ (2-10) | ❌ |
| API-Gateway | Deployment | 2 | 100m/200m | 128Mi/256Mi | ✅ (2-8) | ❌ |

## 🔐 Таблиця привілеїв

| Сервіс | DB User | Password | Read | Write | Admin | Environment |
|--------|---------|----------|------|-------|-------|-------------|
| Product-Catalog | product-catalog-user | product-pass | ✅ | ❌ | ❌ | DB_READ_ONLY=true |
| Order-Processing | order-processing-user | order-pass | ✅ | ✅ | ❌ | DB_WRITE_ENABLED=true |
| MongoDB | admin | secure-admin-password-change-me | ✅ | ✅ | ✅ | Internal only |

## 📊 Обчислення ресурсів

**Максимальні ресурси при повній масштабованості (усі HPA на max):**

```
Product-Catalog (5 pods):        5 × (200m req / 400m limit)   = 1000m req / 2000m limit
Order-Processing (10 pods):      10 × (300m req / 600m limit)  = 3000m req / 6000m limit
API-Gateway (8 pods):            8 × (100m req / 200m limit)   = 800m req / 1600m limit
MongoDB (1 pod):                 1 × (250m req / 500m limit)   = 250m req / 500m limit
─────────────────────────────────────────────────────────────────────────────
TOTAL (максимум):                                              = 5050m req / 10100m limit
                                                                  (5.05 CPU / 10.1 CPU)

На практиці Minikube має 4 CPU, тому максимум буде обмежений на рівні 4000m.
```

**Пам'ять при повній масштабованості:**

```
Product-Catalog (5 pods):        5 × (256Mi req / 512Mi limit)  = 1280Mi req / 2560Mi limit
Order-Processing (10 pods):      10 × (512Mi req / 1Gi limit)   = 5120Mi req / 10Gi limit
API-Gateway (8 pods):            8 × (128Mi req / 256Mi limit)   = 1024Mi req / 2048Mi limit
MongoDB (1 pod):                 1 × (256Mi req / 512Mi limit)   = 256Mi req / 512Mi limit
─────────────────────────────────────────────────────────────────────────────
TOTAL (максимум):                                               = 7680Mi req / 15360Mi limit
                                                                    (7.5Gi / 15Gi)

На практиці Minikube має 6Gi, тому буде обмежено ResourceQuota на 4Gi requests.
```

## 🚀 Порядок розгортання

1. **Namespace** (01)
2. **MongoDB** (02-06) - чекаємо готовності перед наступним кроком
3. **Product-Catalog** (07-10)
4. **Order-Processing** (11-14)
5. **API-Gateway** (15-18)
6. **Security** (19-20)
7. **Autoscaling** (21)
8. **Resource Management** (22-23)

---

**Дата створення**: 2026-07-01  
**Версія**: 1.0  
**環境**: Minikube (локальна розробка)

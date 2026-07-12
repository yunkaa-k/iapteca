# Kubernetes Microservices Architecture for iapteca

## 📋 Огляд архітектури

Повна мікросервісна архітектура розгортається на Minikube з наступними компонентами:

### Сервіси

1. **MongoDB Database** (01-06)
   - Persistence: PVC (5Gi)
   - Backup PVC (2Gi)
   - Health checks (liveness/readiness)
   - Resource limits: 256Mi req / 512Mi limit

2. **Product-Catalog Service** (07-10)
   - Replicas: 2 (HPA: 2-5)
   - **READ-ONLY** database access via Least Privilege
   - Resource limits: 256Mi req / 512Mi limit
   - Metrics endpoint: :9090
   - Liveness/Readiness probes на /health, /ready

3. **Order-Processing Service** (11-14)
   - Replicas: 2 (HPA: 2-10)
   - **WRITE-ENABLED** database access for order operations
   - Resource limits: 512Mi req / 1Gi limit
   - Metrics endpoint: :9090
   - Queue workers: 5, Max retries: 3, Batch size: 100

4. **API Gateway** (15-18)
   - Nginx reverse proxy
   - Replicas: 2 (HPA: 2-8)
   - Routes to all microservices
   - LoadBalancer service (external access)
   - Resource limits: 128Mi req / 256Mi limit
   - Ingress for api.iapteca.local

### Безпека (19-20)

- **NetworkPolicies**: Deny-all ingress + selective allow rules
  - MongoDB: только від product-catalog та order-processing
  - Services: только від api-gateway
  - DNS egress дозволений всім
  
- **RBAC**: Кожен сервіс має мінімальні привілеї
  - Product-Catalog: читання configmaps/secrets
  - Order-Processing: читання configmaps/secrets
  - API-Gateway: читання configmaps/services

- **SecurityContext**:
  - runAsNonRoot: true (крім MongoDB)
  - readOnlyRootFilesystem: true (де можливо)
  - capabilities: DROP ALL + NET_BIND_SERVICE

### Масштабування (21)

- **Horizontal Pod Autoscaler**
  - Product-Catalog: CPU 70%, Memory 80%
  - Order-Processing: CPU 75%, Memory 85% (більше вагомий)
  - API-Gateway: CPU 65%

### Ресурси та Квоти (22-23)

- **ResourceQuota**: Max 4 CPU, 4Gi Memory на namespace
- **LimitRange**: Контейнер: 50m-1 CPU, 64Mi-1Gi Memory
- **PodDisruptionBudget**: Min 1 pod завжди доступний

## 📂 Структура файлів

```
k8s/
├── 01-namespace.yaml              # iapteca namespace
├── 02-03-mongodb-*.yaml           # MongoDB secrets & config
├── 04-mongodb-pvc.yaml            # Storage
├── 05-06-mongodb-*.yaml           # Deployment & Service
├── 07-10-product-catalog-*.yaml   # Product Catalog service (READ-ONLY)
├── 11-14-order-processing-*.yaml  # Order Processing service (WRITE)
├── 15-18-api-gateway-*.yaml       # API Gateway & Ingress
├── 19-networkpolicy.yaml          # Network security
├── 20-rbac.yaml                   # Access control
├── 21-hpa.yaml                    # Auto-scaling
├── 22-resourcequota.yaml          # Quotas & limits
├── 23-poddisruptionbudget.yaml    # Availability SLAs
└── 24-deployment-instructions.yaml # Deployment guide
```

## 🚀 Развертывание

### Перевірка синтаксису (DRY-RUN)

```bash
kubectl apply -f k8s/ --dry-run=client -n iapteca
```

**Результат**: ✅ Всі 45 об'єктів успішно валідовані

### Розгортання у порядку

```bash
# Метод 1: Послідовне розгортання
for i in {01..23}; do 
  kubectl apply -f k8s/$(printf "%02d" $i)*.yaml
  sleep 3
done

# Метод 2: Одразу все
kubectl apply -f k8s/

# Метод 3: Вручну (безпека - чекаємо готовності)
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-03-mongodb-*.yaml
kubectl wait --for=condition=ready pod -l app=mongodb -n iapteca --timeout=300s
kubectl apply -f k8s/04-06-mongodb-*.yaml
# ... й т.д.
```

### Перевірка розгортання

```bash
# Статус всіх сервісів
kubectl get all -n iapteca

# Watch pods (очікування готовності)
kubectl get pods -n iapteca -w

# Логи сервісів
kubectl logs -n iapteca -f deployment/product-catalog
kubectl logs -n iapteca -f deployment/order-processing
kubectl logs -n iapteca -f deployment/api-gateway

# Статус MongoDB
kubectl exec -it -n iapteca deployment/mongodb -- mongosh --eval "db.adminCommand('ping')"

# Network policies
kubectl get networkpolicies -n iapteca

# HPA статус
kubectl get hpa -n iapteca
```

## 🔐 Least Privilege Database Access

### Product-Catalog (READ-ONLY)

```yaml
MONGODB_URI: mongodb://product-catalog-user:product-pass@mongodb:27017/iapteca
DB_READ_ONLY: "true"
```

Сервіс отримує:
- ✅ READ доступ до всіх collections
- ❌ WRITE/DELETE заборонено на рівні application
- Кредитали зберігаються у Secret
- Rotation: змініть Secret, restart pods

### Order-Processing (WRITE-ENABLED)

```yaml
MONGODB_URI: mongodb://order-processing-user:order-pass@mongodb:27017/iapteca
DB_WRITE_ENABLED: "true"
```

Сервіс отримує:
- ✅ READ/WRITE/DELETE доступ для замовлень
- ❌ Доступ обмежений конкретними collections
- Кредитали у окремому Secret
- Більш вагомі ресурси: 512Mi req / 1Gi limit

## 📊 Monitoring & Observability

Кожен сервіс експортує метрики на порту 9090:

```bash
# Port-forward для Prometheus
kubectl port-forward -n iapteca svc/product-catalog 9090:9090
# curl http://localhost:9090/metrics
```

Prometheus annotations:
```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "9090"
prometheus.io/path: "/metrics"
```

## 🌐 External Access

### API Gateway

```bash
# LoadBalancer (на локальній машині - localhost)
kubectl get svc api-gateway -n iapteca

# Port-forward (як альтернатива)
kubectl port-forward -n iapteca svc/api-gateway 8080:80

# Ingress (якщо увімкнено)
# api.iapteca.local -> api-gateway:8000
```

### MongoDB

```bash
# Внутрішній доступ (з інших pods)
mongodb:27017

# Port-forward для локального доступу
kubectl port-forward -n iapteca svc/mongodb 27017:27017

# Підключення локально
mongosh mongodb://admin:secure-admin-password-change-me@localhost:27017/admin
```

## 🛠️ Configuration Management

### ConfigMaps

- `mongodb-config`: MongoDB конфігурація
- `product-catalog-config`: Переменные окружения (read-only)
- `order-processing-config`: Queue, batch settings
- `api-gateway-config`: nginx.conf, upstream servers

### Secrets

- `mongodb-secret`: Admin credentials
- `product-catalog-secret`: Read-only DSN
- `order-processing-secret`: Write-enabled DSN
- `api-gateway-secret`: JWT key, API key

**Увага**: Усі Secrets знаходяться в YAML. Для production:
- Використовуйте HashiCorp Vault або AWS Secrets Manager
- Закодуйте base64 або використовуйте sealed-secrets
- Ніколи не коммітьте в git

## 📈 Resource Limits

| Service | Requests | Limits | HPA Min | HPA Max |
|---------|----------|--------|---------|---------|
| MongoDB | 256m/256Mi | 500m/512Mi | - | - |
| Product-Catalog | 200m/256Mi | 400m/512Mi | 2 | 5 |
| Order-Processing | 300m/512Mi | 600m/1Gi | 2 | 10 |
| API-Gateway | 100m/128Mi | 200m/256Mi | 2 | 8 |
| **Total Quota** | **4000m/4Gi** | **8000m/8Gi** | - | - |

## 🔄 Updates & Upgrades

### Rolling Update

```bash
# Оновити deployment без downtime
kubectl set image deployment/product-catalog \
  product-catalog=bouncytorch/iapteca:v2 -n iapteca

# Watch update progress
kubectl rollout status deployment/product-catalog -n iapteca
```

### Rollback

```bash
kubectl rollout undo deployment/product-catalog -n iapteca
kubectl rollout history deployment/product-catalog -n iapteca
```

## 🧹 Cleanup

```bash
# Видалити весь namespace
kubectl delete namespace iapteca

# Видалити окремий deployment
kubectl delete deployment product-catalog -n iapteca

# Видалити secrets (УВАГА!)
kubectl delete secret mongodb-secret -n iapteca
```

## ⚠️ Важливо для Minikube

1. **StorageClass**: Minikube використовує `standard` (локальний storage)
2. **LoadBalancer**: На Minikube стає ClusterIP без IP. Використовуйте `minikube service api-gateway -n iapteca`
3. **Ingress**: Вимагає nginx ingress controller: `minikube addons enable ingress`
4. **Metrics**: Для HPA потрібен metrics-server: `minikube addons enable metrics-server`

### Підготовка Minikube

```bash
# Запуск Minikube
minikube start --cpus=4 --memory=6144

# Увімкнення необхідних addons
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable storage-provisioner

# Перевірка addons
minikube addons list

# Доступ до сервісів
minikube service api-gateway -n iapteca  # Відкрие браузер
```

## 🔗 Внутрішні URL

```
MongoDB:              mongodb:27017
Product-Catalog:     http://product-catalog:3001
Order-Processing:    http://order-processing:3002
API-Gateway:         http://api-gateway:8000
```

---

**Версія**: 1.0  
**Дата**: 2026-07-01  
**Для**: Minikube локальна розробка

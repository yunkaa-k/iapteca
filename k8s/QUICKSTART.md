# 🚀 Kubernetes iapteca - Quick Start Guide

## ✅ Перевірка валідації (DRY-RUN)

```bash
kubectl apply -f k8s/ --dry-run=client -n iapteca
```

**Результат**: ✅ **49 об'єктів успішно валідовано** (0 помилок)

### Розбиття ресурсів:
- Deployments: 4 (MongoDB, Product-Catalog, Order-Processing, API-Gateway)
- Services: 8
- Secrets: 4 (MongoDB, Product-Catalog read-only, Order-Processing write, API-Gateway)
- ConfigMaps: 4
- PersistentVolumeClaims: 2
- NetworkPolicies: 6 (deny-all + selective allow)
- RBAC (Roles + RoleBindings): 6
- HPA (Horizontal Pod Autoscalers): 3
- ResourceQuota + LimitRange: 2
- PodDisruptionBudgets: 4
- Namespace: 1
- Ingress: 2 (1 ingress for api.iapteca.local)

---

## 🎯 Розгортання в 3 кроки

### Крок 1: Підготовка Minikube

```bash
# Запуск Minikube з достатньою кількістю ресурсів
minikube start --cpus=4 --memory=6144

# Увімкнення необхідних addons
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable storage-provisioner
```

### Крок 2: Розгортання

```bash
# Розгортання всіх маніфестів
kubectl apply -f k8s/

# Або за допомогою скрипту (рекомендовано)
bash k8s/deploy.sh false
```

### Крок 3: Перевірка статусу

```bash
# Watch pods (чекаємо готовності ~2-3 хвилини)
kubectl get pods -n iapteca -w

# Або компактний вивід
kubectl get all -n iapteca
```

---

## 🔐 Контроль доступу до БД (Least Privilege)

### Product-Catalog: READ-ONLY доступ

```yaml
Secret: product-catalog-secret
├─ MONGODB_URI: mongodb://product-catalog-user:product-pass@mongodb:27017/...
├─ DB_USER: product-catalog-user
└─ DB_PASSWORD: product-pass

ConfigMap: product-catalog-config
└─ DB_READ_ONLY: "true"
```

**Привілегії:**
- ✅ SELECT (читання)
- ❌ INSERT/UPDATE/DELETE (заборонено)
- ❌ ADMIN (заборонено)

### Order-Processing: WRITE-ENABLED доступ

```yaml
Secret: order-processing-secret
├─ MONGODB_URI: mongodb://order-processing-user:order-pass@mongodb:27017/...
├─ DB_USER: order-processing-user
├─ DB_PASSWORD: order-pass
└─ DB_WRITE_ENABLED: "true"

ConfigMap: order-processing-config
├─ QUEUE_WORKERS: "5"
├─ MAX_RETRIES: "3"
└─ BATCH_SIZE: "100"
```

**Привілегії:**
- ✅ SELECT/INSERT/UPDATE (для замовлень)
- ❌ DELETE (soft delete via status field)
- ❌ ADMIN (заборонено)

---

## 📊 Ресурси та Масштабування

### Request vs Limit

| Сервіс | CPU Request | CPU Limit | Memory Request | Memory Limit | HPA |
|--------|-------------|-----------|-----------------|---------------|-----|
| MongoDB | 250m | 500m | 256Mi | 512Mi | - |
| Product-Catalog | 200m | 400m | 256Mi | 512Mi | 2-5 replicas |
| Order-Processing | 300m | 600m | 512Mi | 1Gi | 2-10 replicas |
| API-Gateway | 100m | 200m | 128Mi | 256Mi | 2-8 replicas |

### Namespace Quota

```yaml
Total Namespace Limits:
├─ requests.cpu: 4 cores
├─ requests.memory: 4Gi
├─ limits.cpu: 8 cores
├─ limits.memory: 8Gi
├─ pods: 50
├─ services: 10
└─ persistentvolumeclaims: 5
```

### Auto-Scaling

- **Product-Catalog**: CPU > 70% або Memory > 80% → scale up до 5 replicas
- **Order-Processing**: CPU > 75% або Memory > 85% → scale up до 10 replicas
- **API-Gateway**: CPU > 65% → scale up до 8 replicas

---

## 🌐 Доступ до сервісів

### Внутрішні URL (з інших pods)

```
MongoDB:             mongodb:27017
Product-Catalog:     http://product-catalog:3001
Order-Processing:    http://order-processing:3002
API-Gateway:         http://api-gateway:8000
```

### Port Forwarding

```bash
# API Gateway (localhost:8080)
kubectl port-forward -n iapteca svc/api-gateway 8080:80

# MongoDB (localhost:27017)
kubectl port-forward -n iapteca svc/mongodb 27017:27017

# Product-Catalog Metrics (localhost:9090)
kubectl port-forward -n iapteca svc/product-catalog 9090:9090
```

### Minikube Service

```bash
# Автоматично відкриває браузер на сервісі
minikube service api-gateway -n iapteca
```

### Ingress

```bash
# Додайте в /etc/hosts (Linux/Mac) або C:\Windows\System32\drivers\etc\hosts (Windows):
127.0.0.1 api.iapteca.local

# Тоді доступ: http://api.iapteca.local
```

---

## 🔍 Моніторинг та Логування

### Статус Pods

```bash
# Watch real-time
kubectl get pods -n iapteca -w

# Detailed status
kubectl get pods -n iapteca -o wide

# Pod events
kubectl describe pod <pod-name> -n iapteca
```

### Логи

```bash
# Tail logs (follow)
kubectl logs -n iapteca -f deployment/product-catalog
kubectl logs -n iapteca -f deployment/order-processing
kubectl logs -n iapteca -f deployment/api-gateway
kubectl logs -n iapteca -f deployment/mongodb

# Previous pod logs (if crashed)
kubectl logs -n iapteca deployment/product-catalog --previous
```

### HPA Status

```bash
kubectl get hpa -n iapteca -w
kubectl describe hpa product-catalog-hpa -n iapteca
```

### Metrics

```bash
# Node metrics
kubectl top nodes

# Pod metrics
kubectl top pods -n iapteca
```

---

## 🔐 Безпека

### Network Policies

Встановлені policies:

1. **deny-all-ingress**: Забороняє весь вхідний трафік за замовчуванням
2. **allow-mongodb-from-services**: MongoDB приймає від PC & OP
3. **allow-product-catalog**: Product-Catalog приймає від API-GW
4. **allow-order-processing**: Order-Processing приймає від API-GW
5. **allow-api-gateway**: API-GW приймає всім (фронтенд → GW)
6. **allow-dns-egress**: DNS (UDP :53) дозволений для всіх

### RBAC

Кожен сервіс має мінімальні привілеї:

```bash
# Перевірити roles
kubectl get role -n iapteca
kubectl get rolebinding -n iapteca

# Перевірити service account
kubectl get sa -n iapteca
```

### Pod Security

- `runAsNonRoot: true` (крім MongoDB)
- `allowPrivilegeEscalation: false`
- `readOnlyRootFilesystem: true` (де можливо)
- `capabilities: DROP ALL`

---

## 🔄 Оновлення та Откат

### Rolling Update (без downtime)

```bash
# Оновити image
kubectl set image deployment/product-catalog \
  product-catalog=bouncytorch/iapteca:v2 -n iapteca

# Watch progress
kubectl rollout status deployment/product-catalog -n iapteca
```

### Rollback

```bash
# Откат до попередної версії
kubectl rollout undo deployment/product-catalog -n iapteca

# Переглянути історію
kubectl rollout history deployment/product-catalog -n iapteca
```

### Restart

```bash
kubectl rollout restart deployment/product-catalog -n iapteca
```

---

## 🧹 Cleanup

### Видалити все

```bash
# Видалити весь namespace (УВАГА! Це видалить все)
kubectl delete namespace iapteca

# Видалити конкретний ресурс
kubectl delete deployment product-catalog -n iapteca
kubectl delete service api-gateway -n iapteca
```

---

## ⚠️ Common Issues

### MongoDB не стартує

```bash
# Перевірити logs
kubectl logs -n iapteca deployment/mongodb

# Очистити PVC
kubectl delete pvc mongodb-pvc -n iapteca

# Restart
kubectl rollout restart deployment/mongodb -n iapteca
```

### Pods в статусі Pending

```bash
# Часто - недостатньо ресурсів
kubectl describe pod <pod-name> -n iapteca

# Перевірити quotas
kubectl describe resourcequota iapteca-quota -n iapteca

# Перевірити node resources
kubectl top nodes
```

### Service Endpoint не доступна

```bash
# Перевірити endpoints
kubectl get endpoints -n iapteca

# Перевірити network policies
kubectl get networkpolicies -n iapteca

# Перевірити pod logs
kubectl logs -n iapteca deployment/product-catalog
```

---

## 📚 Файлова структура

```
k8s/
├── 01-namespace.yaml                    # Namespace
├── 02-06-mongodb-*.yaml                 # MongoDB (DB)
├── 07-10-product-catalog-*.yaml         # Product-Catalog (READ-ONLY)
├── 11-14-order-processing-*.yaml        # Order-Processing (WRITE)
├── 15-18-api-gateway-*.yaml             # API Gateway (Nginx Reverse Proxy)
├── 19-networkpolicy.yaml                # Security policies
├── 20-rbac.yaml                         # Access control
├── 21-hpa.yaml                          # Auto-scaling
├── 22-resourcequota.yaml                # Quotas & limits
├── 23-poddisruptionbudget.yaml          # Availability SLAs
├── 24-deployment-instructions.yaml      # Manual instructions
├── README.md                            # Docmentation (довгий)
├── ARCHITECTURE.md                      # Architecture diagrams
├── QUICKSTART.md                        # Цей файл
├── COMMANDS.sh                          # Useful commands reference
└── deploy.sh                            # Deployment script
```

---

## 🎓 Ключові концепції

### Least Privilege (Мінімальні привілеї)

- **Product-Catalog** отримує ЛИШЕ read-only доступ до БД
- **Order-Processing** отримує read-write доступ ЛИШЕ для замовлень
- Admin credentials зберігаються в Secrets
- Кожен сервіс має власний ServiceAccount з мінімальними RBAC привілеями

### 12-Factor App Compliance

- ✅ Config від ConfigMaps
- ✅ Secrets від Kubernetes Secrets
- ✅ Logs → stdout (контролює логування контейнера)
- ✅ Scalable (HPA для масштабування)
- ✅ Admin tasks → separate pods (init containers, jobs)

### High Availability

- ✅ Multiple replicas (2 мін на сервіс)
- ✅ Pod Anti-affinity (розподіл на різні ноди)
- ✅ Pod Disruption Budgets (min 1 available)
- ✅ Health checks (liveness + readiness probes)
- ✅ Circuit breaker pattern (via probes)

---

## 📞 Support & Documentation

- **README.md** - повна документація з прикладами
- **ARCHITECTURE.md** - діаграми та деталі архітектури
- **COMMANDS.sh** - більше команд для роботи
- **deploy.sh** - автоматичне розгортання

---

**Версія**: 1.0  
**Дата**: 2026-07-01  
**Статус**: ✅ Ready for Deployment  
**Валідація**: ✅ All 49 objects validated (0 errors)

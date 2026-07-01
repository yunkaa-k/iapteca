#!/bin/bash
# Quick deployment script for iapteca Kubernetes manifests

set -e

NAMESPACE="iapteca"
DRY_RUN="${1:-false}"
MINIKUBE_PROFILE="${2:-minikube}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  iapteca Kubernetes Deployment Script                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Перевірка залежностей...${NC}"
    
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}✗ kubectl не встановлений${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ kubectl${NC}"
    
    if ! command -v minikube &> /dev/null; then
        echo -e "${YELLOW}⚠ Minikube не встановлений (опціонально)${NC}"
    else
        echo -e "${GREEN}✓ minikube${NC}"
    fi
    
    echo ""
}

# Setup Minikube
setup_minikube() {
    if command -v minikube &> /dev/null; then
        echo -e "${BLUE}Налаштування Minikube...${NC}"
        
        if minikube status -p $MINIKUBE_PROFILE &> /dev/null; then
            echo -e "${GREEN}✓ Minikube кластер запущений${NC}"
        else
            echo -e "${YELLOW}Запуск Minikube...${NC}"
            minikube start -p $MINIKUBE_PROFILE --cpus=4 --memory=6144
        fi
        
        # Enable addons
        echo -e "${BLUE}Увімкнення addons...${NC}"
        minikube addons enable ingress -p $MINIKUBE_PROFILE
        minikube addons enable metrics-server -p $MINIKUBE_PROFILE
        minikube addons enable storage-provisioner -p $MINIKUBE_PROFILE
        
        echo ""
    fi
}

# Deploy manifests
deploy_manifests() {
    if [ "$DRY_RUN" = "true" ]; then
        echo -e "${YELLOW}Режим DRY-RUN: маніфести не будуть застосовані${NC}"
        echo ""
        echo -e "${BLUE}Валідація всіх файлів...${NC}"
        
        if kubectl apply -f . --namespace=$NAMESPACE --dry-run=client -o yaml > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Усі маніфести валідні${NC}"
        else
            echo -e "${RED}✗ Помилка валідації маніфестів${NC}"
            kubectl apply -f . --namespace=$NAMESPACE --dry-run=client -o yaml
            exit 1
        fi
    else
        echo -e "${BLUE}Розгортання маніфестів у namespace: $NAMESPACE${NC}"
        
        # Create namespace
        echo -e "${BLUE}1/2: Створення namespace...${NC}"
        kubectl apply -f 01-namespace.yaml
        
        # Deploy resources
        echo -e "${BLUE}2/2: Розгортання сервісів...${NC}"
        for file in $(ls -v [0-2][0-9]*.yaml | grep -v 01-namespace); do
            echo -e "  ${YELLOW}→${NC} $file"
            kubectl apply -f $file -n $NAMESPACE
            sleep 1
        done
        
        echo ""
        echo -e "${GREEN}✓ Розгортання завершено${NC}"
    fi
    
    echo ""
}

# Verify deployment
verify_deployment() {
    if [ "$DRY_RUN" = "false" ]; then
        echo -e "${BLUE}Перевірка статусу сервісів...${NC}"
        echo ""
        
        echo -e "${YELLOW}Pods:${NC}"
        kubectl get pods -n $NAMESPACE --no-headers || true
        
        echo ""
        echo -e "${YELLOW}Services:${NC}"
        kubectl get svc -n $NAMESPACE --no-headers || true
        
        echo ""
        echo -e "${YELLOW}Deployments:${NC}"
        kubectl get deployments -n $NAMESPACE --no-headers || true
        
        echo ""
    fi
}

# Print next steps
print_next_steps() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Наступні кроки                                            ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ "$DRY_RUN" = "true" ]; then
        echo -e "${YELLOW}Для фактичного розгортання запустіть:${NC}"
        echo -e "  ${GREEN}./deploy.sh false${NC}"
    else
        echo -e "${YELLOW}Чекання готовності pods (це може зайняти 2-3 хвилини):${NC}"
        echo -e "  ${GREEN}kubectl get pods -n iapteca -w${NC}"
        echo ""
        echo -e "${YELLOW}Перегляд логів:${NC}"
        echo -e "  ${GREEN}kubectl logs -n iapteca -f deployment/product-catalog${NC}"
        echo -e "  ${GREEN}kubectl logs -n iapteca -f deployment/order-processing${NC}"
        echo -e "  ${GREEN}kubectl logs -n iapteca -f deployment/api-gateway${NC}"
        echo ""
        echo -e "${YELLOW}Port-forward для API Gateway:${NC}"
        if command -v minikube &> /dev/null; then
            echo -e "  ${GREEN}minikube service api-gateway -n iapteca${NC}"
        else
            echo -e "  ${GREEN}kubectl port-forward -n iapteca svc/api-gateway 8080:80${NC}"
        fi
        echo ""
        echo -e "${YELLOW}Port-forward для MongoDB:${NC}"
        echo -e "  ${GREEN}kubectl port-forward -n iapteca svc/mongodb 27017:27017${NC}"
        echo ""
    fi
    
    echo -e "${YELLOW}Видалення всього (УВАГА!):${NC}"
    echo -e "  ${RED}kubectl delete namespace iapteca${NC}"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    setup_minikube
    deploy_manifests
    verify_deployment
    print_next_steps
}

main

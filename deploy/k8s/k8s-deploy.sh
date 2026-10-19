#!/bin/bash
set -e

# ==============================================================================
# HealthClaim Pro - Kubernetes Multi-Service Deployment Script
# ==============================================================================

ACTION=${1:-apply}

if [ "$ACTION" == "delete" ]; then
  echo ">>> Tearing down HealthClaim Pro Kubernetes workloads..."
  kubectl delete -f deploy/k8s/05-hpa-rule-engine.yaml --ignore-not-found
  kubectl delete -f deploy/k8s/04-gateway.yaml --ignore-not-found
  kubectl delete -f deploy/k8s/03-microservices.yaml --ignore-not-found
  kubectl delete -f deploy/k8s/02-infra.yaml --ignore-not-found
  kubectl delete -f deploy/k8s/01-config.yaml --ignore-not-found
  echo ">>> Workloads deleted."
  exit 0
fi

echo ">>> 1. Creating Namespace, ConfigMap & Secrets..."
kubectl apply -f deploy/k8s/01-config.yaml

echo ">>> 2. Deploying Shared Infrastructure (Postgres, Redis 7, RabbitMQ 3)..."
kubectl apply -f deploy/k8s/02-infra.yaml

echo ">>> 3. Deploying Core Microservices (Claim, Rule Engine, Actuarial, Settlement Worker)..."
kubectl apply -f deploy/k8s/03-microservices.yaml

echo ">>> 4. Deploying Platform API Gateway Ingress (NodePort: 30400)..."
kubectl apply -f deploy/k8s/04-gateway.yaml

echo ">>> 5. Configuring Horizontal Pod Autoscaler (HPA 1 -> 5 replicas)..."
kubectl apply -f deploy/k8s/05-hpa-rule-engine.yaml

echo ""
echo ">>> Deployment successfully submitted! Checking Pod statuses in namespace 'healthclaim':"
kubectl get pods -n healthclaim -o wide
echo ""
echo ">>> To inspect HPA status, run: kubectl get hpa -n healthclaim -w"

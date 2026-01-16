#!/bin/bash

set -e

algorithm_name=hypd-training-op-torch
docker_filename=Dockerfile.torch
img_version=latest

region=$(aws configure get region)
account=$(aws sts get-caller-identity --query Account --output text)

aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin "${account}.dkr.ecr.${region}.amazonaws.com"
aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin "763104351884.dkr.ecr.${region}.amazonaws.com"

aws ecr describe-repositories --region $region --repository-names "${algorithm_name}" > /dev/null 2>&1 || {
    echo "create repository:" "${algorithm_name}"
    aws ecr create-repository --region $region  --repository-name "${algorithm_name}" > /dev/null
}

docker build -t ${algorithm_name} -f ${docker_filename} .

fullname="${account}.dkr.ecr.${region}.amazonaws.com/${algorithm_name}:${img_version}"
docker tag ${algorithm_name} ${fullname}
docker push ${fullname}

echo "Successfully pushed: $fullname"

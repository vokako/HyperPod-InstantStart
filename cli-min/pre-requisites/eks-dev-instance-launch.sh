
name_tag=eks-hypd-workspace-$(date +"%m%d%H%M")
aws cloudformation create-stack \
  --stack-name $name_tag \
  --template-body file://eks-hypd-workspace.yaml \
  --parameters ParameterKey=ResourceTag,ParameterValue=$name_tag \
              ParameterKey=InstanceType,ParameterValue=c5.2xlarge \
              ParameterKey=EBSVolumeSize,ParameterValue=400 \
              ParameterKey=KeyPairName,ParameterValue=pdxkeypair \
  --capabilities CAPABILITY_NAMED_IAM

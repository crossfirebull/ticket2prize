terraform {
  required_version = ">= 1.10"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # bucket is supplied at init: terraform init -backend-config="bucket=<state bucket>"
  backend "s3" {
    key          = "ticket2prize/dev.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = { Project = "ticket2prize", Environment = "dev", ManagedBy = "terraform" }
  }
}

variable "image_tag" {
  description = "Image tag to deploy; CI passes the git SHA."
  type        = string
}

variable "alarm_email" {
  type    = string
  default = ""
}

# Smallest footprint: one task each, single-AZ database, easy teardown.
module "app" {
  source      = "../../modules/app"
  name        = "ticket2prize-dev"
  environment = "dev"
  image_tag   = var.image_tag
  vpc_cidr    = "10.20.0.0/16"
  alarm_email = var.alarm_email
}

output "url" {
  value = module.app.url
}

output "dashboard_url" {
  value = module.app.dashboard_url
}

# Used by the one-off admin task in docs/deploying.md.
output "admin_task" {
  value = {
    cluster         = module.app.cluster_name
    task_definition = module.app.api_task_definition
    subnets         = module.app.task_subnets
    security_group  = module.app.task_security_group
  }
}

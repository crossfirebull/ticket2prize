terraform {
  required_version = ">= 1.10"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # bucket is supplied at init: terraform init -backend-config="bucket=<state bucket>"
  backend "s3" {
    key          = "ticket2prize/prod.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = { Project = "ticket2prize", Environment = "prod", ManagedBy = "terraform" }
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

variable "certificate_arn" {
  description = "ACM certificate for the public hostname; empty serves HTTP only."
  type        = string
  default     = ""
}

variable "public_base_url" {
  description = "e.g. https://prizes.example.com, once DNS points at the load balancer."
  type        = string
  default     = ""
}

module "app" {
  source      = "../../modules/app"
  name        = "ticket2prize-prod"
  environment = "prod"
  image_tag   = var.image_tag
  vpc_cidr    = "10.30.0.0/16"
  alarm_email = var.alarm_email

  certificate_arn = var.certificate_arn
  public_base_url = var.public_base_url

  app_cpu       = 512
  app_memory    = 1024
  app_min_count = 2
  app_max_count = 6

  db_instance_class        = "db.t4g.small"
  db_multi_az              = true
  db_backup_retention_days = 14
  deletion_protection      = true
  log_retention_days       = 90
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
    task_definition = module.app.task_definition
    subnets         = module.app.task_subnets
    security_group  = module.app.task_security_group
  }
}

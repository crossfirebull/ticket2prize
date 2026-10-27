variable "name" {
  description = "Prefix for every resource, e.g. ticket2prize-dev."
  type        = string
}

variable "environment" {
  description = "dev or prod; passed to the app as ENVIRONMENT."
  type        = string
}

variable "image_tag" {
  description = "Container image tag to deploy (the git SHA in CI)."
  type        = string
}

variable "repository" {
  description = "ECR repository holding the app image."
  type        = string
  default     = "ticket2prize"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "certificate_arn" {
  description = "ACM certificate for HTTPS. Leave empty to serve plain HTTP (fine for a demo)."
  type        = string
  default     = ""
}

variable "public_base_url" {
  description = "URL printed in stub QR codes. Defaults to the load balancer's address."
  type        = string
  default     = ""
}

variable "app_cpu" {
  type    = number
  default = 256
}

variable "app_memory" {
  type    = number
  default = 512
}

variable "app_min_count" {
  type    = number
  default = 1
}

variable "app_max_count" {
  type    = number
  default = 2
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_backup_retention_days" {
  type    = number
  default = 1
}

variable "deletion_protection" {
  description = "Protect the database from `terraform destroy`. Turn on for prod."
  type        = bool
  default     = false
}

variable "seed_demo_data" {
  description = "Load the sample prize catalog on boot (idempotent)."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "alarm_email" {
  description = "Email subscribed to CloudWatch alarms. Empty for none."
  type        = string
  default     = ""
}

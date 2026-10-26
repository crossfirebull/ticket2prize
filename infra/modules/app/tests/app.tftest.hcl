# Plan-only checks with a mocked AWS provider: no account or credentials needed.
#   cd infra/modules/app && terraform init && terraform test

mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["us-east-1a", "us-east-1b", "us-east-1c"] }
  }
  mock_data "aws_region" {
    defaults = { region = "us-east-1" }
  }
  mock_data "aws_ecr_repository" {
    defaults = { repository_url = "123456789012.dkr.ecr.us-east-1.amazonaws.com/repo" }
  }
  mock_data "aws_iam_policy_document" {
    defaults = { json = "{}" }
  }
  mock_resource "aws_db_instance" {
    defaults = {
      master_user_secret = [{ secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds", kms_key_id = "", secret_status = "active" }]
      address            = "db.internal"
    }
  }
  mock_resource "aws_sns_topic" {
    defaults = { arn = "arn:aws:sns:us-east-1:123456789012:alarms" }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/mock" }
  }
  mock_resource "aws_lb_target_group" {
    defaults = { arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/t2p/1", arn_suffix = "targetgroup/t2p/1" }
  }
  mock_resource "aws_lb_listener" {
    defaults = { arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/t2p/1/1" }
  }
  mock_resource "aws_secretsmanager_secret" {
    defaults = { arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:app" }
  }
  mock_resource "aws_lb" {
    defaults = { dns_name = "t2p-123.us-east-1.elb.amazonaws.com", arn_suffix = "app/t2p/123", arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/t2p/123" }
  }
}

mock_provider "random" {}

variables {
  name        = "t2p-test"
  environment = "dev"
  image_tag   = "abc123"
}

run "dev_defaults" {
  command = apply

  assert {
    condition     = length(aws_subnet.public) == 2 && length(aws_subnet.private) == 2
    error_message = "Expected two public and two private subnets"
  }
  assert {
    condition     = aws_db_instance.this.publicly_accessible == false && aws_db_instance.this.storage_encrypted
    error_message = "Database must be private and encrypted"
  }
  assert {
    condition     = aws_db_instance.this.skip_final_snapshot == true && aws_db_instance.this.multi_az == false
    error_message = "Dev database should be cheap and disposable"
  }
  assert {
    condition     = aws_lb_listener.http.default_action[0].type == "forward" && length(aws_lb_listener.https) == 0
    error_message = "Without a certificate, HTTP should serve the app directly"
  }
  assert {
    condition     = output.url == "http://t2p-123.us-east-1.elb.amazonaws.com"
    error_message = "QR codes should point at the load balancer by default"
  }
  assert {
    condition     = strcontains(aws_ecs_task_definition.api.container_definitions, "repo:abc123")
    error_message = "API task should run the requested image tag"
  }
  assert {
    condition     = !strcontains(aws_ecs_task_definition.api.container_definitions, "\"name\":\"DB_PASSWORD\",\"value\"")
    error_message = "The database password must come from Secrets Manager, not plain env"
  }
}

run "prod_hardening" {
  command = apply

  variables {
    environment         = "prod"
    certificate_arn     = "arn:aws:acm:us-east-1:123456789012:certificate/abc"
    public_base_url     = "https://prizes.example.com"
    db_multi_az         = true
    deletion_protection = true
  }

  assert {
    condition     = aws_lb_listener.http.default_action[0].type == "redirect"
    error_message = "With a certificate, HTTP should redirect to HTTPS"
  }
  assert {
    condition     = aws_lb_listener_rule.api.listener_arn == aws_lb_listener.https[0].arn
    error_message = "API routing should live on the HTTPS listener"
  }
  assert {
    condition     = aws_db_instance.this.deletion_protection && !aws_db_instance.this.skip_final_snapshot
    error_message = "Prod database must be protected and snapshot on delete"
  }
  assert {
    condition     = output.url == "https://prizes.example.com"
    error_message = "QR codes should use the public hostname"
  }
}

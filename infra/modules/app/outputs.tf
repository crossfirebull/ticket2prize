output "url" {
  description = "Where the app is served."
  value       = local.base_url
}

output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "api_task_definition" {
  value = aws_ecs_task_definition.api.family
}

output "task_subnets" {
  value = aws_subnet.public[*].id
}

output "task_security_group" {
  value = aws_security_group.tasks.id
}

output "app_secret_arn" {
  description = "Holds the kiosk key the ticket machines need."
  value       = aws_secretsmanager_secret.app.arn
}

output "alarm_topic_arn" {
  value = aws_sns_topic.alarms.arn
}

output "dashboard_url" {
  value = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.region}#dashboards/dashboard/${aws_cloudwatch_dashboard.this.dashboard_name}"
}

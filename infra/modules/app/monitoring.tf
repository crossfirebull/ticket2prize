resource "aws_sns_topic" "alarms" {
  name = "${var.name}-alarms"
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# Business metrics pulled straight out of the API's JSON request logs.
locals {
  namespace = "Ticket2Prize/${var.environment}"
  log_metrics = {
    Checkouts    = "{ $.path = \"/api/orders\" && $.method = \"POST\" && $.status = 201 }"
    StubsClaimed = "{ $.path = \"/api/stubs/*/claim\" && $.status = 200 }"
    StubsIssued  = "{ $.path = \"/api/kiosk/stubs\" && $.status = 201 }"
    ServerErrors = "{ $.status >= 500 }"
  }
}

resource "aws_cloudwatch_log_metric_filter" "api" {
  for_each       = local.log_metrics
  name           = "${var.name}-${each.key}"
  log_group_name = aws_cloudwatch_log_group.api.name
  pattern        = each.value
  metric_transformation {
    name          = each.key
    namespace     = local.namespace
    value         = "1"
    default_value = "0"
  }
}

locals {
  alb_dim = { LoadBalancer = aws_lb.this.arn_suffix }
  alarms = {
    api-5xx = {
      description = "API returned 5xx responses"
      namespace   = "AWS/ApplicationELB"
      metric      = "HTTPCode_Target_5XX_Count"
      stat        = "Sum"
      threshold   = 5
      dimensions  = merge(local.alb_dim, { TargetGroup = aws_lb_target_group.api.arn_suffix })
    }
    api-unhealthy = {
      description = "API has unhealthy targets"
      namespace   = "AWS/ApplicationELB"
      metric      = "UnHealthyHostCount"
      stat        = "Maximum"
      threshold   = 0
      dimensions  = merge(local.alb_dim, { TargetGroup = aws_lb_target_group.api.arn_suffix })
    }
    api-latency-p95 = {
      description = "API p95 latency above 1s"
      namespace   = "AWS/ApplicationELB"
      metric      = "TargetResponseTime"
      stat        = "p95"
      threshold   = 1
      dimensions  = merge(local.alb_dim, { TargetGroup = aws_lb_target_group.api.arn_suffix })
    }
    db-cpu = {
      description = "Database CPU above 80%"
      namespace   = "AWS/RDS"
      metric      = "CPUUtilization"
      stat        = "Average"
      threshold   = 80
      dimensions  = { DBInstanceIdentifier = aws_db_instance.this.identifier }
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "this" {
  for_each            = local.alarms
  alarm_name          = "${var.name}-${each.key}"
  alarm_description   = each.value.description
  namespace           = each.value.namespace
  metric_name         = each.value.metric
  dimensions          = each.value.dimensions
  statistic           = startswith(each.value.stat, "p") ? null : each.value.stat
  extended_statistic  = startswith(each.value.stat, "p") ? each.value.stat : null
  period              = 300
  evaluation_periods  = 1
  threshold           = each.value.threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "db_storage" {
  alarm_name          = "${var.name}-db-storage-low"
  alarm_description   = "Database has under 2 GB free"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.this.identifier }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 2 * 1024 * 1024 * 1024
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_dashboard" "this" {
  dashboard_name = var.name
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6
        properties = {
          title  = "Redemptions"
          region = data.aws_region.current.region
          stat   = "Sum"
          period = 300
          metrics = [
            [local.namespace, "StubsIssued"],
            [local.namespace, "StubsClaimed"],
            [local.namespace, "Checkouts"],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6
        properties = {
          title  = "API requests and errors"
          region = data.aws_region.current.region
          stat   = "Sum"
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "TargetGroup", aws_lb_target_group.api.arn_suffix, "LoadBalancer", aws_lb.this.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "TargetGroup", aws_lb_target_group.api.arn_suffix, "LoadBalancer", aws_lb.this.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "TargetGroup", aws_lb_target_group.api.arn_suffix, "LoadBalancer", aws_lb.this.arn_suffix],
          ]
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6
        properties = {
          title  = "API latency"
          region = data.aws_region.current.region
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "TargetGroup", aws_lb_target_group.api.arn_suffix, "LoadBalancer", aws_lb.this.arn_suffix, { stat = "p50" }],
            ["...", { stat = "p95" }],
            ["...", { stat = "p99" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6
        properties = {
          title  = "ECS CPU / memory"
          region = data.aws_region.current.region
          stat   = "Average"
          period = 60
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", aws_ecs_service.api.name, "ClusterName", aws_ecs_cluster.this.name],
            ["AWS/ECS", "MemoryUtilization", "ServiceName", aws_ecs_service.api.name, "ClusterName", aws_ecs_cluster.this.name],
            ["AWS/ECS", "CPUUtilization", "ServiceName", aws_ecs_service.web.name, "ClusterName", aws_ecs_cluster.this.name],
          ]
        }
      },
      {
        type = "metric", x = 0, y = 12, width = 12, height = 6
        properties = {
          title  = "Database"
          region = data.aws_region.current.region
          stat   = "Average"
          period = 60
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.this.identifier],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.this.identifier, { yAxis = "right" }],
          ]
        }
      },
      {
        type = "log", x = 12, y = 12, width = 12, height = 6
        properties = {
          title  = "Recent API errors"
          region = data.aws_region.current.region
          query  = "SOURCE '${aws_cloudwatch_log_group.api.name}' | fields ts, method, path, status, duration_ms | filter status >= 500 or level = 'ERROR' | sort @timestamp desc | limit 20"
          view   = "table"
        }
      },
    ]
  })
}

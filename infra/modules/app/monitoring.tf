resource "aws_sns_topic" "alarms" {
  name = "${var.name}-alarms"
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# Business metrics counted from the app's JSON event logs (src/lib/log.ts).
locals {
  namespace = "Ticket2Prize/${var.environment}"
  log_metrics = {
    StubsIssued    = "{ $.event = \"stub_issued\" }"
    StubsClaimed   = "{ $.event = \"stub_claimed\" }"
    Checkouts      = "{ $.event = \"checkout\" }"
    OrdersPickedUp = "{ $.event = \"order_fulfilled\" }"
    AppErrors      = "{ $.level = \"error\" }"
  }
}

resource "aws_cloudwatch_log_metric_filter" "events" {
  for_each       = local.log_metrics
  name           = "${var.name}-${each.key}"
  log_group_name = aws_cloudwatch_log_group.app.name
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
    app-5xx = {
      description = "App returned 5xx responses"
      namespace   = "AWS/ApplicationELB"
      metric      = "HTTPCode_Target_5XX_Count"
      stat        = "Sum"
      threshold   = 5
      dimensions  = merge(local.alb_dim, { TargetGroup = aws_lb_target_group.app.arn_suffix })
    }
    app-unhealthy = {
      description = "App has unhealthy targets"
      namespace   = "AWS/ApplicationELB"
      metric      = "UnHealthyHostCount"
      stat        = "Maximum"
      threshold   = 0
      dimensions  = merge(local.alb_dim, { TargetGroup = aws_lb_target_group.app.arn_suffix })
    }
    app-latency-p95 = {
      description = "p95 response time above 1s"
      namespace   = "AWS/ApplicationELB"
      metric      = "TargetResponseTime"
      stat        = "p95"
      threshold   = 1
      dimensions  = merge(local.alb_dim, { TargetGroup = aws_lb_target_group.app.arn_suffix })
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
            [local.namespace, "OrdersPickedUp"],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6
        properties = {
          title  = "Requests and errors"
          region = data.aws_region.current.region
          stat   = "Sum"
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "TargetGroup", aws_lb_target_group.app.arn_suffix, "LoadBalancer", aws_lb.this.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "TargetGroup", aws_lb_target_group.app.arn_suffix, "LoadBalancer", aws_lb.this.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "TargetGroup", aws_lb_target_group.app.arn_suffix, "LoadBalancer", aws_lb.this.arn_suffix],
          ]
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6
        properties = {
          title  = "Response time"
          region = data.aws_region.current.region
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "TargetGroup", aws_lb_target_group.app.arn_suffix, "LoadBalancer", aws_lb.this.arn_suffix, { stat = "p50" }],
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
            ["AWS/ECS", "CPUUtilization", "ServiceName", aws_ecs_service.app.name, "ClusterName", aws_ecs_cluster.this.name],
            ["AWS/ECS", "MemoryUtilization", "ServiceName", aws_ecs_service.app.name, "ClusterName", aws_ecs_cluster.this.name],
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
          title  = "Recent errors"
          region = data.aws_region.current.region
          query  = "SOURCE '${aws_cloudwatch_log_group.app.name}' | fields ts, event, error | filter level = 'error' | sort @timestamp desc | limit 20"
          view   = "table"
        }
      },
    ]
  })
}

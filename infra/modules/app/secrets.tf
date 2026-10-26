resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_password" "kiosk_key" {
  length  = 40
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name}/app"
  description             = "Ticket2Prize signing secret and kiosk key"
  recovery_window_in_days = var.deletion_protection ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    jwt_secret = random_password.jwt.result
    kiosk_keys = random_password.kiosk_key.result
  })
}

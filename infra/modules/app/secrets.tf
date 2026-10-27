resource "random_password" "session" {
  length  = 64
  special = false
}

resource "random_password" "kiosk_key" {
  length  = 40
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name}/app"
  description             = "Ticket2Prize session signing key and kiosk key"
  recovery_window_in_days = var.deletion_protection ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    session_secret = random_password.session.result
    kiosk_keys     = random_password.kiosk_key.result
  })
}

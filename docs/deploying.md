# Deploying to AWS

Everything runs in `us-east-1` by default. You need the AWS CLI signed in as an admin of the
account, and Terraform 1.10 or newer.

## Rough cost

Estimates for us-east-1; check current pricing before relying on them.

| | dev | prod |
| --- | --- | --- |
| Load balancer | ~$18 | ~$18 |
| Fargate | ~$9 (1 small task) | ~$40 (2–6 tasks) |
| RDS Postgres | ~$15 (t4g.micro) | ~$60 (t4g.small, Multi-AZ) |
| Public IPv4, Secrets Manager, CloudWatch | ~$12 | ~$20 |
| **≈ per month** | **$55** | **$140** |

`terraform destroy` in `infra/envs/dev` when you're not demoing it. Dev has no deletion
protection, so it tears down cleanly.

## 1. Bootstrap the account (once)

```bash
cd infra/bootstrap
terraform init
terraform apply -var github_repository=crossfirebull/ticket2prize
```

This creates the Terraform state bucket, the ECR repository, and the IAM role GitHub Actions
assumes. Its own state is local. Keep `terraform.tfstate` from this folder somewhere
safe, or just re-import if you ever lose it.

## 2. Configure the GitHub repository

**Settings → Secrets and variables → Actions → Variables:**

| Variable | Value |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | `deploy_role_arn` output from step 1 |
| `TF_STATE_BUCKET` | `state_bucket` output from step 1 |
| `ALARM_EMAIL` | *(optional)* where CloudWatch alarms go; confirm the email AWS sends |
| `PROD_CERTIFICATE_ARN` | *(optional)* ACM cert for your domain, enables HTTPS |
| `PROD_PUBLIC_URL` | *(optional)* e.g. `https://prizes.example.com`, used in QR codes |

**Settings → Environments:** create `dev` and `production`. On `production`, add yourself
as a required reviewer, so releases wait for a click.

## 3. Deploy

Merge to `main`. The **Deploy** workflow runs CI, pushes an image tagged with the commit SHA,
applies dev, runs the smoke test and the Playwright journeys against it, then waits for
approval to apply prod.

The first apply takes about 15 minutes, mostly creating RDS. Later deploys take about 4.

To redeploy an older build (a rollback), run the workflow manually with that commit's SHA as
`image_tag`.

## 4. After the first deploy

**Get the kiosk key** your ticket machines (or the demo kiosk page) need. It's deliberately
not prefilled on the deployed kiosk page, since anyone with it can mint tickets:

```bash
aws secretsmanager get-secret-value --secret-id ticket2prize-dev/app \
  --query SecretString --output text | jq -r .kiosk_keys
```

**Create a staff account** with a one-off task:

```bash
cd infra/envs/dev
t=$(terraform output -json admin_task)
aws ecs run-task --launch-type FARGATE \
  --cluster "$(jq -r .cluster <<<"$t")" \
  --task-definition "$(jq -r .task_definition <<<"$t")" \
  --network-configuration "awsvpcConfiguration={subnets=[$(jq -r '.subnets|join(",")' <<<"$t")],securityGroups=[$(jq -r .security_group <<<"$t")],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"app","command":["node","cli.mjs","create-staff","you@example.com","a-long-password"]}]}'
```

The password ends up in the task's override history (visible in the ECS console and
CloudTrail), so change it after first sign-in or use a throwaway one.

## Manual Terraform

Useful for previewing a change before merging:

```bash
cd infra/envs/dev
terraform init -backend-config="bucket=<state bucket>"
terraform plan -var image_tag=<a SHA that exists in ECR>
```

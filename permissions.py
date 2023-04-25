'''
	Create a security policy for your s3 bucket
    You must replace <bucket-name> on line 9 with your actual bucket name
'''
import boto3
import json

S3API = boto3.client("s3", region_name="us-east-1")
bucket_name = "<bucket-name>"

policy_file = open("/home/ec2-user/environment/website_security_policy.json", "r")


S3API.put_bucket_policy(
    Bucket = bucket_name,
    Policy = policy_file.read()
)
#print ("DONE")

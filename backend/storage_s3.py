"""Optional S3 storage backend.

Activates only when ALL of the following env vars are set:
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET

Until then, uploads continue to use the Emergent object storage (see routes/uploads.py).
This module is intentionally lazy — boto3 is only imported / clients only built
when the env is configured, so a missing AWS environment never crashes the app.
"""
import os
import logging

logger = logging.getLogger("storage_s3")


def s3_enabled() -> bool:
    return all(os.environ.get(k) for k in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "S3_BUCKET"))


_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    import boto3  # local import — only loaded when S3 is active
    _client = boto3.client(
        "s3",
        region_name=os.environ["AWS_REGION"],
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    return _client


def put_object_s3(path: str, data: bytes, content_type: str) -> dict:
    bucket = os.environ["S3_BUCKET"]
    client = _get_client()
    client.put_object(Bucket=bucket, Key=path, Body=data, ContentType=content_type)
    return {"path": path, "size": len(data), "backend": "s3"}


def get_object_s3(path: str):
    bucket = os.environ["S3_BUCKET"]
    client = _get_client()
    obj = client.get_object(Bucket=bucket, Key=path)
    return obj["Body"].read(), obj.get("ContentType", "application/octet-stream")


def delete_object_s3(path: str):
    bucket = os.environ["S3_BUCKET"]
    client = _get_client()
    client.delete_object(Bucket=bucket, Key=path)

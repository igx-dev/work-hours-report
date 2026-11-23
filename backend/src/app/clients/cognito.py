"""Cognito から member グループの人を取る(未提出者を探すため)。"""

import boto3


def list_members(user_pool_id: str) -> list[dict]:
    client = boto3.client("cognito-idp")
    members = []
    for page in client.get_paginator("list_users_in_group").paginate(
            UserPoolId=user_pool_id, GroupName="member"):
        for user in page["Users"]:
            if not user.get("Enabled", True):
                continue
            attrs = {a["Name"]: a["Value"] for a in user["Attributes"]}
            members.append({"userId": attrs["sub"], "name": attrs.get("name", user["Username"])})
    return members

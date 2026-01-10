
def lambda_handler(event, context):
    return {
        'statusCode': 200,
        'body': 'Diarization is temporarily disabled in Dockerless deployment due to size limits (PyTorch dependency).'
    }

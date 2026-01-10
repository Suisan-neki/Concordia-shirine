import json
import os
import boto3
from openai import OpenAI

# Initialize OpenAI client (lazy load)
client = None

def get_openai_client():
    global client
    if client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            client = OpenAI(api_key=api_key)
        else:
            print("OPENAI_API_KEY environment variable not set")
    return client

SYSTEM_PROMPT = """
You are the "Guardian AI" of a conversation sanctuary. Your goal is to ensure "Psychological Safety".
Analyze the provided transcript and conversation state.
Identify risks such as:
- Dominance (Simple "One-Sided" state)
- Disengagement (Long silence)
- Tension/Conflict (Negative sentiment)
- Lack of Empathy

Output a JSON object with:
- "advice": A short, gentle, actionable coaching tip (Japanese, max 40 chars).
- "analysis_label": A short label for the current state (e.g., "Heat Up", "Frozen", "Good Flow").
- "urgency": "low" or "high".

If the flow is good, give positive reinforcement or return null advice.
Keep the tone calm, protective, and minimalist.
"""

def lambda_handler(event, context):
    print("Received event:", json.dumps(event))
    
    try:
        body = json.loads(event.get("body", "{}"))
        transcript_recent = body.get("transcript_recent", "")
        conversation_state = body.get("conversation_state", "Unknown")
        
        if not transcript_recent:
            return {
                "statusCode": 200,
                "body": json.dumps({
                    "advice": None,
                    "analysis_label": "Listening...",
                    "urgency": "low"
                })
            }

        client = get_openai_client()
        if not client:
            return {
                "statusCode": 500,
                "body": json.dumps({"error": "OpenAI client not initialized"})
            }

        user_message = f"State: {conversation_state}\nTranscript: {transcript_recent}"

        response = client.chat.completions.create(
            model="gpt-4o", # Or gpt-3.5-turbo if cost is concern, but 4o is better for nuance
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=150
        )

        result_json = response.choices[0].message.content
        print("OpenAI Result:", result_json)
        
        result = json.loads(result_json)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" # CORS handled by API Gateway but good to have
            },
            "body": json.dumps(result)
        }

    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

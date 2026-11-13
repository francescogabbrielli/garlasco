# Backend
In order to work proprerly, prior to the deploy ensure the following operations are in place:

## Tavily
- Create an API key

## AWS
- Add default files/records (Consider adding an init operation for it):
    - Uploading templates to S3
    - Inserting default records in the DynamoDB (like BOT_FALLBACK_PERSON_ID person)
- Current secrets needed:
    - TAVILY_API_KEY
    - BOT_FALLBACK_PERSON_ID


# Frontend
In order to work properly, prior to the deploy ensure the following operations are in place:

## Google MAPS
- Configure Javascript Maps API on Google Cloud
- Provide env vars:
    - GOOGLE_MAPS_API_KEY
    - GOOGLE_MAPS_ID

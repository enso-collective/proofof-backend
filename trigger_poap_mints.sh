#!/bin/bash

CLOUD_FUNCTION_URL="https://us-central1-enso-collective.cloudfunctions.net/attest_poap"
API_KEY="263a9791808ef5a263a9791808ef5a"

while IFS=',' read -r poap_id poap_name; do
  curl --request POST \
    --url "$CLOUD_FUNCTION_URL" \
    --header 'Content-Type: application/json' \
    --data "{
      \"key\": \"$API_KEY\",
      \"poap_id\": \"$poap_id\",
      \"poap_name\": \"$poap_name\"
    }"
  echo ""
done < poap_list.txt
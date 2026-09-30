wget -O - \
  --method=POST \
  --header="Content-Type: application/json" \
  --body-file=medidas.json \
  http://localhost:8080/measurements

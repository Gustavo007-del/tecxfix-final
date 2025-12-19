import requests

url = "http://127.0.0.1:8000/api/update-complaint/"
payload = {
    "complaint_no": "PWCOM/210725/49",  # change complaint number for testing
    "status": "CLOSED"
}

response = requests.post(url, json=payload)
print("Status:", response.status_code)
print("Response:", response.json())

"""Isolated tests: no production settings, credentials, logs or services."""
SECRET_KEY = 'isolated-stock-regression-tests'
USE_TZ = True
TIME_ZONE = 'Asia/Kolkata'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
INSTALLED_APPS = [
    'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions',
    'rest_framework', 'api', 'courier_api', 'technician_tracking',
]
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
STOCK_ALLOW_TEST_LOCK = True
COMPLAINT_PROCESSING_ENABLED = True
ROOT_URLCONF = 'backend.test_urls'
MIDDLEWARE = []
REST_FRAMEWORK = {'DEFAULT_AUTHENTICATION_CLASSES': []}
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
LOGGING = {'version': 1, 'disable_existing_loggers': False, 'handlers': {
    'null': {'class': 'logging.NullHandler'},
}, 'root': {'handlers': ['null']}}
